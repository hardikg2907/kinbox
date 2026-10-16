import { z } from "zod";
import {
  assertSeasonNumber,
  assertTmdbId,
  mapMovie,
  mapSearchResponse,
  mapSeason,
  mapSeries,
} from "./schemas";
import type { MovieDetails, SearchResult, SeasonDetails, SeriesDetails, TmdbClient } from "./types";

const BASE_URL = "https://api.themoviedb.org/3";
const REQUEST_TIMEOUT_MS = 8000;
const MAX_QUERY_LENGTH = 100;
// TMDB rejects append_to_response lists longer than 20.
const MAX_APPENDED_SEASONS = 20;
// No real Series has this many Seasons; the cap stops one call from fanning out into endless requests.
const MAX_SEASONS_PER_CALL = 200;
// A TMDB read token is a JWT. Allow-listing the characters keeps a bad value out of the header.
const TOKEN_PATTERN = /^[A-Za-z0-9._~+/=-]{20,4096}$/;

export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

export type RealTmdbClientOptions = {
  token: string;
  /** Replaces the global `fetch`; tests use it to avoid the network. */
  fetch?: FetchLike;
};

/**
 * TMDB could not give a usable answer: the network failed, the request timed out, TMDB
 * answered 429 or an error status, or the body was not what we expect. The message is
 * generic on purpose. Servers read `status`, `path` and `cause` for logs.
 */
export class TmdbUnavailableError extends Error {
  /** HTTP status when TMDB answered, otherwise null. Never carries the token. */
  readonly status: number | null;
  /** The TMDB path without query or credentials. */
  readonly path: string | null;

  constructor(details: { status?: number; path?: string; cause?: unknown } = {}) {
    super("TMDB could not be reached", { cause: details.cause });
    this.name = "TmdbUnavailableError";
    this.status = details.status ?? null;
    this.path = details.path ?? null;
  }
}

type JsonResult = { found: true; body: unknown } | { found: false };

function chunk<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

// Slicing by code point keeps an emoji from being cut in half at the limit.
function capQuery(query: string): string {
  const characters = Array.from(query);
  return characters.length <= MAX_QUERY_LENGTH
    ? query
    : characters.slice(0, MAX_QUERY_LENGTH).join("");
}

function parseBody<T>(path: string, body: unknown, map: (json: unknown) => T): T {
  try {
    return map(body);
  } catch (error) {
    if (error instanceof z.ZodError) throw new TmdbUnavailableError({ path, cause: error });
    throw error;
  }
}

export function createRealTmdbClient(options: RealTmdbClientOptions): TmdbClient {
  const { token } = options;
  if (!TOKEN_PATTERN.test(token)) {
    // The value is never echoed.
    throw new Error("TMDB read token is missing or malformed");
  }
  // Resolved per call so a patched global fetch (such as Next's) is used.
  const send: FetchLike = options.fetch ?? ((input, init) => fetch(input, init));

  async function getJson(path: string, params: Record<string, string>): Promise<JsonResult> {
    const url = new URL(`${BASE_URL}${path}`);
    for (const [name, value] of Object.entries(params)) {
      url.searchParams.set(name, value);
    }

    let response: Response;
    try {
      response = await send(url.toString(), {
        method: "GET",
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        // The base URL is fixed; a redirect would be an attempt to send the token elsewhere.
        redirect: "error",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      throw new TmdbUnavailableError({ path, cause: error });
    }

    if (response.status === 404) {
      await response.body?.cancel().catch(() => undefined);
      return { found: false };
    }
    if (!response.ok) {
      await response.body?.cancel().catch(() => undefined);
      throw new TmdbUnavailableError({ status: response.status, path });
    }

    try {
      return { found: true, body: await response.json() };
    } catch (error) {
      throw new TmdbUnavailableError({ status: response.status, path, cause: error });
    }
  }

  async function searchMulti(query: string): Promise<SearchResult[]> {
    const trimmed = capQuery(query.trim());
    if (trimmed === "") return [];

    const path = "/search/multi";
    const result = await getJson(path, {
      query: trimmed,
      include_adult: "false",
      language: "en-US",
      page: "1",
    });
    // The search endpoint always exists, so a 404 here is not "no results".
    if (!result.found) throw new TmdbUnavailableError({ status: 404, path });
    return parseBody(path, result.body, mapSearchResponse);
  }

  async function getMovie(tmdbId: number): Promise<MovieDetails | null> {
    assertTmdbId(tmdbId);
    const path = `/movie/${tmdbId}`;
    const result = await getJson(path, { language: "en-US" });
    return result.found ? parseBody(path, result.body, mapMovie) : null;
  }

  async function getSeries(tmdbId: number): Promise<SeriesDetails | null> {
    assertTmdbId(tmdbId);
    const path = `/tv/${tmdbId}`;
    const result = await getJson(path, { language: "en-US" });
    return result.found ? parseBody(path, result.body, mapSeries) : null;
  }

  // Returns null when TMDB has no such Series.
  async function getSeasonChunk(
    tmdbId: number,
    seasonNumbers: number[],
  ): Promise<SeasonDetails[] | null> {
    const path = `/tv/${tmdbId}`;
    const result = await getJson(path, {
      language: "en-US",
      append_to_response: seasonNumbers.map((number) => `season/${number}`).join(","),
    });
    if (!result.found) return null;

    const body = parseBody(path, result.body, (json) => z.record(z.string(), z.unknown()).parse(json));
    const seasons: SeasonDetails[] = [];
    for (const number of seasonNumbers) {
      const raw = body[`season/${number}`];
      // TMDB leaves out Seasons it does not have.
      if (raw === undefined || raw === null) continue;
      seasons.push(parseBody(path, raw, mapSeason));
    }
    return seasons;
  }

  async function getSeasons(tmdbId: number, seasonNumbers: number[]): Promise<SeasonDetails[]> {
    assertTmdbId(tmdbId);
    for (const number of seasonNumbers) assertSeasonNumber(number);
    const wanted = [...new Set(seasonNumbers)].sort((a, b) => a - b);
    if (wanted.length === 0) return [];
    if (wanted.length > MAX_SEASONS_PER_CALL) {
      throw new RangeError("Too many Seasons requested at once");
    }

    const chunks = await Promise.all(
      chunk(wanted, MAX_APPENDED_SEASONS).map((numbers) => getSeasonChunk(tmdbId, numbers)),
    );
    if (chunks.some((seasons) => seasons === null)) return [];
    return chunks
      .flatMap((seasons) => seasons ?? [])
      .sort((a, b) => a.seasonNumber - b.seasonNumber);
  }

  return { searchMulti, getMovie, getSeries, getSeasons };
}
