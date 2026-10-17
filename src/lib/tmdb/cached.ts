import "server-only";
import { cacheLife } from "next/cache";
import { getTmdbClient } from "./client";
import { TmdbUnavailableError } from "./real";
import type { MovieDetails, SearchResult, SeasonDetails, SeriesDetails } from "./types";

// Matches the real client's cap, so a long query cannot create an unbounded cache key.
const MAX_QUERY_LENGTH = 100;

// A cached scope hands back only serialised values: a thrown TmdbUnavailableError comes back
// as a plain Error, and callers could no longer tell "TMDB is down" from a bug. So the failure
// travels as data and becomes the real error again outside the cache.
type Settled<T> = { ok: true; value: T } | { ok: false; status: number | null };

// `keep` sets how long a usable answer stays cached.
async function settle<T>(read: () => Promise<T>, keep: () => void): Promise<Settled<T>> {
  try {
    const value = await read();
    keep();
    return { ok: true, value };
  } catch (error) {
    if (!(error instanceof TmdbUnavailableError)) throw error;
    // Kept briefly, so TMDB recovering shows up within seconds.
    cacheLife("seconds");
    return { ok: false, status: error.status };
  }
}

function unwrap<T>(result: Settled<T>): T {
  if (!result.ok) throw new TmdbUnavailableError({ status: result.status ?? undefined });
  return result.value;
}

// Raw arguments form the cache key, so they are made canonical before the cached call.
function normaliseQuery(query: string): string {
  const collapsed = query.trim().replace(/\s+/g, " ").toLowerCase();
  return Array.from(collapsed).slice(0, MAX_QUERY_LENGTH).join("").trim();
}

async function searchNormalised(query: string): Promise<Settled<SearchResult[]>> {
  "use cache";
  return settle(() => getTmdbClient().searchMulti(query), () => cacheLife("hours"));
}

async function getMovieCached(tmdbId: number): Promise<Settled<MovieDetails | null>> {
  "use cache";
  return settle(() => getTmdbClient().getMovie(tmdbId), () => cacheLife("days"));
}

async function getSeriesCached(tmdbId: number): Promise<Settled<SeriesDetails | null>> {
  "use cache";
  return settle(() => getTmdbClient().getSeries(tmdbId), () => cacheLife("hours"));
}

async function getSeasonsSorted(
  tmdbId: number,
  seasonNumbers: number[],
): Promise<Settled<SeasonDetails[]>> {
  "use cache";
  return settle(
    () => getTmdbClient().getSeasons(tmdbId, seasonNumbers),
    () => cacheLife("hours"),
  );
}

/** Movies and Series matching the text, cached per normalised query. */
export async function searchTitles(query: string): Promise<SearchResult[]> {
  const normalised = normaliseQuery(query);
  if (normalised === "") return [];
  return unwrap(await searchNormalised(normalised));
}

/** One Movie, or null when TMDB has no such Movie. */
export async function getMovie(tmdbId: number): Promise<MovieDetails | null> {
  return unwrap(await getMovieCached(tmdbId));
}

/** One Series, or null when TMDB has no such Series. */
export async function getSeries(tmdbId: number): Promise<SeriesDetails | null> {
  return unwrap(await getSeriesCached(tmdbId));
}

/** Several Seasons of one Series; order and repeats in the request do not change the cache key. */
export async function getSeasons(
  tmdbId: number,
  seasonNumbers: number[],
): Promise<SeasonDetails[]> {
  const sorted = [...new Set(seasonNumbers)].sort((a, b) => a - b);
  if (sorted.length === 0) return [];
  return unwrap(await getSeasonsSorted(tmdbId, sorted));
}
