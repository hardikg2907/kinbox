"use client";

import { useEffect, useState } from "react";
import { readCached, writeCached } from "@/components/search/search-cache";
import type { SearchItem } from "@/data/dto";

export const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 200;

export const TMDB_DOWN_MESSAGE = "Can't reach the movie database right now. Try again in a minute.";
const SEARCH_FAILED_MESSAGE = "Couldn't search right now. Check your connection and try again.";
const SIGNED_OUT_MESSAGE = "You were signed out. Sign in to keep searching.";

export type SearchOutcome =
  | { phase: "idle" }
  | { phase: "loading"; library: SearchItem[] }
  | { phase: "results"; query: string; library: SearchItem[]; items: SearchItem[] }
  | { phase: "empty"; query: string }
  | { phase: "error"; message: string; signedOut: boolean; library: SearchItem[] };

type TmdbSettled =
  | { query: string; ok: true; items: SearchItem[] }
  | { query: string; ok: false; message: string; signedOut: boolean };

// `items` is null when the Library request failed; the screen then simply shows no Library section.
type LibrarySettled = { query: string; items: SearchItem[] | null };

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
async function loadTmdb(query: string, signal: AbortSignal): Promise<TmdbSettled | null> {
  const reply = await fetchResults(`/api/search?q=${encodeURIComponent(query)}`, signal);
  if (reply === null) return null;
  if (reply.status === 401) return { query, ok: false, message: SIGNED_OUT_MESSAGE, signedOut: true };
  if (reply.status === 503) return { query, ok: false, message: TMDB_DOWN_MESSAGE, signedOut: false };
  if (reply.results === null) return { query, ok: false, message: SEARCH_FAILED_MESSAGE, signedOut: false };
  return { query, ok: true, items: reply.results };
}

async function loadLibrary(query: string, signal: AbortSignal): Promise<LibrarySettled | null> {
  const reply = await fetchResults(`/api/search/library?q=${encodeURIComponent(query)}`, signal);
  if (reply === null) return null;
  return { query, items: reply.results };
}

const titleKey = (item: SearchItem) => `${item.kind}:${item.tmdbId}`;

/**
 * Debounced search against the route handlers. "Loading" is derived (a query with no
 * reply yet), so effects only set state from replies, never synchronously.
 */
export function useTitleSearch(input: string): SearchOutcome {
  const query = input.trim();
  const [tmdb, setTmdb] = useState<TmdbSettled | null>(null);
  const [library, setLibrary] = useState<LibrarySettled | null>(null);

  useEffect(() => {
    if (query.length < MIN_QUERY_LENGTH) return;
    const controller = new AbortController();
    const { signal } = controller;

    const cached = readCached(query);
    if (cached) {
      // A microtask, not a timer: no wait is felt, and the effect still sets state only from a callback.
      void Promise.resolve().then(() => {
        if (signal.aborted) return;
        setLibrary({ query, items: cached.library });
        setTmdb({ query, ok: true, items: cached.tmdb });
      });
      return () => controller.abort();
    }

    const timer = window.setTimeout(() => {
      const libraryReply = loadLibrary(query, signal).then((result) => {
        if (result) setLibrary(result);
        return result;
      });
      const tmdbReply = loadTmdb(query, signal).then((result) => {
        if (result) setTmdb(result);
        return result;
      });
      void Promise.all([libraryReply, tmdbReply]).then(([libraryResult, tmdbResult]) => {
        if (signal.aborted || !libraryResult?.items || !tmdbResult?.ok) return;
        writeCached(query, { library: libraryResult.items, tmdb: tmdbResult.items });
      });
    }, DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  if (query.length < MIN_QUERY_LENGTH) return { phase: "idle" };
  const libraryItems = library !== null && library.query === query ? (library.items ?? []) : [];
  const libraryPending = library === null || library.query !== query;
  if (tmdb === null || tmdb.query !== query) return { phase: "loading", library: libraryItems };
  if (!tmdb.ok) return { phase: "error", message: tmdb.message, signedOut: tmdb.signedOut, library: libraryItems };

  const shown = new Set(libraryItems.map(titleKey));
  const items = tmdb.items.filter((item) => !shown.has(titleKey(item)));
  if (libraryItems.length === 0 && items.length === 0) {
    // TMDB found nothing, but the Library answer may still bring a match.
    return libraryPending ? { phase: "loading", library: [] } : { phase: "empty", query };
  }
  return { phase: "results", query, library: libraryItems, items };
}
