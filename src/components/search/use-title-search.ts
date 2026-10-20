"use client";

import { useEffect, useState } from "react";
import { cacheGeneration, readCached, writeCached } from "@/components/search/search-cache";
import {
  deriveSearchView,
  MIN_QUERY_LENGTH,
  repliesFromCache,
  type LibraryReply,
  type SearchOutcome,
  type TmdbReply,
} from "@/components/search/search-view";
import type { SearchItem } from "@/data/dto";

const DEBOUNCE_MS = 200;

export const TMDB_DOWN_MESSAGE = "Can't reach the movie database right now. Try again in a minute.";
const SEARCH_FAILED_MESSAGE = "Couldn't search right now. Check your connection and try again.";
const SIGNED_OUT_MESSAGE = "You were signed out. Sign in to keep searching.";

async function fetchResults(url: string, signal: AbortSignal): Promise<{ status: number; results: SearchItem[] | null } | null> {
  try {
    const response = await fetch(url, { signal });
    if (!response.ok) return { status: response.status, results: null };
    const body: unknown = await response.json();
    const results = typeof body === "object" && body !== null && "results" in body ? body.results : null;
    return { status: response.status, results: Array.isArray(results) ? (results as SearchItem[]) : null };
  } catch {
    if (signal.aborted) return null;
    return { status: 0, results: null };
  }
}

// Returns null when the request was cancelled, so a stale reply never reaches the screen.
async function loadTmdb(query: string, signal: AbortSignal): Promise<TmdbReply | null> {
  const reply = await fetchResults(`/api/search?q=${encodeURIComponent(query)}`, signal);
  if (reply === null) return null;
  if (reply.status === 401) return { query, ok: false, message: SIGNED_OUT_MESSAGE, signedOut: true };
  if (reply.status === 503) return { query, ok: false, message: TMDB_DOWN_MESSAGE, signedOut: false };
  if (reply.results === null) return { query, ok: false, message: SEARCH_FAILED_MESSAGE, signedOut: false };
  return { query, ok: true, items: reply.results };
}

async function loadLibrary(query: string, signal: AbortSignal): Promise<LibraryReply | null> {
  const reply = await fetchResults(`/api/search/library?q=${encodeURIComponent(query)}`, signal);
  if (reply === null) return null;
  return { query, items: reply.results };
}

/**
 * Debounced search against the route handlers. "Loading" is derived (a query with no
 * reply yet), so effects only set state from replies, never synchronously.
 */
export function useTitleSearch(input: string, session: number): SearchOutcome {
  const query = input.trim();
  // Replies carry the sheet opening they belong to, so reopening the sheet never shows an old answer.
  const [replies, setReplies] = useState<{ session: number; library: LibraryReply | null; tmdb: TmdbReply | null }>({
    session,
    library: null,
    tmdb: null,
  });

  useEffect(() => {
    if (query.length < MIN_QUERY_LENGTH) return;
    const controller = new AbortController();
    const { signal } = controller;
    const setLibrary = (library: LibraryReply) =>
      setReplies((current) => ({ session, library, tmdb: current.session === session ? current.tmdb : null }));
    const setTmdb = (tmdb: TmdbReply) =>
      setReplies((current) => ({ session, library: current.session === session ? current.library : null, tmdb }));

    const cached = readCached(query);
    if (cached) {
      // A microtask, not a timer: no wait is felt, and the effect still sets state only from a callback.
      void Promise.resolve().then(() => {
        if (signal.aborted) return;
        const fromCache = repliesFromCache(query, cached);
        setReplies({ session, library: fromCache.library, tmdb: fromCache.tmdb });
      });
      return () => controller.abort();
    }

    const timer = window.setTimeout(() => {
      const generation = cacheGeneration();
      const libraryReply = loadLibrary(query, signal).then((result) => {
        if (result) setLibrary(result);
        return result;
      });
      const tmdbReply = loadTmdb(query, signal).then((result) => {
        if (result) setTmdb(result);
        return result;
      });
      void Promise.all([libraryReply, tmdbReply]).then(([libraryResult, tmdbResult]) => {
        // A clear since the fetch began means a save may have changed the answer.
        if (signal.aborted || generation !== cacheGeneration() || !libraryResult?.items || !tmdbResult?.ok) return;
        writeCached(query, { library: libraryResult.items, tmdb: tmdbResult.items });
      });
    }, DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, session]);

  const current = replies.session === session ? replies : { library: null, tmdb: null };
  return deriveSearchView(query, current.library, current.tmdb);
}
