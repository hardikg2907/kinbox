import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  assertSeasonNumber,
  assertTmdbId,
  mapMovie,
  mapSearchResponse,
  mapSeason,
  mapSeries,
  movieDetailsSchema,
  searchResultSchema,
  seriesDetailsSchema,
  yearFromDate,
} from "./schemas";

describe("yearFromDate", () => {
  it("takes the first four digits of a well-formed date", () => {
    expect(yearFromDate("1999-03-31")).toBe(1999);
    expect(yearFromDate("2030-01-04")).toBe(2030);
  });

  it.each([null, "", "1999", "1999-3-31", "99-03-31", "1999-03-31T00:00", "abcd-ef-gh", "0000-00-00"])(
    "returns null for %j",
    (value) => {
      expect(yearFromDate(value)).toBeNull();
    },
  );
});

describe("mapSearchResponse", () => {
  it("maps movies and tv to Movie and Series results", () => {
    const results = mapSearchResponse({
      results: [
        {
          media_type: "movie",
          id: 603,
          title: "The Matrix",
          release_date: "1999-03-31",
          poster_path: "/dXNAPwY7VrqMAo51EKhhCJfaGb5.jpg",
          vote_average: 8.2,
        },
        {
          media_type: "tv",
          id: 1396,
          name: "Breaking Bad",
          first_air_date: "2008-01-20",
          poster_path: "/anFx9aTOOYqgS3v7x3R84Kz67ly.jpg",
        },
      ],
    });
    expect(results).toEqual([
      {
        kind: "movie",
        tmdbId: 603,
        name: "The Matrix",
        year: 1999,
        posterPath: "/dXNAPwY7VrqMAo51EKhhCJfaGb5.jpg",
      },
      {
        kind: "series",
        tmdbId: 1396,
        name: "Breaking Bad",
        year: 2008,
        posterPath: "/anFx9aTOOYqgS3v7x3R84Kz67ly.jpg",
      },
    ]);
  });

  it("strips fields that are not part of the contract", () => {
    const [result] = mapSearchResponse({
      results: [{ media_type: "movie", id: 1, title: "A", popularity: 9, adult: false }],
    });
    expect(Object.keys(result ?? {}).sort()).toEqual(["kind", "name", "posterPath", "tmdbId", "year"]);
  });

  it("drops people and other result types without reading their fields", () => {
    const results = mapSearchResponse({
      results: [
        { media_type: "person", id: 1, name: "Keanu Reeves", known_for: [{ id: "not-a-number" }] },
        { media_type: "collection", id: 2 },
        { media_type: "movie", id: 3, title: "Speed" },
      ],
    });
    expect(results.map((result) => result.name)).toEqual(["Speed"]);
  });

  it("drops results that have no name", () => {
    const results = mapSearchResponse({
      results: [
        { media_type: "movie", id: 1, title: null },
        { media_type: "movie", id: 2, title: "" },
        { media_type: "movie", id: 3, title: "   " },
        { media_type: "tv", id: 4 },
        { media_type: "tv", id: 5, name: "" },
        { media_type: "tv", id: 6, name: "Kept" },
      ],
    });
    expect(results.map((result) => result.tmdbId)).toEqual([6]);
  });

  it("turns missing, null and empty values into null", () => {
    const [movie, series] = mapSearchResponse({
      results: [
        { media_type: "movie", id: 1, title: "A", release_date: "", poster_path: null },
        { media_type: "tv", id: 2, name: "B", first_air_date: null },
      ],
    });
    expect(movie).toMatchObject({ year: null, posterPath: null });
    expect(series).toMatchObject({ year: null, posterPath: null });
  });

  it("replaces a poster path that is not a plain image path with null", () => {
    const [result] = mapSearchResponse({
      results: [
        { media_type: "movie", id: 1, title: "A", poster_path: "https://evil.example/x.jpg" },
      ],
    });
    expect(result?.posterPath).toBeNull();
  });

  it("returns an empty list for no results", () => {
    expect(mapSearchResponse({ results: [] })).toEqual([]);
  });

  it.each([
    ["not an object", "oops"],
    ["no results key", {}],
    ["results is not a list", { results: "x" }],
    ["a movie with a bad id", { results: [{ media_type: "movie", id: "7", title: "A" }] }],
    ["a tv item with a negative id", { results: [{ media_type: "tv", id: -1, name: "A" }] }],
    ["an item without a media type", { results: [{ id: 1, title: "A" }] }],
    ["a movie title that is not text", { results: [{ media_type: "movie", id: 1, title: 5 }] }],
  ])("throws for %s", (_label, body) => {
    expect(() => mapSearchResponse(body)).toThrow(z.ZodError);
  });
});

describe("mapMovie", () => {
  it("maps a full response", () => {
    expect(
      mapMovie({
        id: 27205,
        title: "Inception",
        release_date: "2010-07-15",
        poster_path: "/xlaY2zyzMfkhk0HSC5VUwzoZPU1.jpg",
        overview: "A thief enters dreams.",
        runtime: 148,
        genres: [{ id: 1 }],
      }),
    ).toEqual({
      kind: "movie",
      tmdbId: 27205,
      name: "Inception",
      year: 2010,
      posterPath: "/xlaY2zyzMfkhk0HSC5VUwzoZPU1.jpg",
      overview: "A thief enters dreams.",
      runtimeMinutes: 148,
    });
  });

  it("reads missing, null and empty values as null", () => {
    expect(mapMovie({ id: 1, title: "A" })).toMatchObject({
      year: null,
      posterPath: null,
      overview: null,
      runtimeMinutes: null,
    });
    expect(
      mapMovie({ id: 1, title: "A", release_date: "", poster_path: null, overview: "", runtime: null }),
    ).toMatchObject({ year: null, posterPath: null, overview: null, runtimeMinutes: null });
  });

  it("reads a runtime of 0 as unknown", () => {
    expect(mapMovie({ id: 1, title: "A", runtime: 0 }).runtimeMinutes).toBeNull();
  });

  it("trims names", () => {
    expect(mapMovie({ id: 1, title: "  Heat  " }).name).toBe("Heat");
  });

  it.each([
    ["an empty title", { id: 1, title: "" }],
    ["a missing title", { id: 1 }],
    ["a bad id", { id: 0, title: "A" }],
    ["a text runtime", { id: 1, title: "A", runtime: "148" }],
  ])("throws for %s", (_label, body) => {
    expect(() => mapMovie(body)).toThrow(z.ZodError);
  });
});

describe("mapSeries", () => {
  const body = {
    id: 1396,
    name: "Breaking Bad",
    first_air_date: "2008-01-20",
    poster_path: "/anFx9aTOOYqgS3v7x3R84Kz67ly.jpg",
    overview: "A chemistry teacher.",
    status: "Ended",
    seasons: [
      { season_number: 2, name: "Season 2", episode_count: 13, air_date: "2009-03-08" },
      { season_number: 0, name: "Specials", episode_count: 9, air_date: "2009-02-17" },
      { season_number: 1, name: "Season 1", episode_count: 7, air_date: "2008-01-20" },
    ],
    last_episode_to_air: { season_number: 5, episode_number: 16, air_date: "2013-09-29", id: 9 },
    next_episode_to_air: null,
  };

  it("maps status, seasons and episode pointers", () => {
    expect(mapSeries(body)).toEqual({
      kind: "series",
      tmdbId: 1396,
      name: "Breaking Bad",
      year: 2008,
      posterPath: "/anFx9aTOOYqgS3v7x3R84Kz67ly.jpg",
      overview: "A chemistry teacher.",
      status: "Ended",
      seasons: [
        { seasonNumber: 0, name: "Specials", episodeCount: 9, airDate: "2009-02-17" },
        { seasonNumber: 1, name: "Season 1", episodeCount: 7, airDate: "2008-01-20" },
        { seasonNumber: 2, name: "Season 2", episodeCount: 13, airDate: "2009-03-08" },
      ],
      lastEpisodeToAir: { seasonNumber: 5, episodeNumber: 16, airDate: "2013-09-29" },
      nextEpisodeToAir: null,
    });
  });

  it("keeps season 0 (Specials)", () => {
    expect(mapSeries(body).seasons[0]?.seasonNumber).toBe(0);
  });

  it("reads missing and empty values as null or defaults", () => {
    const series = mapSeries({
      id: 5,
      name: "Bare",
      first_air_date: "",
      status: "",
      seasons: [
        { season_number: 0, name: "", episode_count: null, air_date: "" },
        { season_number: 3, name: "  " },
      ],
      last_episode_to_air: { season_number: 1, episode_number: 2, air_date: "" },
    });
    expect(series).toMatchObject({
      year: null,
      posterPath: null,
      overview: null,
      status: null,
      nextEpisodeToAir: null,
      lastEpisodeToAir: { seasonNumber: 1, episodeNumber: 2, airDate: null },
    });
    expect(series.seasons).toEqual([
      { seasonNumber: 0, name: "Specials", episodeCount: 0, airDate: null },
      { seasonNumber: 3, name: "Season 3", episodeCount: 0, airDate: null },
    ]);
  });

  it("accepts a Series with no seasons list", () => {
    expect(mapSeries({ id: 5, name: "Bare" }).seasons).toEqual([]);
  });

  it.each([
    ["a missing name", { id: 1 }],
    ["a negative season number", { id: 1, name: "A", seasons: [{ season_number: -1 }] }],
    ["a season list that is not a list", { id: 1, name: "A", seasons: "x" }],
    ["a bad episode pointer", { id: 1, name: "A", last_episode_to_air: { season_number: "1" } }],
  ])("throws for %s", (_label, input) => {
    expect(() => mapSeries(input)).toThrow(z.ZodError);
  });
});

describe("mapSeason", () => {
  it("sorts Episodes by episode number and maps their fields", () => {
    const season = mapSeason({
      season_number: 1,
      name: "Season 1",
      episodes: [
        { id: 12, season_number: 1, episode_number: 3, name: "C", air_date: "2008-02-10", runtime: 47 },
        { id: 10, season_number: 1, episode_number: 1, name: "A", air_date: "2008-01-20" },
        { id: 11, season_number: 1, episode_number: 2, name: "B", air_date: "2008-01-27" },
      ],
    });
    expect(season.episodes).toEqual([
      { tmdbEpisodeId: 10, seasonNumber: 1, episodeNumber: 1, name: "A", airDate: "2008-01-20" },
      { tmdbEpisodeId: 11, seasonNumber: 1, episodeNumber: 2, name: "B", airDate: "2008-01-27" },
      { tmdbEpisodeId: 12, seasonNumber: 1, episodeNumber: 3, name: "C", airDate: "2008-02-10" },
    ]);
  });

  it("keeps season 0 and its default name", () => {
    expect(mapSeason({ season_number: 0, episodes: [] })).toEqual({
      seasonNumber: 0,
      name: "Specials",
      episodes: [],
    });
  });

  it("reads null and empty air dates and names as null", () => {
    const season = mapSeason({
      season_number: 2,
      name: "Season 2",
      episodes: [
        { id: 1, season_number: 2, episode_number: 1, name: "", air_date: "" },
        { id: 2, season_number: 2, episode_number: 2, name: null, air_date: null },
        { id: 3, season_number: 2, episode_number: 3 },
      ],
    });
    expect(season.episodes.map((episode) => [episode.name, episode.airDate])).toEqual([
      [null, null],
      [null, null],
      [null, null],
    ]);
  });

  it("accepts a Season with no episodes list", () => {
    expect(mapSeason({ season_number: 4, name: "Season 4" }).episodes).toEqual([]);
  });

  it("throws for an Episode without an id", () => {
    expect(() =>
      mapSeason({ season_number: 1, episodes: [{ season_number: 1, episode_number: 1 }] }),
    ).toThrow(z.ZodError);
  });
});

describe("contract schemas", () => {
  it("reject fields that are not in the contract", () => {
    const result = { kind: "movie", tmdbId: 1, name: "A", year: null, posterPath: null };
    expect(searchResultSchema.safeParse(result).success).toBe(true);
    expect(searchResultSchema.safeParse({ ...result, extra: 1 }).success).toBe(false);
  });

  it("reject a poster path that is not a plain image path", () => {
    const movie = {
      kind: "movie",
      tmdbId: 1,
      name: "A",
      year: 2000,
      posterPath: "/a/b.jpg",
      overview: null,
      runtimeMinutes: null,
    };
    expect(movieDetailsSchema.safeParse(movie).success).toBe(false);
    expect(movieDetailsSchema.safeParse({ ...movie, posterPath: "/b.jpg" }).success).toBe(true);
  });

  it("reject a date that is not YYYY-MM-DD", () => {
    const series = {
      kind: "series",
      tmdbId: 1,
      name: "A",
      year: null,
      posterPath: null,
      overview: null,
      status: null,
      seasons: [{ seasonNumber: 1, name: "S", episodeCount: 1, airDate: "2020-1-1" }],
      lastEpisodeToAir: null,
      nextEpisodeToAir: null,
    };
    expect(seriesDetailsSchema.safeParse(series).success).toBe(false);
  });
});

describe("id guards", () => {
  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 2 ** 53, "12" as unknown as number])(
    "assertTmdbId rejects %j",
    (value) => {
      expect(() => assertTmdbId(value)).toThrow(RangeError);
    },
  );

  it("assertTmdbId accepts positive integers", () => {
    expect(() => assertTmdbId(1)).not.toThrow();
    expect(() => assertTmdbId(Number.MAX_SAFE_INTEGER)).not.toThrow();
  });

  it.each([-1, 1.5, Number.NaN, 2 ** 53, "1" as unknown as number])(
    "assertSeasonNumber rejects %j",
    (value) => {
      expect(() => assertSeasonNumber(value)).toThrow(RangeError);
    },
  );

  it("assertSeasonNumber accepts 0 (Specials)", () => {
    expect(() => assertSeasonNumber(0)).not.toThrow();
    expect(() => assertSeasonNumber(12)).not.toThrow();
  });
});
