import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { closeDb, db } from "@/db/client";
import { imdbRatings, titles, watches } from "@/db/schema";
import { resetDatabase } from "@/test/db";
import { flushAfter, OWNER_A, OWNER_B, resetTestState, signInAs, testState, TMDB } from "@/test/mocks";
import { getEntry, saveTitle, setNote, setRating } from "./entries";
import { tickEpisode } from "./progress";

vi.mock("@/data/session", async () => (await import("@/test/mocks")).sessionModule());
vi.mock("@/data/today", async () => (await import("@/test/mocks")).todayModule());
vi.mock("@/lib/tmdb/client", async () => (await import("@/test/mocks")).tmdbClientModule());
vi.mock("next/cache", async () => (await import("@/test/mocks")).nextCacheModule());
vi.mock("next/server", async () => (await import("@/test/mocks")).nextServerModule());
vi.mock("@/lib/imdb/ratings-file", async () => (await import("@/test/mocks")).imdbRatingsFileModule());

beforeEach(async () => {
  resetTestState();
  await resetDatabase();
});

afterAll(async () => {
  await closeDb();
});

describe("getEntry IMDb rating", () => {
  async function savedEntry(kind: "movie" | "series", tmdbId: number): Promise<string> {
    const { entryId } = await saveTitle(OWNER_A, { kind, tmdbId, status: "to_watch" });
    // Lets the refresh that a save starts finish first, so it cannot change the rows under test.
    await flushAfter();
    return entryId;
  }

  it("returns the stored rating as a number with one decimal", async () => {
    const entryId = await savedEntry("movie", TMDB.inception);
    await db()
      .update(imdbRatings)
      .set({ ratingTenths: 88, votes: 2_400_000 })
      .where(eq(imdbRatings.imdbId, "tt1375666"));

    expect((await getEntry(entryId))?.title.imdb).toEqual({ id: "tt1375666", rating: 8.8, votes: 2_400_000 });
  });

  it("returns a whole-number rating as a number", async () => {
    const entryId = await savedEntry("movie", TMDB.matrix);
    await db().update(imdbRatings).set({ ratingTenths: 80, votes: 10 }).where(eq(imdbRatings.imdbId, "tt0133093"));

    expect((await getEntry(entryId))?.title.imdb?.rating).toBe(8);
  });

  it("returns a Series rating too", async () => {
    testState.imdbRatings.set("tt0903747", { ratingTenths: 95, votes: 2_000_000 });
    const entryId = await savedEntry("series", TMDB.breakingBad);

    expect((await getEntry(entryId))?.title.imdb).toEqual({ id: "tt0903747", rating: 9.5, votes: 2_000_000 });
  });

  it("is null when IMDb has no rating for the id", async () => {
    const entryId = await savedEntry("movie", TMDB.dune);
    const [row] = await db().select().from(imdbRatings).where(eq(imdbRatings.imdbId, "tt15239678"));
    expect(row).toMatchObject({ ratingTenths: null, votes: null });

    expect((await getEntry(entryId))?.title.imdb).toBeNull();
  });

  it("is null when ratings are not loaded yet", async () => {
    const entryId = await savedEntry("movie", TMDB.matrix);
    await db().delete(imdbRatings);

    expect((await getEntry(entryId))?.title.imdb).toBeNull();
  });

  it("is null when the Title has no IMDb id", async () => {
    const entryId = await savedEntry("series", TMDB.thePitt);

    expect((await getEntry(entryId))?.title.imdb).toBeNull();
  });
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
    await flushAfter();

    // Every view also checks whether the IMDb ratings are due; only a stale snapshot adds a refresh.
    await getEntry(entryId);
    expect(testState.afterTasks).toHaveLength(1);

    await db()
      .update(titles)
      .set({ name: "Old name", refreshedAt: new Date("2025-01-01T00:00:00Z") })
      .where(eq(titles.tmdbId, TMDB.inception));
    await flushAfter();
    const view = await getEntry(entryId);
    expect(view?.title.name).toBe("Inception");
    expect(testState.afterTasks).toHaveLength(2);

    await flushAfter();
    const [title] = await db().select().from(titles).where(eq(titles.tmdbId, TMDB.inception));
    expect(title?.name).toBe("Inception");
    expect(title?.refreshedAt.getTime()).toBeGreaterThan(Date.now() - 60_000);
  });
});
