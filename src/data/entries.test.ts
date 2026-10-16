import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { closeDb, db } from "@/db/client";
import { titles, watches } from "@/db/schema";
import { resetDatabase } from "@/test/db";
import { flushAfter, OWNER_A, OWNER_B, resetTestState, signInAs, testState, TMDB } from "@/test/mocks";
import { getEntry, saveTitle, setNote, setRating } from "./entries";
import { tickEpisode } from "./progress";

vi.mock("@/data/session", async () => (await import("@/test/mocks")).sessionModule());
vi.mock("@/data/today", async () => (await import("@/test/mocks")).todayModule());
vi.mock("@/lib/tmdb/cached", async () => (await import("@/test/mocks")).tmdbCachedModule());
vi.mock("next/server", async () => (await import("@/test/mocks")).nextServerModule());

beforeEach(async () => {
  resetTestState();
  await resetDatabase();
});

afterAll(async () => {
  await closeDb();
});

describe("getEntry", () => {
  it("returns a Movie with TMDB's overview and runtime, Watches newest first and date unknown last", async () => {
    const { entryId } = await saveTitle(OWNER_A, { kind: "movie", tmdbId: TMDB.inception, status: "watched" });
    await db()
      .insert(watches)
      .values([
        { entryId, watchedOn: "2024-01-01" },
        { entryId, watchedOn: "2026-05-05" },
        { entryId, watchedOn: null },
      ]);
    await setRating(OWNER_A, { entryId, ratingHalfStars: 9 });
    await setNote(OWNER_A, { entryId, note: "Again soon" });

    const view = await getEntry(entryId);

    expect(view).toMatchObject({
      id: entryId,
      status: "watched",
      ratingHalfStars: 9,
      canRate: true,
      note: "Again soon",
      title: { kind: "movie", tmdbId: TMDB.inception, name: "Inception", year: 2010, runtimeMinutes: 148 },
      series: null,
      tmdbUnavailable: false,
    });
    expect(view?.title.overview).toEqual(expect.any(String));
    expect(view?.watches.map((watch) => watch.watchedOn)).toEqual(["2026-05-05", "2024-01-01", null, null]);
  });

  it("returns a Series with its progress, Specials listed last", async () => {
    const { entryId } = await saveTitle(OWNER_A, { kind: "series", tmdbId: TMDB.breakingBad, status: "to_watch" });
    await tickEpisode(OWNER_A, { entryId, seasonNumber: 1, episodeNumber: 1, watched: true });

    const view = await getEntry(entryId);

    expect(view?.canRate).toBe(true);
    expect(view?.title.runtimeMinutes).toBeNull();
    expect(view?.series).toMatchObject({
      finished: true,
      next: { seasonNumber: 1, episodeNumber: 2, label: "S1 E2" },
      caughtUp: false,
      allNumberedWatched: false,
      watchedCount: 1,
      airedCount: 20,
      totalCount: 20,
    });
    expect(view?.series?.seasons.map((season) => [season.seasonNumber, season.isSpecials])).toEqual([
      [1, false],
      [2, false],
      [0, true],
    ]);
    expect(view?.series?.seasons[0]).toMatchObject({ name: "Season 1", episodeCount: 7, watchedCount: 1, airedCount: 7 });
  });

  it("falls back to the stored snapshot when TMDB cannot be reached", async () => {
    const { entryId } = await saveTitle(OWNER_A, { kind: "series", tmdbId: TMDB.breakingBad, status: "to_watch" });
    testState.tmdbDown = true;

    const view = await getEntry(entryId);

    expect(view).toMatchObject({
      status: "to_watch",
      canRate: false,
      series: null,
      tmdbUnavailable: true,
      title: { name: "Breaking Bad", year: 2008, overview: null, runtimeMinutes: null },
    });
  });

  it("returns null for a malformed id, an unknown id and another Owner's Entry", async () => {
    const { entryId } = await saveTitle(OWNER_A, { kind: "movie", tmdbId: TMDB.inception, status: "to_watch" });
    expect(await getEntry("nope")).toBeNull();
    expect(await getEntry("00000000-0000-4000-8000-000000000000")).toBeNull();

    signInAs(OWNER_B);
    expect(await getEntry(entryId)).toBeNull();
  });

  it("refreshes a stale Title snapshot after the response, and leaves a fresh one alone", async () => {
    const { entryId } = await saveTitle(OWNER_A, { kind: "movie", tmdbId: TMDB.inception, status: "to_watch" });

    await getEntry(entryId);
    expect(testState.afterTasks).toHaveLength(0);

    await db()
      .update(titles)
      .set({ name: "Old name", refreshedAt: new Date("2025-01-01T00:00:00Z") })
      .where(eq(titles.tmdbId, TMDB.inception));
    const view = await getEntry(entryId);
    expect(view?.title.name).toBe("Inception");
    expect(testState.afterTasks).toHaveLength(1);

    await flushAfter();
    const [title] = await db().select().from(titles).where(eq(titles.tmdbId, TMDB.inception));
    expect(title?.name).toBe("Inception");
    expect(title?.refreshedAt.getTime()).toBeGreaterThan(Date.now() - 60_000);
  });
});
