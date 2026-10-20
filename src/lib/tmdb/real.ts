import "server-only";
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
// A 429 gets two more tries, so one request makes at most three.
const MAX_RETRIES = 2;
// A long Retry-After is cut to this, so one request cannot stall for long.
const MAX_RETRY_WAIT_MS = 2000;
const RETRY_BACKOFF_MS = 300;
// Retry-After may also be an HTTP date; that form is ignored in favour of the backoff.
const RETRY_AFTER_SECONDS = /^\d+(?:\.\d+)?$/;
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
  /** Replaces the timer that waits between 429 retries; tests use it to skip real delays. */
  sleep?: (ms: number) => Promise<void>;
  /** Replaces `Math.random` for the retry jitter; tests use it for fixed waits. */
  random?: () => number;
};

/**
 * TMDB could not give a usable answer: the network failed, the request timed out, TMDB
 * kept answering 429 through every retry or answered an error status, or the body was not
 * what we expect. The message is generic on purpose. Servers read `status`, `path` and
 * `cause` for logs.
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

function sleepFor(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryWaitMs(response: Response, retry: number, random: () => number): number {
  const header = response.headers.get("retry-after")?.trim() ?? "";
  if (RETRY_AFTER_SECONDS.test(header)) {
    return Math.min(Number(header) * 1000, MAX_RETRY_WAIT_MS);
  }
  // Jitter stops searches that were limited at the same moment from retrying together.
  return RETRY_BACKOFF_MS * 2 ** retry * (0.5 + random() * 0.5);
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
  const sleep = options.sleep ?? sleepFor;
  // Jitter is not a security value, so Math.random is enough.
  const random = options.random ?? (() => Math.random());

  // The 429 retry lives here, inside the cached call, so only the final answer reaches
  // `settle` in cached.ts. A retry outside the cache would read the cached failure.
  async function getJson(path: string, params: Record<string, string>): Promise<JsonResult> {
    const url = new URL(`${BASE_URL}${path}`);
    for (const [name, value] of Object.entries(params)) {
      url.searchParams.set(name, value);
    }

    for (let retry = 0; ; retry += 1) {
      let response: Response;
      try {
        response = await send(url.toString(), {
          method: "GET",
          headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
          // The base URL is fixed; a redirect would be an attempt to send the token elsewhere.
          redirect: "error",
          // A new signal per try: the time spent waiting must not eat into the next try.
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
      } catch (error) {
        throw new TmdbUnavailableError({ path, cause: error });
      }

      if (response.status === 429 && retry < MAX_RETRIES) {
        await response.body?.cancel().catch(() => undefined);
        await sleep(retryWaitMs(response, retry, random));
        continue;
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
