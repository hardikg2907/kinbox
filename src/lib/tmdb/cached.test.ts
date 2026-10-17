import { cacheLife } from "next/cache";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getMovie, getSeasons, getSeries, searchTitles } from "./cached";
import { TmdbUnavailableError } from "./real";
import type { TmdbClient } from "./types";

const client = vi.hoisted(() => ({
  searchMulti: vi.fn(),
  getMovie: vi.fn(),
  getSeries: vi.fn(),
  getSeasons: vi.fn(),
}));

vi.mock("./client", () => ({ getTmdbClient: (): TmdbClient => client }));
vi.mock("next/cache", async () => (await import("@/test/mocks")).nextCacheModule());

const calls = [
  ["searchTitles", () => searchTitles("dune"), client.searchMulti, "hours"],
  ["getMovie", () => getMovie(603), client.getMovie, "days"],
  ["getSeries", () => getSeries(1396), client.getSeries, "hours"],
  ["getSeasons", () => getSeasons(1396, [2, 1]), client.getSeasons, "hours"],
] as const;

beforeEach(() => {
  vi.mocked(cacheLife).mockClear();
  for (const method of Object.values(client)) method.mockReset();
});

describe.each(calls)("%s", (_, call, inner, life) => {
  it("hands back what TMDB returned, cached for the usual time", async () => {
    inner.mockResolvedValue([]);
    await expect(call()).resolves.toEqual([]);
    expect(vi.mocked(cacheLife).mock.calls).toEqual([[life]]);
  });

  it.each([503, 429, null])(
    "throws TmdbUnavailableError to the caller when TMDB fails (status %s), cached for seconds only",
    async (status) => {
      inner.mockRejectedValue(new TmdbUnavailableError(status === null ? {} : { status }));
      const error = await call().then(
        () => null,
        (thrown: unknown) => thrown,
      );
      expect(error).toBeInstanceOf(TmdbUnavailableError);
      expect(error).toMatchObject({ status });
      expect(vi.mocked(cacheLife).mock.calls).toEqual([["seconds"]]);
    },
  );

  it("lets any other error through", async () => {
    inner.mockRejectedValue(new Error("boom"));
    await expect(call()).rejects.toThrow("boom");
  });
});

describe("a Title TMDB does not list", () => {
  it.each([
    ["getMovie", () => getMovie(424242), client.getMovie, "days"],
    ["getSeries", () => getSeries(424242), client.getSeries, "hours"],
  ] as const)("%s gives null, cached for the usual time", async (_, call, inner, life) => {
    inner.mockResolvedValue(null);
    await expect(call()).resolves.toBeNull();
    expect(vi.mocked(cacheLife).mock.calls).toEqual([[life]]);
  });
});
