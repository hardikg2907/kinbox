import { and, count, eq, sql } from "drizzle-orm";
import { refresh } from "next/cache";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { ActionResult, StatusMoveUndo } from "@/data/dto";
import { MESSAGES } from "@/data/errors";
import { STATUSES, type Status } from "@/domain/types";
import { closeDb, db } from "@/db/client";
import { entries, titles } from "@/db/schema";
import { entryRow, insertEntry, resetDatabase, setEntryTimes, tickKeys, watchRows } from "@/test/db";
import { OWNER_A, OWNER_B, resetTestState, signInAs, testState, TMDB, TODAY } from "@/test/mocks";
import {
  deleteEntry,
  deleteWatch,
  saveTitle,
  setNote,
  setRating,
  setStatus,
  setWatchDate,
  undoStatusMove,
  watchAgain,
} from "./entries";
import { tickEpisode } from "./progress";

vi.mock("@/data/session", async () => (await import("@/test/mocks")).sessionModule());
vi.mock("@/data/today", async () => (await import("@/test/mocks")).todayModule());
vi.mock("@/lib/tmdb/client", async () => (await import("@/test/mocks")).tmdbClientModule());
vi.mock("next/cache", async () => (await import("@/test/mocks")).nextCacheModule());
vi.mock("next/server", async () => (await import("@/test/mocks")).nextServerModule());

function ok<T>(result: ActionResult<T>): T {
  if (!result.ok) throw new Error(`Expected success, got: ${result.error}`);
  return result.data;
}

function failure(result: ActionResult<unknown>): string {
  if (result.ok) throw new Error("Expected a failure");
  return result.error;
}

async function save(kind: "movie" | "series", tmdbId: number, status: "to_watch" | "watching" | "watched" | "dropped") {
  return ok(await saveTitle({ kind, tmdbId, status }));
}

async function entryCount(ownerId: string): Promise<number> {
  const [row] = await db().select({ n: count() }).from(entries).where(eq(entries.userId, ownerId));
  return row?.n ?? 0;
}

const OLD = new Date("2020-01-01T00:00:00Z");

beforeEach(async () => {
  resetTestState();
  vi.mocked(refresh).mockClear();
  await resetDatabase();
});

afterAll(async () => {
  await closeDb();
});

describe("saveTitle", () => {
  it("is idempotent: a second save returns the existing Entry unchanged", async () => {
    const first = await save("movie", TMDB.inception, "to_watch");
    const second = await save("movie", TMDB.inception, "watched");

    expect(first.created).toBe(true);
    expect(second).toEqual({ entryId: first.entryId, status: "to_watch", created: false, seasons: null });
    expect(await entryCount(OWNER_A.id)).toBe(1);
    expect(await watchRows(first.entryId)).toEqual([]);
  });

  it("makes one Entry and one Watch when two saves arrive at once", async () => {
    const results = await Promise.all([
      saveTitle({ kind: "movie", tmdbId: TMDB.matrix, status: "watched" }),
      saveTitle({ kind: "movie", tmdbId: TMDB.matrix, status: "watched" }),
    ]);
    const [a, b] = results.map(ok);

    expect(a!.entryId).toBe(b!.entryId);
    expect([a!.created, b!.created].sort()).toEqual([false, true]);
    expect(await entryCount(OWNER_A.id)).toBe(1);
    expect(await watchRows(a!.entryId)).toHaveLength(1);
  });

  it("stores the Title snapshot from TMDB", async () => {
    await save("movie", TMDB.inception, "to_watch");
    const [title] = await db().select().from(titles).where(eq(titles.tmdbId, TMDB.inception));
    expect(title).toMatchObject({ kind: "movie", name: "Inception", year: 2010, tmdbStatus: null });
    expect(title?.posterPath).toMatch(/^\/.+\.jpg$/);
  });

  it("adds a Watch with date unknown when a Movie is saved as Watched", async () => {
    const saved = await save("movie", TMDB.dune, "watched");
    expect(saved.status).toBe("watched");
    expect(await watchRows(saved.entryId)).toEqual([{ id: expect.any(String), watchedOn: null }]);
  });

  it("ticks the aired numbered Episodes, not Specials, when a Series is saved as Watched", async () => {
    const ended = await save("series", TMDB.breakingBad, "watched");
    const ticks = await tickKeys(ended.entryId);
    expect(ticks).toHaveLength(20);
    expect(ticks.some((key) => key.startsWith("0:"))).toBe(false);
    expect(await watchRows(ended.entryId)).toEqual([{ id: expect.any(String), watchedOn: null }]);
    expect((await entryRow(ended.entryId))?.progressMovedAt).not.toBeNull();

    const ongoing = await save("series", TMDB.thePitt, "watched");
    const ongoingTicks = await tickKeys(ongoing.entryId);
    expect(ongoingTicks).toHaveLength(25);
    expect(ongoingTicks).not.toContain("2:11");
  });

  it("returns the numbered Seasons for the picker only for a Series saved as Watching", async () => {
    const watching = await save("series", TMDB.breakingBad, "watching");
    expect(watching.seasons).toEqual([
      { seasonNumber: 1, name: "Season 1", episodeCount: 7 },
      { seasonNumber: 2, name: "Season 2", episodeCount: 13 },
    ]);
    expect(await tickKeys(watching.entryId)).toEqual([]);

    expect((await save("series", TMDB.westworld, "to_watch")).seasons).toBeNull();
    expect((await save("movie", TMDB.matrix, "watching")).seasons).toBeNull();
  });

  it("rejects a Title TMDB does not list", async () => {
    const result = await saveTitle({ kind: "movie", tmdbId: 424242, status: "to_watch" });
    expect(failure(result)).toBe(MESSAGES.titleNotFound);
    expect(await entryCount(OWNER_A.id)).toBe(0);
  });

  it("says when TMDB cannot be reached", async () => {
    testState.tmdbDown = true;
    const result = await saveTitle({ kind: "movie", tmdbId: TMDB.inception, status: "to_watch" });
    expect(failure(result)).toBe(MESSAGES.tmdbDown);
    expect(refresh).not.toHaveBeenCalled();
  });

  it.each([
    { kind: "movie", tmdbId: TMDB.inception, status: "to_watch", extra: true },
    { kind: "person", tmdbId: TMDB.inception, status: "to_watch" },
    { kind: "movie", tmdbId: 0, status: "to_watch" },
    { kind: "movie", tmdbId: 1.5, status: "to_watch" },
    { kind: "movie", tmdbId: "27205", status: "to_watch" },
    { kind: "movie", tmdbId: TMDB.inception, status: "completed" },
    null,
  ])("rejects malformed input %j", async (input) => {
    const result = await saveTitle(input as never);
    expect(failure(result)).toBe(MESSAGES.invalid);
    expect(refresh).not.toHaveBeenCalled();
    expect(await entryCount(OWNER_A.id)).toBe(0);
  });

  it("re-renders the screen after a save", async () => {
    await save("movie", TMDB.inception, "to_watch");
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("re-renders the screen when the write is refused, so a stale screen catches up", async () => {
    const { entryId } = await save("movie", TMDB.inception, "to_watch");
    ok(await deleteEntry({ entryId }));
    vi.mocked(refresh).mockClear();

    expect(failure(await setStatus({ entryId, status: "watching" }))).toBe(MESSAGES.entryNotFound);
    expect(refresh).toHaveBeenCalledTimes(1);
  });
  it("sends a signed-out caller to sign in", async () => {
    signInAs(null);
    await expect(
      saveTitle({ kind: "movie", tmdbId: TMDB.inception, status: "to_watch" }),
    ).rejects.toThrow(/NEXT_REDIRECT/);
  });
});

describe("setStatus", () => {
  it("adds a Watch dated today when an Entry moves to Watched", async () => {
    const { entryId } = await save("movie", TMDB.inception, "to_watch");
    await setEntryTimes(entryId, { statusChangedAt: OLD });

    const data = ok(await setStatus({ entryId, status: "watched" }));

    expect(data).toMatchObject({
      status: "watched",
      previousStatus: "to_watch",
      addedWatch: true,
      tickedCount: 0,
    });
    expect(data.undo).not.toBeNull();
    expect(await watchRows(entryId)).toEqual([{ id: expect.any(String), watchedOn: TODAY }]);
    expect((await entryRow(entryId))?.statusChangedAt.getTime()).toBeGreaterThan(OLD.getTime());
  });

  it("adds nothing when the Entry is already Watched", async () => {
    const { entryId } = await save("movie", TMDB.inception, "watched");
    await setEntryTimes(entryId, { statusChangedAt: OLD });

    expect(ok(await setStatus({ entryId, status: "watched" }))).toEqual({
      status: "watched",
      previousStatus: "watched",
      addedWatch: false,
      tickedCount: 0,
      undo: null,
    });
    expect(await watchRows(entryId)).toHaveLength(1);
    expect((await entryRow(entryId))?.statusChangedAt).toEqual(OLD);
  });

  it("ticks every aired numbered Episode when a Series moves to Watched", async () => {
    const { entryId } = await save("series", TMDB.breakingBad, "to_watch");
    expect(ok(await setStatus({ entryId, status: "watched" })).addedWatch).toBe(true);
    const ticks = await tickKeys(entryId);
    expect(ticks).toHaveLength(20);
    expect(ticks.some((key) => key.startsWith("0:"))).toBe(false);
    expect(await watchRows(entryId)).toEqual([{ id: expect.any(String), watchedOn: TODAY }]);
  });

  it("keeps the Watches when the Entry moves away from Watched", async () => {
    const { entryId } = await save("movie", TMDB.inception, "watched");
    expect(ok(await setStatus({ entryId, status: "dropped" }))).toMatchObject({
      status: "dropped",
      previousStatus: "watched",
      addedWatch: false,
      tickedCount: 0,
    });
    expect(await watchRows(entryId)).toHaveLength(1);
    expect((await entryRow(entryId))?.status).toBe("dropped");
  });
});

describe("watchAgain", () => {
  it("adds a Watch dated today and sets Watched", async () => {
    const { entryId } = await save("movie", TMDB.inception, "watched");
    ok(await setStatus({ entryId, status: "dropped" }));

    const { watch } = ok(await watchAgain({ entryId }));

    expect(watch).toEqual({ id: expect.any(String), watchedOn: TODAY });
    expect((await watchRows(entryId)).map((row) => row.watchedOn)).toEqual([null, TODAY]);
    expect((await entryRow(entryId))?.status).toBe("watched");
  });
});

describe("undoStatusMove", () => {
  /** Everything a Status move can change, with times to the microsecond. */
  async function snapshot(entryId: string) {
    const [row] = await db()
      .select({
        status: entries.status,
        statusChangedAt: sql<string>`${entries.statusChangedAt}::text`,
        progressMovedAt: sql<string | null>`${entries.progressMovedAt}::text`,
      })
      .from(entries)
      .where(eq(entries.id, entryId));
    return { ...row, watches: await watchRows(entryId), ticks: await tickKeys(entryId) };
  }

  /** An Entry in the given Status, with the Watches and ticks that real use leaves behind. */
  async function entryIn(kind: "movie" | "series", status: Status): Promise<string> {
    if (kind === "movie") {
      if (status !== "dropped") return (await save("movie", TMDB.inception, status)).entryId;
      const { entryId } = await save("movie", TMDB.inception, "watched");
      ok(await setStatus({ entryId, status: "dropped" }));
      return entryId;
    }
    if (status === "watched") return (await save("series", TMDB.breakingBad, "watched")).entryId;
    const { entryId } = await save("series", TMDB.breakingBad, "watching");
    ok(await tickEpisode({ entryId, seasonNumber: 1, episodeNumber: 1, watched: true }));
    ok(await tickEpisode({ entryId, seasonNumber: 0, episodeNumber: 2, watched: true }));
    if (status !== "watching") ok(await setStatus({ entryId, status }));
    return entryId;
  }

  function undoOf(move: { undo: StatusMoveUndo | null }): StatusMoveUndo {
    if (!move.undo) throw new Error("The move returned no undo");
    return move.undo;
  }

  async function expectRefused(entryId: string, undo: StatusMoveUndo) {
    const before = await snapshot(entryId);
    expect(failure(await undoStatusMove(undo))).toBe(MESSAGES.changedSince);
    expect(await snapshot(entryId)).toEqual(before);
  }

  const MOVES = STATUSES.flatMap((from) =>
    STATUSES.filter((to) => to !== from).map((to) => [from, to] as const),
  );

  describe.each(["movie", "series"] as const)("on a %s", (kind) => {
    it.each(MOVES)("puts everything back after %s to %s", async (from, to) => {
      const entryId = await entryIn(kind, from);
      const before = await snapshot(entryId);

      const move = ok(await setStatus({ entryId, status: to }));
      expect(move).toMatchObject({ status: to, previousStatus: from });
      expect(await snapshot(entryId)).not.toEqual(before);

      // The screen gets the payload through a Server Action, so it arrives as plain JSON.
      const undo = JSON.parse(JSON.stringify(undoOf(move))) as StatusMoveUndo;
      expect(ok(await undoStatusMove(undo))).toEqual({ status: from });
      expect(await snapshot(entryId)).toEqual(before);
    });

    it.each(STATUSES)("puts everything back after Watched again from %s", async (from) => {
      const entryId = await entryIn(kind, from);
      const before = await snapshot(entryId);

      const move = ok(await watchAgain({ entryId }));
      expect(move).toMatchObject({
        status: "watched",
        previousStatus: from,
        addedWatch: true,
        tickedCount: 0,
        watch: { watchedOn: TODAY },
      });

      expect(ok(await undoStatusMove(undoOf(move)))).toEqual({ status: from });
      expect(await snapshot(entryId)).toEqual(before);
    });
  });

  it("offers no Undo for a move that changed nothing", async () => {
    const movie = await entryIn("movie", "watching");
    expect(ok(await setStatus({ entryId: movie, status: "watching" }))).toEqual({
      status: "watching",
      previousStatus: "watching",
      addedWatch: false,
      tickedCount: 0,
      undo: null,
    });
    const series = await entryIn("series", "watched");
    expect(ok(await setStatus({ entryId: series, status: "watched" })).undo).toBeNull();
  });

  it("removes exactly the ticks and the Watch that Mark as watched added to a Series", async () => {
    const entryId = await entryIn("series", "watching");
    const before = await snapshot(entryId);
    expect(before.ticks).toEqual(["0:2", "1:1"]);

    const move = ok(await setStatus({ entryId, status: "watched" }));

    expect(move).toMatchObject({
      status: "watched",
      previousStatus: "watching",
      addedWatch: true,
      tickedCount: 19,
    });
    const ticks = await tickKeys(entryId);
    expect(ticks).toHaveLength(21);
    expect(ticks.filter((key) => key.startsWith("0:"))).toEqual(["0:2"]);
    expect(await watchRows(entryId)).toEqual([{ id: undoOf(move).addedWatchId, watchedOn: TODAY }]);

    ok(await undoStatusMove(undoOf(move)));

    expect(await snapshot(entryId)).toEqual(before);
  });

  it("leaves unaired Episodes out of Mark as watched and its Undo", async () => {
    const { entryId } = await save("series", TMDB.thePitt, "to_watch");
    const before = await snapshot(entryId);

    const move = ok(await setStatus({ entryId, status: "watched" }));
    expect(move.tickedCount).toBe(25);
    expect(await tickKeys(entryId)).not.toContain("2:11");

    ok(await undoStatusMove(undoOf(move)));
    expect(await snapshot(entryId)).toEqual(before);
  });

  it("keeps every tick when a Watched Series starts again, and Undo restores only Status and times", async () => {
    const entryId = await entryIn("series", "watched");
    const before = await snapshot(entryId);

    const move = ok(await setStatus({ entryId, status: "watching" }));
    expect(move).toMatchObject({ status: "watching", addedWatch: false, tickedCount: 0 });
    expect(await tickKeys(entryId)).toEqual(before.ticks);

    ok(await undoStatusMove(undoOf(move)));
    expect(await snapshot(entryId)).toEqual(before);
  });

  it("removes only the Watch that Watched again added", async () => {
    const entryId = await entryIn("movie", "watched");
    const before = await snapshot(entryId);

    const move = ok(await watchAgain({ entryId }));
    expect(undoOf(move)).toMatchObject({ addedWatchId: move.watch.id, watchCount: 2 });
    expect(await watchRows(entryId)).toHaveLength(2);

    ok(await undoStatusMove(undoOf(move)));
    expect(await snapshot(entryId)).toEqual(before);
  });

  it("undoes two moves in reverse order", async () => {
    const entryId = await entryIn("series", "watching");
    const before = await snapshot(entryId);
    const first = ok(await setStatus({ entryId, status: "dropped" }));
    const second = ok(await setStatus({ entryId, status: "watched" }));

    await expectRefused(entryId, undoOf(first));
    ok(await undoStatusMove(undoOf(second)));
    ok(await undoStatusMove(undoOf(first)));

    expect(await snapshot(entryId)).toEqual(before);
  });

  it("needs no TMDB call and re-renders the screen", async () => {
    const entryId = await entryIn("series", "to_watch");
    const before = await snapshot(entryId);
    const move = ok(await setStatus({ entryId, status: "watched" }));
    testState.tmdbDown = true;
    vi.mocked(refresh).mockClear();

    ok(await undoStatusMove(undoOf(move)));

    expect(await snapshot(entryId)).toEqual(before);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("still undoes after a Rating or a Note, and keeps them", async () => {
    const entryId = await entryIn("movie", "watching");
    const before = await snapshot(entryId);
    const move = ok(await setStatus({ entryId, status: "watched" }));
    ok(await setRating({ entryId, ratingHalfStars: 8 }));
    ok(await setNote({ entryId, note: "Loved it" }));

    ok(await undoStatusMove(undoOf(move)));

    expect(await snapshot(entryId)).toEqual(before);
    expect(await entryRow(entryId)).toMatchObject({ ratingHalfStars: 8, note: "Loved it" });
  });

  describe("refuses, and changes nothing, after a later change", () => {
    it("a second move", async () => {
      const entryId = await entryIn("movie", "watching");
      const first = ok(await setStatus({ entryId, status: "dropped" }));
      ok(await setStatus({ entryId, status: "to_watch" }));
      await expectRefused(entryId, undoOf(first));
    });

    it("a second move that ends on the same Status", async () => {
      const entryId = await entryIn("movie", "watching");
      const first = ok(await setStatus({ entryId, status: "dropped" }));
      ok(await setStatus({ entryId, status: "watching" }));
      ok(await setStatus({ entryId, status: "dropped" }));
      await expectRefused(entryId, undoOf(first));
    });

    it("a tick", async () => {
      const entryId = await entryIn("series", "to_watch");
      const start = ok(await setStatus({ entryId, status: "watching" }));
      ok(await tickEpisode({ entryId, seasonNumber: 1, episodeNumber: 2, watched: true }));
      await expectRefused(entryId, undoOf(start));
    });

    it("an untick", async () => {
      const { entryId } = await save("series", TMDB.westworld, "to_watch");
      const marked = ok(await setStatus({ entryId, status: "watched" }));
      ok(await tickEpisode({ entryId, seasonNumber: 1, episodeNumber: 1, watched: false }));
      await expectRefused(entryId, undoOf(marked));
    });

    it("Watched again, which moves no Status", async () => {
      const entryId = await entryIn("movie", "dropped");
      const marked = ok(await setStatus({ entryId, status: "watched" }));
      ok(await watchAgain({ entryId }));
      await expectRefused(entryId, undoOf(marked));
    });

    it("deleting the Watch the move added", async () => {
      const entryId = await entryIn("movie", "watched");
      const again = ok(await watchAgain({ entryId }));
      ok(await deleteWatch({ watchId: again.watch.id }));
      await expectRefused(entryId, undoOf(again));
    });
  });

  describe("refuses a replayed Undo", () => {
    it("after a Status move", async () => {
      const entryId = await entryIn("series", "watching");
      const before = await snapshot(entryId);
      const move = ok(await setStatus({ entryId, status: "watched" }));
      ok(await undoStatusMove(undoOf(move)));
      await expectRefused(entryId, undoOf(move));
      expect(await snapshot(entryId)).toEqual(before);
    });

    it("after Watched again, where only the Watches tell", async () => {
      const entryId = await entryIn("movie", "watched");
      const before = await snapshot(entryId);
      const move = ok(await watchAgain({ entryId }));
      ok(await undoStatusMove(undoOf(move)));
      await expectRefused(entryId, undoOf(move));
      expect(await snapshot(entryId)).toEqual(before);
    });

    it("when both arrive at once", async () => {
      const entryId = await entryIn("movie", "watched");
      const before = await snapshot(entryId);
      const move = ok(await watchAgain({ entryId }));

      const results = await Promise.all([
        undoStatusMove(undoOf(move)),
        undoStatusMove(undoOf(move)),
      ]);

      expect(results.filter((result) => result.ok)).toHaveLength(1);
      expect(results.filter((result) => !result.ok).map(failure)).toEqual([MESSAGES.changedSince]);
      expect(await snapshot(entryId)).toEqual(before);
    });
  });

  describe("refuses a forged payload", () => {
    it("for another Owner's Entry, or with another Owner's Watch", async () => {
      const entryId = await entryIn("series", "watching");
      const move = ok(await setStatus({ entryId, status: "watched" }));
      const after = await snapshot(entryId);

      signInAs(OWNER_B);
      expect(failure(await undoStatusMove(undoOf(move)))).toBe(MESSAGES.entryNotFound);
      const own = (await save("movie", TMDB.inception, "to_watch")).entryId;
      const ownMove = ok(await setStatus({ entryId: own, status: "watched" }));
      const forged = { ...undoOf(ownMove), addedWatchId: undoOf(move).addedWatchId };
      expect(failure(await undoStatusMove(forged))).toBe(MESSAGES.changedSince);

      expect(await snapshot(entryId)).toEqual(after);
    });

    it("with a Watch id the move did not add, or with none", async () => {
      const entryId = await entryIn("movie", "dropped");
      const [older] = await watchRows(entryId);
      const move = ok(await setStatus({ entryId, status: "watched" }));
      const after = await snapshot(entryId);

      for (const addedWatchId of [older!.id, "00000000-0000-4000-8000-000000000000", null]) {
        expect(failure(await undoStatusMove({ ...undoOf(move), addedWatchId }))).toBe(
          MESSAGES.changedSince,
        );
      }
      expect(await snapshot(entryId)).toEqual(after);
    });

    it("that points at the ticks of another Entry", async () => {
      const marked = await entryIn("series", "watching");
      const markedMove = ok(await setStatus({ entryId: marked, status: "watched" }));
      const { entryId: other } = await save("series", TMDB.westworld, "to_watch");
      const otherMove = ok(await setStatus({ entryId: other, status: "watching" }));
      const markedAfter = await snapshot(marked);

      const borrowed = { ...undoOf(markedMove), entryId: other };
      const stamped = {
        ...undoOf(otherMove),
        movedAt: undoOf(markedMove).movedAt,
        tickedCount: undoOf(markedMove).tickedCount,
      };
      await expectRefused(other, borrowed);
      await expectRefused(other, stamped);
      expect(await snapshot(marked)).toEqual(markedAfter);
    });

    it("that miscounts the ticks the move added", async () => {
      const entryId = await entryIn("series", "watching");
      const move = ok(await setStatus({ entryId, status: "watched" }));
      await expectRefused(entryId, { ...undoOf(move), tickedCount: 18 });
      await expectRefused(entryId, {
        ...undoOf(move),
        tickedCount: 0,
        previousProgressMovedAt: undoOf(move).movedAt,
      });
    });

    it.each([
      { movedAt: "2999-01-01T00:00:00.000000Z" },
      { previousStatusChangedAt: "2999-01-01T00:00:00.000000Z" },
      { previousProgressMovedAt: "2999-01-01T00:00:00.000000Z" },
      { movedAt: "2026-10-16T10:00:00.000Z" },
      { movedAt: "2026-10-16T10:00:00.000000+05:30" },
      { movedAt: "yesterday" },
      { movedAt: 1_600_000_000_000 },
      { previousStatusChangedAt: null },
      { status: "done" },
      { addedWatchId: "not-a-uuid" },
      { entryId: "1 or 1=1" },
      { tickedCount: -1 },
      { tickedCount: 1.5 },
      { watchCount: "1" },
      { watchCount: undefined },
      { extra: 1 },
    ])("with malformed input %j", async (fields) => {
      const entryId = await entryIn("movie", "watching");
      const move = ok(await setStatus({ entryId, status: "watched" }));
      const after = await snapshot(entryId);

      const input = { ...undoOf(move), ...fields };
      expect(failure(await undoStatusMove(input as never))).toBe(MESSAGES.invalid);
      expect(await snapshot(entryId)).toEqual(after);
    });
  });
});

describe("setWatchDate", () => {
  async function watchedMovie() {
    const { entryId } = await save("movie", TMDB.inception, "watched");
    const [watch] = await watchRows(entryId);
    return { entryId, watchId: watch!.id };
  }

  it("sets a past date, today, or date unknown", async () => {
    const { watchId } = await watchedMovie();
    expect(ok(await setWatchDate({ watchId, watchedOn: "2024-02-29" })).watch).toEqual({
      id: watchId,
      watchedOn: "2024-02-29",
    });
    expect(ok(await setWatchDate({ watchId, watchedOn: TODAY })).watch.watchedOn).toBe(TODAY);
    expect(ok(await setWatchDate({ watchId, watchedOn: null })).watch.watchedOn).toBeNull();
  });

  it("rejects a date after today or before 1900", async () => {
    const { entryId, watchId } = await watchedMovie();
    expect(failure(await setWatchDate({ watchId, watchedOn: "2026-10-17" }))).toBe(MESSAGES.watchDate);
    expect(failure(await setWatchDate({ watchId, watchedOn: "1899-12-31" }))).toBe(MESSAGES.watchDate);
    expect((await watchRows(entryId))[0]?.watchedOn).toBeNull();
  });

  it.each(["2026-02-30", "16/10/2026", "2026-1-1", "", "2026-10-16T00:00"])(
    "rejects the malformed date %j",
    async (watchedOn) => {
      const { watchId } = await watchedMovie();
      expect(failure(await setWatchDate({ watchId, watchedOn }))).toBe(MESSAGES.invalid);
    },
  );
});

describe("deleteWatch", () => {
  it("moves a Watched Entry to To watch when its last Watch goes", async () => {
    const { entryId } = await save("movie", TMDB.inception, "watched");
    const [watch] = await watchRows(entryId);
    expect(ok(await deleteWatch({ watchId: watch!.id }))).toEqual({ status: "to_watch" });
    expect((await entryRow(entryId))?.status).toBe("to_watch");
    expect(await watchRows(entryId)).toEqual([]);
  });

  it("keeps a Dropped Entry Dropped when its last Watch goes", async () => {
    const { entryId } = await save("movie", TMDB.inception, "watched");
    ok(await setStatus({ entryId, status: "dropped" }));
    const [watch] = await watchRows(entryId);
    expect(ok(await deleteWatch({ watchId: watch!.id }))).toEqual({ status: "dropped" });
  });

  it("keeps Watched while another Watch remains", async () => {
    const { entryId } = await save("movie", TMDB.inception, "watched");
    ok(await watchAgain({ entryId }));
    const [first] = await watchRows(entryId);
    expect(ok(await deleteWatch({ watchId: first!.id }))).toEqual({ status: "watched" });
    expect(await watchRows(entryId)).toHaveLength(1);
  });
});

describe("setRating", () => {
  it("refuses a Rating on a To watch Entry", async () => {
    const { entryId } = await save("movie", TMDB.inception, "to_watch");
    expect(failure(await setRating({ entryId, ratingHalfStars: 8 }))).toBe(MESSAGES.rateNotStarted);
    expect((await entryRow(entryId))?.ratingHalfStars).toBeNull();
  });

  it.each(["watching", "watched", "dropped"] as const)("rates a %s Entry", async (status) => {
    const { entryId } = await save("movie", TMDB.inception, status);
    expect(ok(await setRating({ entryId, ratingHalfStars: 7 }))).toEqual({ ratingHalfStars: 7 });
    expect((await entryRow(entryId))?.ratingHalfStars).toBe(7);
  });

  it("keeps the Rating when the Entry goes back to To watch, and can still clear it", async () => {
    const { entryId } = await save("movie", TMDB.inception, "watching");
    ok(await setRating({ entryId, ratingHalfStars: 10 }));
    ok(await setStatus({ entryId, status: "to_watch" }));
    expect((await entryRow(entryId))?.ratingHalfStars).toBe(10);

    expect(ok(await setRating({ entryId, ratingHalfStars: null }))).toEqual({ ratingHalfStars: null });
    expect((await entryRow(entryId))?.ratingHalfStars).toBeNull();
  });

  it.each([0, 11, 1.5, "8"])("rejects the Rating %j", async (ratingHalfStars) => {
    const { entryId } = await save("movie", TMDB.inception, "watched");
    const result = await setRating({ entryId, ratingHalfStars } as never);
    expect(failure(result)).toBe(MESSAGES.invalid);
  });
});

describe("setNote", () => {
  it("keeps line breaks, trims blank edges, and stores an empty Note as none", async () => {
    const { entryId } = await save("movie", TMDB.inception, "to_watch");
    expect(ok(await setNote({ entryId, note: "\n\n  Loved it\r\nso much  \n" }))).toEqual({
      note: "  Loved it\nso much",
    });
    expect(ok(await setNote({ entryId, note: "  \n " }))).toEqual({ note: null });
    expect((await entryRow(entryId))?.note).toBeNull();
  });

  it("accepts 1,000 characters, counting an emoji as one, and rejects 1,001", async () => {
    const { entryId } = await save("movie", TMDB.inception, "to_watch");
    expect(ok(await setNote({ entryId, note: "a".repeat(1000) })).note).toHaveLength(1000);
    expect(ok(await setNote({ entryId, note: "🎬".repeat(1000) })).note).toBe("🎬".repeat(1000));
    expect(failure(await setNote({ entryId, note: "a".repeat(1001) }))).toBe(MESSAGES.noteTooLong);
    expect(failure(await setNote({ entryId, note: "a".repeat(4001) }))).toBe(MESSAGES.invalid);
    expect((await entryRow(entryId))?.note).toBe("🎬".repeat(1000));
  });
});

describe("deleteEntry", () => {
  it("removes the Entry with its Watches and ticks, and keeps the shared Title", async () => {
    const { entryId } = await save("series", TMDB.westworld, "watched");
    expect(ok(await deleteEntry({ entryId }))).toBeNull();
    expect(await entryRow(entryId)).toBeNull();
    expect(await watchRows(entryId)).toEqual([]);
    expect(await tickKeys(entryId)).toEqual([]);
    expect(await db().select().from(titles).where(eq(titles.tmdbId, TMDB.westworld))).toHaveLength(1);

    expect(failure(await deleteEntry({ entryId }))).toBe(MESSAGES.entryNotFound);
  });
});

describe("ids", () => {
  it("rejects an id that is not a UUID before any query", async () => {
    expect(failure(await setStatus({ entryId: "1 or 1=1", status: "watched" }))).toBe(MESSAGES.invalid);
    expect(failure(await deleteWatch({ watchId: "not-a-uuid" }))).toBe(MESSAGES.invalid);
  });

  it("treats an unknown UUID like a missing Entry", async () => {
    const entryId = "00000000-0000-4000-8000-000000000000";
    expect(failure(await setStatus({ entryId, status: "watched" }))).toBe(MESSAGES.entryNotFound);
  });
});

describe("Owner B", () => {
  it("can neither read nor change Owner A's Entry or Watches through any action", async () => {
    const series = await save("series", TMDB.breakingBad, "watched");
    const movie = await save("movie", TMDB.inception, "watching");
    ok(await setRating({ entryId: movie.entryId, ratingHalfStars: 6 }));
    ok(await setNote({ entryId: movie.entryId, note: "Owner A's note" }));
    const [watch] = await watchRows(series.entryId);
    const watchId = watch!.id;
    const ticksBefore = await tickKeys(series.entryId);

    signInAs(OWNER_B);
    const attempts: ActionResult<unknown>[] = [
      await setStatus({ entryId: series.entryId, status: "dropped" }),
      await setStatus({ entryId: movie.entryId, status: "watched" }),
      await watchAgain({ entryId: series.entryId }),
      await setWatchDate({ watchId, watchedOn: "2020-01-01" }),
      await deleteWatch({ watchId }),
      await setRating({ entryId: movie.entryId, ratingHalfStars: 1 }),
      await setNote({ entryId: movie.entryId, note: "Owner B was here" }),
      await deleteEntry({ entryId: movie.entryId }),
      await deleteEntry({ entryId: series.entryId }),
    ];
    for (const attempt of attempts) expect(failure(attempt)).toBe(MESSAGES.entryNotFound);

    expect(await entryRow(series.entryId)).toMatchObject({ status: "watched", userId: OWNER_A.id });
    expect(await entryRow(movie.entryId)).toMatchObject({
      status: "watching",
      ratingHalfStars: 6,
      note: "Owner A's note",
    });
    expect(await watchRows(series.entryId)).toEqual([{ id: watchId, watchedOn: null }]);
    expect(await tickKeys(series.entryId)).toEqual(ticksBefore);
  });

  it("gets an Entry of their own when saving a Title Owner A has", async () => {
    const a = await save("movie", TMDB.inception, "watched");
    signInAs(OWNER_B);
    const b = await save("movie", TMDB.inception, "to_watch");

    expect(b.created).toBe(true);
    expect(b.entryId).not.toBe(a.entryId);
    expect(await entryRow(a.entryId)).toMatchObject({ status: "watched", userId: OWNER_A.id });
    const [own] = await db()
      .select({ n: count() })
      .from(entries)
      .where(and(eq(entries.userId, OWNER_B.id), eq(entries.status, "to_watch")));
    expect(own?.n).toBe(1);
  });

  it("cannot reach Owner A's Watch through an Entry of their own", async () => {
    const { entryId } = await save("movie", TMDB.inception, "watched");
    const [watch] = await watchRows(entryId);
    signInAs(OWNER_B);
    await insertEntry({ owner: OWNER_B, status: "watched" });
    expect(failure(await deleteWatch({ watchId: watch!.id }))).toBe(MESSAGES.entryNotFound);
    expect(await watchRows(entryId)).toHaveLength(1);
  });
});
