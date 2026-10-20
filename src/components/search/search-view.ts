import type { CachedSearch } from "@/components/search/search-cache";
import type { SearchItem } from "@/data/dto";

export const MIN_QUERY_LENGTH = 2;

export type SearchOutcome =
  | { phase: "idle" }
  | { phase: "loading"; library: SearchItem[] }
  | { phase: "results"; query: string; library: SearchItem[]; items: SearchItem[] }
  | { phase: "empty"; query: string }
  | { phase: "error"; message: string; signedOut: boolean; library: SearchItem[] };

export type TmdbReply =
  | { query: string; ok: true; items: SearchItem[] }
  | { query: string; ok: false; message: string; signedOut: boolean };

// `items` is null when the Library request failed; the screen then shows no Library section.
export type LibraryReply = { query: string; items: SearchItem[] | null };

const titleKey = (item: SearchItem) => `${item.kind}:${item.tmdbId}`;

/** The two replies a cached answer stands for, so a cache hit takes the same path as a fetch. */
export function repliesFromCache(query: string, cached: CachedSearch): { library: LibraryReply; tmdb: TmdbReply } {
  return { library: { query, items: cached.library }, tmdb: { query, ok: true, items: cached.tmdb } };
}

/**
 * What the sheet shows for the typed text. A reply for an older query counts as no reply,
 * so a slow answer to a previous word never reaches the screen.
 */
export function deriveSearchView(
  input: string,
  libraryReply: LibraryReply | null,
  tmdbReply: TmdbReply | null,
): SearchOutcome {
  const query = input.trim();
  if (query.length < MIN_QUERY_LENGTH) return { phase: "idle" };

  const library = libraryReply !== null && libraryReply.query === query ? libraryReply : null;
  const tmdb = tmdbReply !== null && tmdbReply.query === query ? tmdbReply : null;
  const libraryItems = library?.items ?? [];

  if (tmdb === null) return { phase: "loading", library: libraryItems };
  if (!tmdb.ok) return { phase: "error", message: tmdb.message, signedOut: tmdb.signedOut, library: libraryItems };

  const shown = new Set(libraryItems.map(titleKey));
  const items = tmdb.items.filter((item) => !shown.has(titleKey(item)));
  // Waiting for the Library answer keeps rows from moving under the finger when it lands after TMDB's.
  if (library === null) return { phase: "loading", library: [] };
  if (libraryItems.length === 0 && items.length === 0) return { phase: "empty", query };
  return { phase: "results", query, library: libraryItems, items };
}
