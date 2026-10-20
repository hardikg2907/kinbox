import type { SearchItem } from "@/data/dto";

export type CachedSearch = { library: SearchItem[]; tmdb: SearchItem[] };

export const MAX_CACHED_SEARCHES = 30;
export const CACHE_TTL_MS = 10 * 60 * 1000;

type Slot = { value: CachedSearch; storedAt: number };

// A Map keeps insertion order, so the first key is always the least recently used one.
const slots = new Map<string, Slot>();

/** The same key for "Dune", " dune " and "DUNE  Part Two" ("dune part two"). */
export function cacheKey(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, " ");
}

export function readCached(query: string, now = Date.now()): CachedSearch | null {
  const key = cacheKey(query);
  const slot = slots.get(key);
  if (!slot) return null;
  if (now - slot.storedAt >= CACHE_TTL_MS) {
    slots.delete(key);
    return null;
  }
  slots.delete(key);
  slots.set(key, slot);
  return slot.value;
}

export function writeCached(query: string, value: CachedSearch, now = Date.now()): void {
  const key = cacheKey(query);
  slots.delete(key);
  slots.set(key, { value, storedAt: now });
  while (slots.size > MAX_CACHED_SEARCHES) {
    const oldest = slots.keys().next().value;
    if (oldest === undefined) break;
    slots.delete(oldest);
  }
}

let generation = 0;

/** Changes on every clear, so a fetch that began before a clear can tell its answer is outdated. */
export function cacheGeneration(): number {
  return generation;
}

/**
 * Called when the search sheet opens, after a save made from search, and on sign-out. Saves made
 * elsewhere in the app do not clear it: the sheet is closed then, and opening it clears it.
 */
export function clearSearchCache(): void {
  generation += 1;
  slots.clear();
}
