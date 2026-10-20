// Module stand-ins for tests: the real ones need the Next.js runtime, a session or the network.
// Use them from a test file as:
//   vi.mock("@/data/session", async () => (await import("@/test/mocks")).sessionModule());
import { vi } from "vitest";
import type { Owner } from "@/data/session";
import { createFakeTmdbClient } from "@/lib/tmdb/fake";
import { TmdbUnavailableError } from "@/lib/tmdb/real";
import type { TmdbClient } from "@/lib/tmdb/types";

export const OWNER_A: Owner = { id: "owner-a", name: "Owner A" };
export const OWNER_B: Owner = { id: "owner-b", name: "Owner B" };
export const TODAY = "2026-10-16";

/** Fixture TMDB ids. */
export const TMDB = {
  inception: 27205,
  matrix: 603,
  dune: 693134,
  /** Ended, with Specials: Season 1 (7) and Season 2 (13). */
  breakingBad: 1396,
  /** Canceled: two Seasons of 10. */
  westworld: 63247,
  /** Returning Series: Season 1 (15 aired), Season 2 (10 aired, 6 not yet). */
  thePitt: 250307,
} as const;

export const testState = {
  owner: OWNER_A as Owner | null,
  today: TODAY,
  tmdbDown: false,
  tmdbDownFor: new Set<number>(),
  /** Search texts whose search fails, written as the client receives them: trimmed and lower case. */
  tmdbSearchDownFor: new Set<string>(),
  afterTasks: [] as Promise<unknown>[],
};

export function resetTestState(): void {
  testState.owner = OWNER_A;
  testState.today = TODAY;
  testState.tmdbDown = false;
  testState.tmdbDownFor.clear();
  testState.tmdbSearchDownFor.clear();
  testState.afterTasks = [];
}

export function signInAs(owner: Owner | null): void {
  testState.owner = owner;
}

export async function flushAfter(): Promise<void> {
  await Promise.all(testState.afterTasks.splice(0));
}

export function sessionModule() {
  return {
    getOwner: async () => testState.owner,
    requireOwner: async () => {
      // The real one redirects, which throws; a test only needs to see that it threw.
      if (!testState.owner) throw new Error("NEXT_REDIRECT /sign-in");
      return testState.owner;
    },
  };
}

export function todayModule() {
  return { getToday: async () => testState.today };
}

export function nextCacheModule() {
  return { refresh: vi.fn(), cacheLife: vi.fn() };
}

export function nextServerModule() {
  return {
    after: (task: () => unknown) => {
      testState.afterTasks.push(Promise.resolve().then(task));
    },
  };
}

// Stands in for the TMDB client, not the cached layer, so tests go through the same
// wrap and unwrap of TMDB failures that production does.
export function tmdbClientModule() {
  const fake = createFakeTmdbClient();
  const guard = (tmdbId?: number) => {
    if (testState.tmdbDown || (tmdbId !== undefined && testState.tmdbDownFor.has(tmdbId))) {
      throw new TmdbUnavailableError({ status: 503 });
    }
  };
  const client: TmdbClient = {
    searchMulti: async (query) => {
      guard();
      if (testState.tmdbSearchDownFor.has(query)) throw new TmdbUnavailableError({ status: 503 });
      return fake.searchMulti(query);
    },
    getMovie: async (tmdbId) => {
      guard(tmdbId);
      return fake.getMovie(tmdbId);
    },
    getSeries: async (tmdbId) => {
      guard(tmdbId);
      return fake.getSeries(tmdbId);
    },
    getSeasons: async (tmdbId, seasonNumbers) => {
      guard(tmdbId);
      return fake.getSeasons(tmdbId, seasonNumbers);
    },
  };
  return { getTmdbClient: () => client };
}
