import { beforeEach, describe, expect, it } from "vitest";
import {
  cacheKey,
  CACHE_TTL_MS,
  clearSearchCache,
  MAX_CACHED_SEARCHES,
  readCached,
  writeCached,
  type CachedSearch,
} from "./search-cache";

const answer = (label: string): CachedSearch => ({
  library: [],
  tmdb: [{ kind: "movie", tmdbId: label.length, name: label, year: null, posterPath: null, entry: null }],
});

beforeEach(() => clearSearchCache());

describe("search cache", () => {
  it("shares one key across case, outer spaces and inner spaces", () => {
    expect(cacheKey("  DUNE   Part  Two ")).toBe("dune part two");
    writeCached("Dune", answer("a"));
    expect(readCached("  dUNE ")).toEqual(answer("a"));
    expect(readCached("dune two")).toBeNull();
  });

  it("drops the least recently used key past 30", () => {
    for (let n = 0; n < MAX_CACHED_SEARCHES; n++) writeCached(`q${n}`, answer(`v${n}`));
    readCached("q0");
    writeCached("extra", answer("x"));
    expect(readCached("q1")).toBeNull();
    expect(readCached("q0")).not.toBeNull();
    expect(readCached("extra")).not.toBeNull();
  });

  it("expires an answer after 10 minutes", () => {
    writeCached("dune", answer("a"), 1_000);
    expect(readCached("dune", 1_000 + CACHE_TTL_MS - 1)).not.toBeNull();
    expect(readCached("dune", 1_000 + CACHE_TTL_MS)).toBeNull();
  });

  it("does not extend the age of an answer when it is read", () => {
    writeCached("dune", answer("a"), 0);
    readCached("dune", CACHE_TTL_MS - 1);
    expect(readCached("dune", CACHE_TTL_MS + 1)).toBeNull();
  });

  it("forgets everything when cleared", () => {
    writeCached("dune", answer("a"));
    clearSearchCache();
    expect(readCached("dune")).toBeNull();
  });
});
