import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { closeDb } from "@/db/client";
import { TmdbUnavailableError } from "@/lib/tmdb/real";
import { resetDatabase } from "@/test/db";
import { OWNER_A, OWNER_B, resetTestState, signInAs, testState, TMDB } from "@/test/mocks";
import { saveTitle } from "./entries";
import { getSeason, tickEpisode } from "./progress";

vi.mock("@/data/session", async () => (await import("@/test/mocks")).sessionModule());
vi.mock("@/data/today", async () => (await import("@/test/mocks")).todayModule());
vi.mock("@/lib/tmdb/client", async () => (await import("@/test/mocks")).tmdbClientModule());
vi.mock("next/cache", async () => (await import("@/test/mocks")).nextCacheModule());
vi.mock("next/server", async () => (await import("@/test/mocks")).nextServerModule());

async function seriesEntry(tmdbId: number): Promise<string> {
  return (await saveTitle(OWNER_A, { kind: "series", tmdbId, status: "watching" })).entryId;
}

beforeEach(async () => {
  resetTestState();
  await resetDatabase();
});

afterAll(async () => {
  await closeDb();
});

describe("getSeason", () => {
  it("lists a Season's Episodes in order with ticks and labels", async () => {
    const entryId = await seriesEntry(TMDB.breakingBad);
    await tickEpisode(OWNER_A, { entryId, seasonNumber: 1, episodeNumber: 2, watched: true });

    const season = await getSeason(entryId, 1);

    expect(season?.name).toBe("Season 1");
    expect(season?.episodes.map((episode) => episode.label)).toEqual(
      ["S1 E1", "S1 E2", "S1 E3", "S1 E4", "S1 E5", "S1 E6", "S1 E7"],
    );
    expect(season?.episodes[1]).toMatchObject({
      seasonNumber: 1,
      episodeNumber: 2,
      tmdbEpisodeId: expect.any(Number),
      airDate: "2008-01-27",
      aired: true,
      watched: true,
    });
    expect(season?.episodes.filter((episode) => episode.watched)).toHaveLength(1);
  });

  it("marks unaired Episodes, with or without a date", async () => {
    const entryId = await seriesEntry(TMDB.thePitt);
    const season = await getSeason(entryId, 2);
    const byNumber = new Map(season?.episodes.map((episode) => [episode.episodeNumber, episode]));
    expect(byNumber.get(10)).toMatchObject({ aired: true });
    expect(byNumber.get(11)).toMatchObject({ aired: false, airDate: "2030-01-04" });
    expect(byNumber.get(16)).toMatchObject({ aired: false, airDate: null });
  });

  it("labels Specials and counts an undated Special as aired", async () => {
    const entryId = await seriesEntry(TMDB.breakingBad);
    const season = await getSeason(entryId, 0);
    expect(season?.name).toBe("Specials");
    expect(season?.episodes[2]?.label).toBe("Special 3");
    expect(season?.episodes.find((episode) => episode.episodeNumber === 6)).toMatchObject({
      airDate: null,
      aired: true,
    });
  });

  it("returns null for another Owner's Entry, a Movie, an unknown Season or a bad id", async () => {
    const entryId = await seriesEntry(TMDB.breakingBad);
    const movie = (await saveTitle(OWNER_A, { kind: "movie", tmdbId: TMDB.dune, status: "watching" })).entryId;

    expect(await getSeason(entryId, 7)).toBeNull();
    expect(await getSeason(entryId, -1)).toBeNull();
    expect(await getSeason(entryId, 1.5)).toBeNull();
    expect(await getSeason(movie, 1)).toBeNull();
    expect(await getSeason("1; drop table entries", 1)).toBeNull();

    signInAs(OWNER_B);
    expect(await getSeason(entryId, 1)).toBeNull();
  });

  it("throws when TMDB cannot be reached, so the route can answer 503", async () => {
    const entryId = await seriesEntry(TMDB.breakingBad);
    testState.tmdbDown = true;
    await expect(getSeason(entryId, 1)).rejects.toBeInstanceOf(TmdbUnavailableError);
  });
});
