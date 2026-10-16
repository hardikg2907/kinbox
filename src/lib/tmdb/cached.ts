import "server-only";
import { cacheLife } from "next/cache";
import { getTmdbClient } from "./client";
import type { MovieDetails, SearchResult, SeasonDetails, SeriesDetails } from "./types";

// Matches the real client's cap, so a long query cannot create an unbounded cache key.
const MAX_QUERY_LENGTH = 100;

// Raw arguments form the cache key, so they are made canonical before the cached call.
function normaliseQuery(query: string): string {
  const collapsed = query.trim().replace(/\s+/g, " ").toLowerCase();
  return Array.from(collapsed).slice(0, MAX_QUERY_LENGTH).join("").trim();
}

async function searchNormalised(query: string): Promise<SearchResult[]> {
  "use cache";
  cacheLife("hours");
  return getTmdbClient().searchMulti(query);
}

async function getSeasonsSorted(tmdbId: number, seasonNumbers: number[]): Promise<SeasonDetails[]> {
  "use cache";
  cacheLife("hours");
  return getTmdbClient().getSeasons(tmdbId, seasonNumbers);
}

/** Movies and Series matching the text, cached per normalised query. */
export async function searchTitles(query: string): Promise<SearchResult[]> {
  const normalised = normaliseQuery(query);
  if (normalised === "") return [];
  return searchNormalised(normalised);
}

/** One Movie, or null when TMDB has no such Movie. */
export async function getMovie(tmdbId: number): Promise<MovieDetails | null> {
  "use cache";
  cacheLife("days");
  return getTmdbClient().getMovie(tmdbId);
}

/** One Series, or null when TMDB has no such Series. */
export async function getSeries(tmdbId: number): Promise<SeriesDetails | null> {
  "use cache";
  cacheLife("hours");
  return getTmdbClient().getSeries(tmdbId);
}

/** Several Seasons of one Series; order and repeats in the request do not change the cache key. */
export async function getSeasons(
  tmdbId: number,
  seasonNumbers: number[],
): Promise<SeasonDetails[]> {
  const sorted = [...new Set(seasonNumbers)].sort((a, b) => a - b);
  if (sorted.length === 0) return [];
  return getSeasonsSorted(tmdbId, sorted);
}
