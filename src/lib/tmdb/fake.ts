import movieInception from "./fixtures/movie-27205.json";
import movieMatrix from "./fixtures/movie-603.json";
import movieDune from "./fixtures/movie-693134.json";
import seriesBreakingBad from "./fixtures/series-1396.json";
import seriesWestworld from "./fixtures/series-63247.json";
import seriesOngoing from "./fixtures/series-250307.json";
import {
  assertSeasonNumber,
  assertTmdbId,
  movieDetailsSchema,
  seriesFixtureSchema,
  type SeriesFixture,
} from "./schemas";
import type { MovieDetails, SearchResult, SeasonDetails, SeriesDetails, TmdbClient } from "./types";

const MAX_SEARCH_RESULTS = 20;
// Fixtures are well-known Titles. Import matching asks to check anything with too little
// popularity, so a realistic value lets offline matching find them.
const FIXTURE_POPULARITY = 10;

// Parsed once at load, so a fixture that drifts from the contract fails every test run
// and every offline dev session instead of producing odd screens.
const MOVIES: readonly MovieDetails[] = [movieInception, movieMatrix, movieDune].map((fixture) =>
  movieDetailsSchema.parse(fixture),
);

const SERIES: readonly SeriesFixture[] = [seriesBreakingBad, seriesWestworld, seriesOngoing].map(
  (fixture) => seriesFixtureSchema.parse(fixture),
);

function toSearchResult(title: MovieDetails | SeriesDetails): SearchResult {
  return {
    kind: title.kind,
    tmdbId: title.tmdbId,
    name: title.name,
    originalName: title.name,
    year: title.year,
    releaseDate: title.releaseDate,
    popularity: FIXTURE_POPULARITY,
    posterPath: title.posterPath,
  };
}

/** A TmdbClient that serves the bundled fixtures and never touches the network. */
export function createFakeTmdbClient(): TmdbClient {
  return {
    async searchMulti(query: string): Promise<SearchResult[]> {
      const needle = query.trim().toLowerCase();
      if (needle === "") return [];
      return [...MOVIES, ...SERIES.map((series) => series.details)]
        .filter((title) => title.name.toLowerCase().includes(needle))
        .slice(0, MAX_SEARCH_RESULTS)
        .map(toSearchResult);
    },

    async getMovie(tmdbId: number): Promise<MovieDetails | null> {
      assertTmdbId(tmdbId);
      const movie = MOVIES.find((candidate) => candidate.tmdbId === tmdbId);
      // Callers get copies, so one caller changing a result cannot change what the next one sees.
      return movie ? structuredClone(movie) : null;
    },

    async getSeries(tmdbId: number): Promise<SeriesDetails | null> {
      assertTmdbId(tmdbId);
      const series = SERIES.find((candidate) => candidate.details.tmdbId === tmdbId);
      return series ? structuredClone(series.details) : null;
    },

    async getSeasons(tmdbId: number, seasonNumbers: number[]): Promise<SeasonDetails[]> {
      assertTmdbId(tmdbId);
      for (const number of seasonNumbers) assertSeasonNumber(number);
      const series = SERIES.find((candidate) => candidate.details.tmdbId === tmdbId);
      if (!series) return [];
      const wanted = new Set(seasonNumbers);
      return structuredClone(
        series.seasons
          .filter((season) => wanted.has(season.seasonNumber))
          .sort((a, b) => a.seasonNumber - b.seasonNumber),
      );
    },
  };
}
