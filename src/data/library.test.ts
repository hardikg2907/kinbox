import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { closeDb, db } from "@/db/client";
import { watches } from "@/db/schema";
import { insertEntry, resetDatabase } from "@/test/db";
import { OWNER_A, OWNER_B, resetTestState, signInAs, testState, TMDB } from "@/test/mocks";
import { saveTitle } from "./entries";
import { getLibrary } from "./library";
import { markEarlier, tickEpisode } from "./progress";

vi.mock("@/data/session", async () => (await import("@/test/mocks")).sessionModule());
vi.mock("@/data/today", async () => (await import("@/test/mocks")).todayModule());
vi.mock("@/lib/tmdb/cached", async () => (await import("@/test/mocks")).tmdbCachedModule());
vi.mock("next/server", async () => (await import("@/test/mocks")).nextServerModule());

const at = (iso: string) => new Date(`${iso}T12:00:00Z`);

async function names(tab: "to_watch" | "watching" | "watched" | "dropped") {
  return (await getLibrary({ tab, kind: "all" })).cards.map((card) => card.name);
}

async function addWatches(entryId: string, dates: (string | null)[]): Promise<void> {
  await db()
    .insert(watches)
    .values(dates.map((watchedOn) => ({ entryId, watchedOn })));
}

/** Two Entries that tie on every ordered field come back in id order. */
function byId(...entries: { name: string; entryId: string }[]): string[] {
  return [...entries]
    .sort((a, b) => (a.entryId < b.entryId ? -1 : a.entryId > b.entryId ? 1 : 0))
    .map((entry) => entry.name);
}

beforeEach(async () => {
  resetTestState();
  await resetDatabase();
});

afterAll(async () => {
  await closeDb();
});

describe("getLibrary order", () => {
  it("lists To watch by date added, newest first", async () => {
    await insertEntry({ owner: OWNER_A, status: "to_watch", name: "Old", createdAt: at("2026-01-01") });
    const b = await insertEntry({ owner: OWNER_A, status: "to_watch", name: "TieB", createdAt: at("2026-03-01") });
    const c = await insertEntry({ owner: OWNER_A, status: "to_watch", name: "TieC", createdAt: at("2026-03-01") });

    expect(await names("to_watch")).toEqual([
      ...byId({ name: "TieB", ...b }, { name: "TieC", ...c }),
      "Old",
    ]);
  });

  it("lists Watching by when progress last moved, or the Status changed when it never moved", async () => {
    await insertEntry({ owner: OWNER_A, status: "watching", name: "Started May", statusChangedAt: at("2026-05-01") });
    await insertEntry({
      owner: OWNER_A,
      status: "watching",
      name: "Moved June",
      statusChangedAt: at("2026-01-01"),
      progressMovedAt: at("2026-06-01"),
      createdAt: at("2026-01-01"),
    });
    await insertEntry({
      owner: OWNER_A,
      status: "watching",
      name: "Moved June, added later",
      statusChangedAt: at("2026-01-01"),
      progressMovedAt: at("2026-06-01"),
      createdAt: at("2026-02-01"),
    });
    await insertEntry({ owner: OWNER_A, status: "watching", name: "Started July", statusChangedAt: at("2026-07-01") });

    expect(await names("watching")).toEqual([
      "Started July",
      "Moved June, added later",
      "Moved June",
      "Started May",
    ]);
  });

  it("lists Watched by the latest Watch date, ties by Status change, date unknown last", async () => {
    const a = await insertEntry({ owner: OWNER_A, status: "watched", name: "A", statusChangedAt: at("2026-01-01") });
    const b = await insertEntry({ owner: OWNER_A, status: "watched", name: "B unknown", statusChangedAt: at("2026-01-01") });
    const c = await insertEntry({ owner: OWNER_A, status: "watched", name: "C", statusChangedAt: at("2026-03-01") });
    const d = await insertEntry({ owner: OWNER_A, status: "watched", name: "D", statusChangedAt: at("2026-01-01") });
    const e = await insertEntry({ owner: OWNER_A, status: "watched", name: "E unknown", statusChangedAt: at("2026-02-01") });
    await addWatches(a.entryId, ["2025-01-01", "2026-02-01"]);
    await addWatches(b.entryId, [null]);
    await addWatches(c.entryId, ["2026-02-01"]);
    await addWatches(d.entryId, [null, "2024-05-05"]);
    await addWatches(e.entryId, [null]);

    const view = await getLibrary({ tab: "watched", kind: "all" });

    expect(view.cards.map((card) => [card.name, card.latestWatchOn])).toEqual([
      ["C", "2026-02-01"],
      ["A", "2026-02-01"],
      ["D", "2024-05-05"],
      ["E unknown", null],
      ["B unknown", null],
    ]);
  });

  it("lists Dropped by date changed", async () => {
    await insertEntry({ owner: OWNER_A, status: "dropped", name: "Early", statusChangedAt: at("2026-01-01") });
    await insertEntry({ owner: OWNER_A, status: "dropped", name: "Late", statusChangedAt: at("2026-09-01") });
    expect(await names("dropped")).toEqual(["Late", "Early"]);
  });
});

describe("getLibrary counts and filter", () => {
  it("counts each Status within the kind filter and shows only the Owner's Entries", async () => {
    await insertEntry({ owner: OWNER_A, status: "to_watch" });
    await insertEntry({ owner: OWNER_A, status: "to_watch" });
    await insertEntry({ owner: OWNER_A, status: "watched" });
    await insertEntry({ owner: OWNER_A, status: "watching", kind: "series" });
    await insertEntry({ owner: OWNER_A, status: "dropped", kind: "series" });
    await insertEntry({ owner: OWNER_B, status: "to_watch", name: "Owner B's" });
    await insertEntry({ owner: OWNER_B, status: "watching", kind: "series" });

    const all = await getLibrary({ tab: "to_watch", kind: "all" });
    expect(all.counts).toEqual({ to_watch: 2, watching: 1, watched: 1, dropped: 1 });
    expect(all.cards).toHaveLength(2);
    expect(all.cards.map((card) => card.name)).not.toContain("Owner B's");

    const movies = await getLibrary({ tab: "to_watch", kind: "movie" });
    expect(movies.counts).toEqual({ to_watch: 2, watching: 0, watched: 1, dropped: 0 });

    const series = await getLibrary({ tab: "to_watch", kind: "series" });
    expect(series.counts).toEqual({ to_watch: 0, watching: 1, watched: 0, dropped: 1 });
    expect(series.cards).toEqual([]);
  });

  it("shows Owner B an empty Library when only Owner A has Entries", async () => {
    await insertEntry({ owner: OWNER_A, status: "to_watch" });
    signInAs(OWNER_B);
    const view = await getLibrary({ tab: "to_watch", kind: "all" });
    expect(view.counts).toEqual({ to_watch: 0, watching: 0, watched: 0, dropped: 0 });
    expect(view.cards).toEqual([]);
  });

  it("rejects a tab or filter that is not one of the known values", async () => {
    await expect(getLibrary({ tab: "later", kind: "all" } as never)).rejects.toThrow();
    await expect(getLibrary({ tab: "to_watch", kind: "people" } as never)).rejects.toThrow();
  });
});

describe("getLibrary Watching cards", () => {
  it("shows Next or caught up for each Series, and keeps the page when TMDB fails for one", async () => {
    const ended = await saveTitle(OWNER_A, { kind: "series", tmdbId: TMDB.breakingBad, status: "watching" });
    await markEarlier(OWNER_A, { entryId: ended.entryId, seasonNumber: 1, episodeNumber: 4 });
    const ongoing = await saveTitle(OWNER_A, { kind: "series", tmdbId: TMDB.thePitt, status: "watching" });
    await markEarlier(OWNER_A, { entryId: ongoing.entryId, seasonNumber: 2, episodeNumber: 11 });
    const westworld = await saveTitle(OWNER_A, { kind: "series", tmdbId: TMDB.westworld, status: "watching" });
    await tickEpisode(OWNER_A, {
      entryId: westworld.entryId,
      seasonNumber: 1,
      episodeNumber: 1,
      watched: true,
    });
    await saveTitle(OWNER_A, { kind: "movie", tmdbId: TMDB.inception, status: "watching" });

    testState.tmdbDownFor.add(TMDB.westworld);
    const view = await getLibrary({ tab: "watching", kind: "all" });
    const byName = new Map(view.cards.map((card) => [card.name, card.progress]));

    expect(byName.get("Breaking Bad")).toEqual({
      next: { seasonNumber: 1, episodeNumber: 4, name: expect.any(String), label: "S1 E4" },
      caughtUp: false,
      allNumberedWatched: false,
    });
    expect(byName.get("The Pitt (fixture)")).toEqual({
      next: null,
      caughtUp: true,
      allNumberedWatched: false,
    });
    expect(byName.get("Westworld")).toBeNull();
    expect(byName.get("Inception")).toBeNull();
    expect(view.cards.every((card) => card.latestWatchOn === null)).toBe(true);
  });
});
