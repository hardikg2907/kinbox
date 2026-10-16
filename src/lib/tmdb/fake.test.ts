import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createFakeTmdbClient } from "./fake";
import { posterUrl } from "./images";
import { movieDetailsSchema, seriesFixtureSchema } from "./schemas";

const FIXTURES_DIR = fileURLToPath(new URL("./fixtures/", import.meta.url));
const TODAY = new Date().toISOString().slice(0, 10);

function readFixture(fileName: string): unknown {
  return JSON.parse(readFileSync(`${FIXTURES_DIR}${fileName}`, "utf8"));
}

const fixtureFiles = readdirSync(FIXTURES_DIR).filter((name) => name.endsWith(".json"));
const client = createFakeTmdbClient();

describe("fixtures", () => {
  it("includes 3 Movies and 3 Series", () => {
    expect(fixtureFiles.filter((name) => name.startsWith("movie-"))).toHaveLength(3);
    expect(fixtureFiles.filter((name) => name.startsWith("series-"))).toHaveLength(3);
  });

  it.each(fixtureFiles)("%s fits the contract and is served by the fake", async (fileName) => {
    const raw = readFixture(fileName);
    if (fileName.startsWith("movie-")) {
      const movie = movieDetailsSchema.parse(raw);
      expect(await client.getMovie(movie.tmdbId)).toEqual(movie);
      expect(posterUrl(movie.posterPath, "w342")).not.toBeNull();
    } else {
      const { details, seasons } = seriesFixtureSchema.parse(raw);
      expect(await client.getSeries(details.tmdbId)).toEqual(details);
      const numbers = seasons.map((season) => season.seasonNumber);
      expect(await client.getSeasons(details.tmdbId, numbers)).toEqual(seasons);
      expect(posterUrl(details.posterPath, "w342")).not.toBeNull();
    }
  });

  it.each(fixtureFiles.filter((name) => name.startsWith("series-")))(
    "%s keeps season summaries, episode order and episode pointers consistent",
    (fileName) => {
      const { details, seasons } = seriesFixtureSchema.parse(readFixture(fileName));
      expect(details.seasons.map((season) => season.seasonNumber)).toEqual(
        seasons.map((season) => season.seasonNumber),
      );
      for (const season of seasons) {
        const summary = details.seasons.find((candidate) => candidate.seasonNumber === season.seasonNumber);
        expect(summary?.episodeCount).toBe(season.episodes.length);
        const numbers = season.episodes.map((episode) => episode.episodeNumber);
        expect(numbers).toEqual([...numbers].sort((a, b) => a - b));
        expect(new Set(numbers).size).toBe(numbers.length);
      }
      const episodes = seasons.flatMap((season) => season.episodes);
      expect(new Set(episodes.map((episode) => episode.tmdbEpisodeId)).size).toBe(episodes.length);
      for (const pointer of [details.lastEpisodeToAir, details.nextEpisodeToAir]) {
        if (!pointer) continue;
        const match = episodes.find(
          (episode) =>
            episode.seasonNumber === pointer.seasonNumber && episode.episodeNumber === pointer.episodeNumber,
        );
        expect(match?.airDate).toBe(pointer.airDate);
      }
    },
  );

  it("has an ended Series with Specials and at least two numbered Seasons", async () => {
    const ended = (await client.searchMulti("breaking")).at(0);
    const series = ended && (await client.getSeries(ended.tmdbId));
    expect(series).toMatchObject({ kind: "series", status: "Ended" });
    const numbers = series?.seasons.map((season) => season.seasonNumber) ?? [];
    expect(numbers).toContain(0);
    expect(numbers.filter((number) => number > 0).length).toBeGreaterThanOrEqual(2);
  });

  it("has a cancelled Series", async () => {
    const found = (await client.searchMulti("westworld")).at(0);
    const series = found && (await client.getSeries(found.tmdbId));
    expect(series?.status).toBe("Canceled");
  });

  it("has an ongoing Series with aired, unaired and undated Episodes in its last Season", async () => {
    const found = (await client.searchMulti("(fixture)")).at(0);
    const series = found && (await client.getSeries(found.tmdbId));
    expect(series?.status).toBe("Returning Series");
    expect(series?.nextEpisodeToAir).not.toBeNull();
    expect(series?.nextEpisodeToAir?.airDate?.startsWith("2030-")).toBe(true);

    const lastNumber = Math.max(...(series?.seasons.map((season) => season.seasonNumber) ?? []));
    const [season] = await client.getSeasons(series?.tmdbId ?? 0, [lastNumber]);
    const dates = season?.episodes.map((episode) => episode.airDate) ?? [];
    expect(dates.some((date) => date !== null && date <= TODAY)).toBe(true);
    expect(dates.some((date) => date !== null && date > TODAY)).toBe(true);
    expect(dates.at(-1)).toBeNull();
    expect(dates.filter((date) => date === null)).toHaveLength(1);
  });
});

describe("searchMulti", () => {
  it("matches names case-insensitively on any substring", async () => {
    expect((await client.searchMulti("matr")).map((result) => result.name)).toEqual(["The Matrix"]);
    expect((await client.searchMulti("INCEPT")).map((result) => result.name)).toEqual(["Inception"]);
    expect((await client.searchMulti("  dune: part  ")).map((result) => result.name)).toEqual([
      "Dune: Part Two",
    ]);
  });

  it("returns several results, Movies and Series together, for a shared word", async () => {
    const results = await client.searchMulti("the");
    expect(results.length).toBeGreaterThanOrEqual(2);
    expect(new Set(results.map((result) => result.kind))).toEqual(new Set(["movie", "series"]));
  });

  it("returns result objects in the contract shape", async () => {
    const [result] = await client.searchMulti("matrix");
    expect(result).toEqual({
      kind: "movie",
      tmdbId: 603,
      name: "The Matrix",
      year: 1999,
      posterPath: expect.stringMatching(/^\/.+\.jpg$/),
    });
  });

  it("returns nothing for an empty or unmatched query", async () => {
    expect(await client.searchMulti("")).toEqual([]);
    expect(await client.searchMulti("   ")).toEqual([]);
    expect(await client.searchMulti("zzzz-no-such-title")).toEqual([]);
  });

  it("returns at most 20 results", async () => {
    expect((await client.searchMulti("e")).length).toBeLessThanOrEqual(20);
  });
});

describe("lookups", () => {
  it("returns null for ids it has no fixture for", async () => {
    expect(await client.getMovie(1)).toBeNull();
    expect(await client.getSeries(1)).toBeNull();
    expect(await client.getSeasons(1, [1])).toEqual([]);
  });

  it("returns season 0 (Specials) when asked for it", async () => {
    const seasons = await client.getSeasons(1396, [0]);
    expect(seasons.map((season) => season.seasonNumber)).toEqual([0]);
    expect(seasons[0]?.episodes.length).toBeGreaterThan(0);
  });

  it("returns only the Seasons that exist, in season order, without repeats", async () => {
    const seasons = await client.getSeasons(1396, [2, 99, 1, 2]);
    expect(seasons.map((season) => season.seasonNumber)).toEqual([1, 2]);
  });

  it("hands out copies", async () => {
    const first = await client.getMovie(603);
    if (first) first.name = "changed";
    expect((await client.getMovie(603))?.name).toBe("The Matrix");
  });

  it("rejects invalid ids like the real client", async () => {
    await expect(client.getMovie(0)).rejects.toBeInstanceOf(RangeError);
    await expect(client.getSeries(-1)).rejects.toBeInstanceOf(RangeError);
    await expect(client.getSeasons(1396, [-1])).rejects.toBeInstanceOf(RangeError);
  });
});
