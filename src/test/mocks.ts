// Module stand-ins for tests: the real ones need the Next.js runtime, a session or the network.
// Use them from a test file as:
//   vi.mock("@/data/session", async () => (await import("@/test/mocks")).sessionModule());
import { vi } from "vitest";
import type { Owner } from "@/data/session";
import { ImdbFileError } from "@/lib/imdb/file-error";
import type { ImdbRating, ImdbRatingsResult, ReadImdbRatingsOptions } from "@/lib/imdb/ratings-file";
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
  /** TMDB ids whose request fails with this HTTP status. */
  tmdbStatusFor: new Map<number, number>(),
  /** Search texts whose search fails, written as the client receives them: trimmed and lower case. */
  tmdbSearchDownFor: new Set<string>(),
  afterTasks: [] as Promise<unknown>[],
  /** What the stand-in for IMDb's ratings file holds; ids a test does not set have no rating. */
  imdbRatings: new Map<string, ImdbRating>(),
  imdbDown: false,
  /** Answers 304 when the caller sends the ETag. */
  imdbUnchanged: false,
  imdbEtag: '"fixture-etag"' as string | null,
  /** One entry per read the stand-in served, with the wanted ids and the ETag that was sent. */
  imdbCalls: [] as { wanted: string[]; etag: string | null | undefined }[],
  /** Runs inside a read, before it answers, so a test can change what happens during a run. */
  imdbOnRead: null as (() => Promise<void>) | null,
};

// Kept apart from testState so a reset cannot drop a task that is still running; the next
// database reset waits for these instead of racing them.
const runningAfterTasks = new Set<Promise<unknown>>();

/** Waits for every `after` task started so far, including ones an earlier test never flushed. */
export async function settleAfterTasks(): Promise<void> {
  await Promise.allSettled([...runningAfterTasks]);
}

export function resetTestState(): void {
  testState.owner = OWNER_A;
  testState.today = TODAY;
  testState.tmdbDown = false;
  testState.tmdbDownFor.clear();
  testState.tmdbStatusFor.clear();
  testState.tmdbSearchDownFor.clear();
  testState.afterTasks = [];
  testState.imdbRatings.clear();
  testState.imdbDown = false;
  testState.imdbUnchanged = false;
  testState.imdbEtag = '"fixture-etag"';
  testState.imdbCalls = [];
  testState.imdbOnRead = null;
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
      const running = Promise.resolve().then(task);
      testState.afterTasks.push(running);
      runningAfterTasks.add(running);
      const done = () => runningAfterTasks.delete(running);
      running.then(done, done);
    },
  };
}

// Stands in for IMDb's ratings file, so no test downloads it.
export function imdbRatingsFileModule() {
  return {
    ImdbFileError,
    readImdbRatings: async (
      wanted: ReadonlySet<string>,
      options: ReadImdbRatingsOptions = {},
    ): Promise<ImdbRatingsResult> => {
      testState.imdbCalls.push({ wanted: [...wanted], etag: options.etag });
      await testState.imdbOnRead?.();
      if (testState.imdbDown) throw new ImdbFileError("fetch_failed");
      if (testState.imdbUnchanged && options.etag) return { kind: "unchanged" };
      const ratings = new Map<string, ImdbRating>();
      for (const id of wanted) {
        const found = testState.imdbRatings.get(id);
        if (found) ratings.set(id, found);
      }
      return { kind: "read", etag: testState.imdbEtag, ratings };
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
    const status = tmdbId === undefined ? undefined : testState.tmdbStatusFor.get(tmdbId);
    if (status !== undefined) throw new TmdbUnavailableError({ status });
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
    // Built from this stand-in's own methods, so a test that replaces one of them is honoured.
    getSeriesWithSeasons: async (tmdbId) => {
      guard(tmdbId);
      const details = await client.getSeries(tmdbId);
      if (details === null) return null;
      const seasons = await client.getSeasons(
        tmdbId,
        details.seasons.map((season) => season.seasonNumber),
      );
      return { details, seasons };
    },
    getSeasons: async (tmdbId, seasonNumbers) => {
      guard(tmdbId);
      return fake.getSeasons(tmdbId, seasonNumbers);
    },
  };
  return { getTmdbClient: () => client };
}
