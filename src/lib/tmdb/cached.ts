import "server-only";
import { cacheLife } from "next/cache";
import { getTmdbClient } from "./client";
import { TmdbUnavailableError } from "./real";
import type { MovieDetails, SearchResult, SeriesDetails, SeriesWithSeasons } from "./types";

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

// Plain in-memory cache: every typed query is its own key, so a shared store would only add writes and lookup latency.
async function searchNormalised(query: string): Promise<Settled<SearchResult[]>> {
  "use cache";
  return settle(() => getTmdbClient().searchMulti(query), () => cacheLife("hours"));
}

async function getMovieCached(tmdbId: number): Promise<Settled<MovieDetails | null>> {
  "use cache: remote";
  return settle(() => getTmdbClient().getMovie(tmdbId), () => cacheLife("days"));
}

async function getSeriesCached(tmdbId: number): Promise<Settled<SeriesDetails | null>> {
  "use cache: remote";
  return settle(() => getTmdbClient().getSeries(tmdbId), () => cacheLife("hours"));
}

async function getSeriesWithSeasonsCached(
  tmdbId: number,
): Promise<Settled<SeriesWithSeasons | null>> {
  "use cache: remote";
  return settle(() => getTmdbClient().getSeriesWithSeasons(tmdbId), () => cacheLife("hours"));
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

/** A Series with all its Seasons from one shared entry, or null when TMDB has no such Series. */
export async function getSeriesWithSeasons(tmdbId: number): Promise<SeriesWithSeasons | null> {
  return unwrap(await getSeriesWithSeasonsCached(tmdbId));
}
