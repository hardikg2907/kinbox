"use client";

import { useEffect, useState } from "react";
import type { SearchItem } from "@/data/dto";

export const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 200;

export const TMDB_DOWN_MESSAGE = "Can't reach the movie database right now. Try again in a minute.";
const SEARCH_FAILED_MESSAGE = "Couldn't search right now. Check your connection and try again.";
const SIGNED_OUT_MESSAGE = "You were signed out. Sign in to keep searching.";

export type SearchOutcome =
  | { phase: "idle" }
  | { phase: "loading" }
  | { phase: "results"; query: string; items: SearchItem[] }
  | { phase: "empty"; query: string }
  | { phase: "error"; message: string; signedOut: boolean };

type Settled =
  | { query: string; ok: true; items: SearchItem[] }
  | { query: string; ok: false; message: string; signedOut: boolean };

// Returns null when the request was cancelled, so a stale reply never reaches the screen.
async function load(query: string, signal: AbortSignal): Promise<Settled | null> {
  try {
    const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal });
    if (response.status === 401) return { query, ok: false, message: SIGNED_OUT_MESSAGE, signedOut: true };
    if (response.status === 503) return { query, ok: false, message: TMDB_DOWN_MESSAGE, signedOut: false };
    if (!response.ok) return { query, ok: false, message: SEARCH_FAILED_MESSAGE, signedOut: false };
    const body: unknown = await response.json();
    const results = typeof body === "object" && body !== null && "results" in body ? body.results : null;
    if (!Array.isArray(results)) return { query, ok: false, message: SEARCH_FAILED_MESSAGE, signedOut: false };
    return { query, ok: true, items: results as SearchItem[] };
  } catch {
    if (signal.aborted) return null;
    return { query, ok: false, message: SEARCH_FAILED_MESSAGE, signedOut: false };
  }
}

/**
 * Debounced search against the route handler. "Loading" is derived (a query with no
 * reply yet), so the effect only sets state from the reply, never synchronously.
 */
export function useTitleSearch(input: string): SearchOutcome {
  const query = input.trim();
  const [settled, setSettled] = useState<Settled | null>(null);

  useEffect(() => {
    if (query.length < MIN_QUERY_LENGTH) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void load(query, controller.signal).then((result) => {
        if (result) setSettled(result);
      });
    }, DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  if (query.length < MIN_QUERY_LENGTH) return { phase: "idle" };
  if (settled === null || settled.query !== query) return { phase: "loading" };
  if (!settled.ok) return { phase: "error", message: settled.message, signedOut: settled.signedOut };
  if (settled.items.length === 0) return { phase: "empty", query };
  return { phase: "results", query, items: settled.items };
}
