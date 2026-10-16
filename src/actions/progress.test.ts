import { refresh } from "next/cache";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { ActionResult, ProgressChange } from "@/data/dto";
import { MESSAGES } from "@/data/errors";
import type { Status } from "@/domain/types";
import { closeDb } from "@/db/client";
import { entryRow, resetDatabase, setEntryTimes, tickKeys, watchRows } from "@/test/db";
import { OWNER_B, resetTestState, signInAs, testState, TMDB, TODAY } from "@/test/mocks";
import { saveTitle, setStatus } from "./entries";
import {
  markEarlier,
  markSeason,
  setNextToWatch,
  tickEpisode,
  undoWatchedNext,
  watchedNext,
} from "./progress";

vi.mock("@/data/session", async () => (await import("@/test/mocks")).sessionModule());
vi.mock("@/data/today", async () => (await import("@/test/mocks")).todayModule());
vi.mock("@/lib/tmdb/cached", async () => (await import("@/test/mocks")).tmdbCachedModule());
vi.mock("next/cache", async () => (await import("@/test/mocks")).nextCacheModule());
vi.mock("next/server", async () => (await import("@/test/mocks")).nextServerModule());

const OLD = new Date("2020-01-01T00:00:00Z");

function ok<T>(result: ActionResult<T>): T {
  if (!result.ok) throw new Error(`Expected success, got: ${result.error}`);
  return result.data;
}

function failure(result: ActionResult<unknown>): string {
  if (result.ok) throw new Error("Expected a failure");
  return result.error;
}

async function saveSeries(tmdbId: number, status: Status): Promise<string> {
  return ok(await saveTitle({ kind: "series", tmdbId, status })).entryId;
}

function tick(entryId: string, seasonNumber: number, episodeNumber: number, watched = true) {
  return tickEpisode({ entryId, seasonNumber, episodeNumber, watched });
}

/** Westworld with every Episode but the last one ticked. */
async function westworldOneLeft(): Promise<string> {
  const entryId = await saveSeries(TMDB.westworld, "watching");
  ok(await markEarlier({ entryId, seasonNumber: 2, episodeNumber: 10 }));
  return entryId;
}

beforeEach(async () => {
  resetTestState();
  vi.mocked(refresh).mockClear();
  await resetDatabase();
});

afterAll(async () => {
  await closeDb();
});

describe("tickEpisode", () => {
  it("moves a To watch Entry to Watching and records that progress moved", async () => {
    const entryId = await saveSeries(TMDB.breakingBad, "to_watch");
    await setEntryTimes(entryId, { statusChangedAt: OLD, progressMovedAt: OLD });

    const change = ok(await tick(entryId, 1, 1));

    expect(change).toMatchObject({
      status: "watching",
      statusChanged: true,
      addedWatch: false,
      earlierUnwatchedCount: 0,
      undo: null,
    });
    expect(change.progress.next).toEqual({
      seasonNumber: 1,
      episodeNumber: 2,
      name: expect.any(String),
      label: "S1 E2",
    });
    const row = await entryRow(entryId);
    expect(row?.status).toBe("watching");
    expect(row?.statusChangedAt.getTime()).toBeGreaterThan(OLD.getTime());
    expect(row?.progressMovedAt?.getTime()).toBeGreaterThan(OLD.getTime());
    expect(refresh).toHaveBeenCalled();
  });

  it("moves a Dropped Entry back to Watching", async () => {
    const entryId = await saveSeries(TMDB.breakingBad, "watching");
    ok(await setStatus({ entryId, status: "dropped" }));
    const change = ok(await tick(entryId, 1, 4));
    expect(change).toMatchObject({ status: "watching", statusChanged: true });
  });

  it("counts the unwatched numbered Episodes before the ticked one, and none for a Special", async () => {
    const entryId = await saveSeries(TMDB.breakingBad, "watching");
    expect(ok(await tick(entryId, 2, 3)).earlierUnwatchedCount).toBe(9);
    expect(ok(await tick(entryId, 1, 7)).earlierUnwatchedCount).toBe(6);
    expect(ok(await tick(entryId, 0, 1)).earlierUnwatchedCount).toBe(0);
  });

  it.each([
    ["Canceled", TMDB.westworld, 2, 10],
    ["Ended", TMDB.breakingBad, 2, 13],
  ])("moves a %s Series to Watched with one Watch when its last Episode is ticked", async (_, tmdbId, s, e) => {
    const entryId = await saveSeries(tmdbId, "watching");
    ok(await markEarlier({ entryId, seasonNumber: s, episodeNumber: e }));
    expect((await entryRow(entryId))?.status).toBe("watching");

    const change = ok(await tick(entryId, s, e));

    expect(change).toMatchObject({ status: "watched", statusChanged: true, addedWatch: true });
    expect(change.progress).toMatchObject({
      finished: true,
      allNumberedWatched: true,
      caughtUp: false,
      next: null,
    });
    expect(await watchRows(entryId)).toEqual([{ id: expect.any(String), watchedOn: TODAY }]);
  });

  it("adds no Watch when ticking again after Watched", async () => {
    const entryId = await westworldOneLeft();
    ok(await tick(entryId, 2, 10));

    const again = ok(await tick(entryId, 2, 10));
    ok(await tick(entryId, 1, 1, false));
    const retick = ok(await tick(entryId, 1, 1));

    for (const change of [again, retick]) {
      expect(change).toMatchObject({ status: "watched", statusChanged: false, addedWatch: false });
    }
    expect(await watchRows(entryId)).toHaveLength(1);
  });

  it("leaves an ongoing Series Watching and caught up when every aired Episode is ticked", async () => {
    const entryId = await saveSeries(TMDB.thePitt, "to_watch");
    const change = ok(await markEarlier({ entryId, seasonNumber: 2, episodeNumber: 11 }));
    expect(change).toMatchObject({ status: "watching", addedWatch: false });
    expect(change.progress).toMatchObject({ caughtUp: true, next: null, finished: false });
    expect(await watchRows(entryId)).toEqual([]);
  });

  it("never changes the Status or removes a Watch when unticking", async () => {
    const entryId = await westworldOneLeft();
    ok(await tick(entryId, 2, 10));
    await setEntryTimes(entryId, { progressMovedAt: OLD });

    const change = ok(await tick(entryId, 2, 10, false));

    expect(change).toMatchObject({ status: "watched", statusChanged: false, addedWatch: false });
    expect(await tickKeys(entryId)).not.toContain("2:10");
    expect(await watchRows(entryId)).toHaveLength(1);
    expect((await entryRow(entryId))?.progressMovedAt?.getTime()).toBeGreaterThan(OLD.getTime());

    const toWatch = await saveSeries(TMDB.breakingBad, "watching");
    ok(await tick(toWatch, 1, 1));
    ok(await setStatus({ entryId: toWatch, status: "to_watch" }));
    expect(ok(await tick(toWatch, 1, 1, false)).status).toBe("to_watch");
  });

  it("rejects an Episode TMDB does not list", async () => {
    const entryId = await saveSeries(TMDB.breakingBad, "watching");
    expect(failure(await tick(entryId, 1, 99))).toBe(MESSAGES.episodeNotFound);
    expect(failure(await tick(entryId, 3, 1))).toBe(MESSAGES.episodeNotFound);
    expect(await tickKeys(entryId)).toEqual([]);
  });

  it("rejects ticks on a Movie", async () => {
    const { entryId } = ok(await saveTitle({ kind: "movie", tmdbId: TMDB.inception, status: "watching" }));
    expect(failure(await tick(entryId, 1, 1))).toBe(MESSAGES.notSeries);
  });

  it("leaves one row and one Watch when the same tick arrives twice at once", async () => {
    const entryId = await westworldOneLeft();

    const results = (await Promise.all([tick(entryId, 2, 10), tick(entryId, 2, 10)])).map(ok);

    expect(await tickKeys(entryId)).toHaveLength(20);
    expect(await watchRows(entryId)).toHaveLength(1);
    expect(results.filter((change) => change.addedWatch)).toHaveLength(1);
    expect(results.every((change) => change.status === "watched")).toBe(true);
  });

  it("finishes the Series when its last two Episodes are ticked at once", async () => {
    const entryId = await saveSeries(TMDB.westworld, "watching");
    ok(await markEarlier({ entryId, seasonNumber: 2, episodeNumber: 9 }));

    await Promise.all([tick(entryId, 2, 9), tick(entryId, 2, 10)]);

    expect((await entryRow(entryId))?.status).toBe("watched");
    expect(await watchRows(entryId)).toHaveLength(1);
  });

  it("writes nothing when TMDB cannot be reached", async () => {
    const entryId = await saveSeries(TMDB.breakingBad, "to_watch");
    testState.tmdbDown = true;
    expect(failure(await tick(entryId, 1, 1))).toBe(MESSAGES.tmdbDown);
    expect(await tickKeys(entryId)).toEqual([]);
    expect((await entryRow(entryId))?.status).toBe("to_watch");
  });

  it.each([
    { seasonNumber: 1, episodeNumber: 0, watched: true },
    { seasonNumber: -1, episodeNumber: 1, watched: true },
    { seasonNumber: 1001, episodeNumber: 1, watched: true },
    { seasonNumber: 1, episodeNumber: 10001, watched: true },
    { seasonNumber: 1, episodeNumber: 1.5, watched: true },
    { seasonNumber: 1, episodeNumber: 1, watched: "yes" },
    { seasonNumber: 1, episodeNumber: 1, watched: true, tmdbEpisodeId: 1 },
  ])("rejects malformed input %j", async (fields) => {
    const entryId = await saveSeries(TMDB.breakingBad, "watching");
    expect(failure(await tickEpisode({ entryId, ...fields } as never))).toBe(MESSAGES.invalid);
  });
});

describe("markEarlier", () => {
  it("ticks only the unwatched numbered Episodes before the given one", async () => {
    const entryId = await saveSeries(TMDB.breakingBad, "to_watch");
    ok(await tick(entryId, 0, 2));
    ok(await setStatus({ entryId, status: "to_watch" }));

    const change = ok(await markEarlier({ entryId, seasonNumber: 2, episodeNumber: 2 }));

    expect(change).toMatchObject({ status: "watching", statusChanged: true, earlierUnwatchedCount: 0 });
    expect(await tickKeys(entryId)).toEqual(["0:2", "1:1", "1:2", "1:3", "1:4", "1:5", "1:6", "1:7", "2:1"]);
    expect(change.progress.next?.label).toBe("S2 E2");
  });
});

describe("markSeason", () => {
  it("ticks every aired Episode of the Season and skips unaired ones", async () => {
    const entryId = await saveSeries(TMDB.thePitt, "to_watch");
    const change = ok(await markSeason({ entryId, seasonNumber: 2, watched: true }));
    expect(change.status).toBe("watching");
    expect(await tickKeys(entryId)).toEqual(Array.from({ length: 10 }, (_, i) => `2:${i + 1}`));
    const season2 = change.progress.seasons.find((season) => season.seasonNumber === 2);
    expect(season2).toMatchObject({ episodeCount: 16, airedCount: 10, watchedCount: 10 });
  });

  it("ticks Specials without moving Next", async () => {
    const entryId = await saveSeries(TMDB.breakingBad, "watching");
    const change = ok(await markSeason({ entryId, seasonNumber: 0, watched: true }));
    expect((await tickKeys(entryId)).filter((key) => key.startsWith("0:"))).toHaveLength(9);
    expect(change.progress.next?.label).toBe("S1 E1");
    expect(change.progress.watchedCount).toBe(0);
  });

  it("unticks the whole Season and leaves the Status alone", async () => {
    const entryId = await saveSeries(TMDB.breakingBad, "watched");
    const change = ok(await markSeason({ entryId, seasonNumber: 1, watched: false }));
    expect(change).toMatchObject({ status: "watched", statusChanged: false });
    expect(await tickKeys(entryId)).toHaveLength(13);
    expect(await watchRows(entryId)).toHaveLength(1);
  });

  it("rejects a Season TMDB does not list", async () => {
    const entryId = await saveSeries(TMDB.breakingBad, "watching");
    expect(failure(await markSeason({ entryId, seasonNumber: 5, watched: true }))).toBe(
      MESSAGES.seasonNotFound,
    );
  });
});

describe("watchedNext", () => {
  it("ticks Next, moves Next on, and returns what Undo needs", async () => {
    const entryId = await saveSeries(TMDB.breakingBad, "watching");

    const first = ok(await watchedNext({ entryId }));
    expect(first.undo).toEqual({
      seasonNumber: 1,
      episodeNumber: 1,
      previousStatus: "watching",
      addedWatchId: null,
    });
    expect(first.progress.next?.label).toBe("S1 E2");

    const second = ok(await watchedNext({ entryId }));
    expect(second.undo).toMatchObject({ seasonNumber: 1, episodeNumber: 2 });
    expect(await tickKeys(entryId)).toEqual(["1:1", "1:2"]);
  });

  it("ticks two Episodes in order when two taps arrive at once", async () => {
    const entryId = await saveSeries(TMDB.breakingBad, "watching");
    await Promise.all([watchedNext({ entryId }), watchedNext({ entryId })]);
    expect(await tickKeys(entryId)).toEqual(["1:1", "1:2"]);
  });

  it("says when the Owner is caught up", async () => {
    const ongoing = await saveSeries(TMDB.thePitt, "watching");
    ok(await markEarlier({ entryId: ongoing, seasonNumber: 2, episodeNumber: 11 }));
    expect(failure(await watchedNext({ entryId: ongoing }))).toBe(MESSAGES.caughtUp);

    const finished = await saveSeries(TMDB.westworld, "watched");
    expect(failure(await watchedNext({ entryId: finished }))).toBe(MESSAGES.caughtUp);
  });

  it("finishes a finished Series and hands back the Watch it added", async () => {
    const entryId = await westworldOneLeft();
    const change = ok(await watchedNext({ entryId }));
    const [watch] = await watchRows(entryId);
    expect(change).toMatchObject({ status: "watched", statusChanged: true, addedWatch: true });
    expect(change.undo).toEqual({
      seasonNumber: 2,
      episodeNumber: 10,
      previousStatus: "watching",
      addedWatchId: watch!.id,
    });
  });
});

describe("undoWatchedNext", () => {
  async function undoOf(entryId: string): Promise<ProgressChange> {
    const change = ok(await watchedNext({ entryId }));
    if (!change.undo) throw new Error("watchedNext returned no undo");
    return ok(await undoWatchedNext({ entryId, ...change.undo }));
  }

  it("unticks the Episode after a plain tick", async () => {
    const entryId = await saveSeries(TMDB.breakingBad, "watching");
    const change = await undoOf(entryId);
    expect(change).toMatchObject({ status: "watching", statusChanged: false, undo: null });
    expect(change.progress.next?.label).toBe("S1 E1");
    expect(await tickKeys(entryId)).toEqual([]);
  });

  it("puts a To watch Entry back to To watch", async () => {
    const entryId = await saveSeries(TMDB.breakingBad, "to_watch");
    await setEntryTimes(entryId, { statusChangedAt: OLD });
    const change = await undoOf(entryId);
    expect(change).toMatchObject({ status: "to_watch", statusChanged: true });
    const row = await entryRow(entryId);
    expect(row?.status).toBe("to_watch");
    expect(row?.statusChangedAt.getTime()).toBeGreaterThan(OLD.getTime());
  });

  it("removes the Watch and restores the Status after finishing a finished Series", async () => {
    const entryId = await westworldOneLeft();
    const change = await undoOf(entryId);
    expect(change).toMatchObject({ status: "watching", statusChanged: true, addedWatch: false });
    expect(await watchRows(entryId)).toEqual([]);
    expect(await tickKeys(entryId)).toHaveLength(19);
  });

  it("never restores Watched when no Watch is left", async () => {
    const entryId = await saveSeries(TMDB.breakingBad, "watching");
    const change = ok(
      await undoWatchedNext({
        entryId,
        seasonNumber: 1,
        episodeNumber: 1,
        previousStatus: "watched",
        addedWatchId: null,
      }),
    );
    expect(change.status).toBe("to_watch");
  });

  it.each([
    { previousStatus: "done", addedWatchId: null },
    { previousStatus: "watching", addedWatchId: "not-a-uuid" },
    { previousStatus: "watching", addedWatchId: null, extra: 1 },
  ])("rejects malformed input %j", async (fields) => {
    const entryId = await saveSeries(TMDB.breakingBad, "watching");
    const input = { entryId, seasonNumber: 1, episodeNumber: 1, ...fields };
    expect(failure(await undoWatchedNext(input as never))).toBe(MESSAGES.invalid);
  });

  it("does not let Owner B undo on Owner A's Entry or delete Owner A's Watch", async () => {
    const entryA = await westworldOneLeft();
    const changeA = ok(await watchedNext({ entryId: entryA }));
    const watchA = changeA.undo!.addedWatchId!;

    signInAs(OWNER_B);
    expect(failure(await undoWatchedNext({ entryId: entryA, ...changeA.undo! }))).toBe(
      MESSAGES.entryNotFound,
    );

    const entryB = await saveSeries(TMDB.westworld, "watching");
    const changeB = ok(await watchedNext({ entryId: entryB }));
    ok(await undoWatchedNext({ entryId: entryB, ...changeB.undo!, addedWatchId: watchA }));

    expect(await watchRows(entryA)).toEqual([{ id: watchA, watchedOn: TODAY }]);
    expect((await entryRow(entryA))?.status).toBe("watched");
    expect(await tickKeys(entryA)).toHaveLength(20);
  });
});

describe("setNextToWatch", () => {
  it("ticks the numbered Episodes before the pick, so the pick becomes Next", async () => {
    const entryId = await saveSeries(TMDB.breakingBad, "watching");
    const change = ok(await setNextToWatch({ entryId, seasonNumber: 2, episodeNumber: 4 }));
    expect(change.progress.next?.label).toBe("S2 E4");
    expect(change.status).toBe("watching");
    const ticks = await tickKeys(entryId);
    expect(ticks).toHaveLength(10);
    expect(ticks).not.toContain("2:4");
    expect(ticks.some((key) => key.startsWith("0:"))).toBe(false);
  });

  it("ticks nothing for the first Episode", async () => {
    const entryId = await saveSeries(TMDB.breakingBad, "watching");
    const change = ok(await setNextToWatch({ entryId, seasonNumber: 1, episodeNumber: 1 }));
    expect(change.progress.next?.label).toBe("S1 E1");
    expect(await tickKeys(entryId)).toEqual([]);
  });

  it("rejects a Special", async () => {
    const entryId = await saveSeries(TMDB.breakingBad, "watching");
    expect(failure(await setNextToWatch({ entryId, seasonNumber: 0, episodeNumber: 1 }))).toBe(
      MESSAGES.episodeNotFound,
    );
  });
});

describe("Owner B", () => {
  it("cannot change Owner A's ticks or Status through any progress action", async () => {
    const entryId = await saveSeries(TMDB.breakingBad, "watching");
    ok(await tick(entryId, 1, 1));
    const before = await tickKeys(entryId);

    signInAs(OWNER_B);
    const attempts = [
      await tick(entryId, 1, 2),
      await tick(entryId, 1, 1, false),
      await markEarlier({ entryId, seasonNumber: 2, episodeNumber: 1 }),
      await markSeason({ entryId, seasonNumber: 1, watched: true }),
      await markSeason({ entryId, seasonNumber: 1, watched: false }),
      await watchedNext({ entryId }),
      await setNextToWatch({ entryId, seasonNumber: 2, episodeNumber: 1 }),
      await undoWatchedNext({
        entryId,
        seasonNumber: 1,
        episodeNumber: 1,
        previousStatus: "to_watch",
        addedWatchId: null,
      }),
    ];
    for (const attempt of attempts) expect(failure(attempt)).toBe(MESSAGES.entryNotFound);

    expect(await tickKeys(entryId)).toEqual(before);
    expect((await entryRow(entryId))?.status).toBe("watching");
  });
});
