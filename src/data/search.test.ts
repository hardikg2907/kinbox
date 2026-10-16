import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { closeDb } from "@/db/client";
import { TmdbUnavailableError } from "@/lib/tmdb/real";
import { insertEntry, resetDatabase } from "@/test/db";
import { OWNER_A, OWNER_B, resetTestState, signInAs, testState, TMDB } from "@/test/mocks";
import { saveTitle } from "./entries";
import { searchTitles } from "./search";

vi.mock("@/data/session", async () => (await import("@/test/mocks")).sessionModule());
vi.mock("@/data/today", async () => (await import("@/test/mocks")).todayModule());
vi.mock("@/lib/tmdb/cached", async () => (await import("@/test/mocks")).tmdbCachedModule());
vi.mock("next/server", async () => (await import("@/test/mocks")).nextServerModule());

beforeEach(async () => {
  resetTestState();
  await resetDatabase();
});

afterAll(async () => {
  await closeDb();
});

describe("searchTitles", () => {
  it("returns TMDB matches with the Owner's Entry when the Title is in the Library", async () => {
    expect(await searchTitles("breaking")).toEqual([
      {
        kind: "series",
        tmdbId: TMDB.breakingBad,
        name: "Breaking Bad",
        year: 2008,
        posterPath: expect.any(String),
        entry: null,
      },
    ]);

    const { entryId } = await saveTitle(OWNER_A, { kind: "series", tmdbId: TMDB.breakingBad, status: "watching" });
    const [item] = await searchTitles("breaking");
    expect(item?.entry).toEqual({ id: entryId, status: "watching" });
  });

  it("matches on kind as well as TMDB id", async () => {
    await insertEntry({ owner: OWNER_A, status: "watched", kind: "movie", tmdbId: TMDB.breakingBad });
    const [item] = await searchTitles("breaking");
    expect(item?.entry).toBeNull();
  });

  it("never shows Owner B the Entries of Owner A", async () => {
    await saveTitle(OWNER_A, { kind: "movie", tmdbId: TMDB.inception, status: "watched" });
    signInAs(OWNER_B);
    const [item] = await searchTitles("inception");
    expect(item).toMatchObject({ tmdbId: TMDB.inception, entry: null });
  });

  it("returns nothing for blank or unmatched text, and throws when TMDB is down", async () => {
    expect(await searchTitles("   ")).toEqual([]);
    expect(await searchTitles("zzzz-no-such-title")).toEqual([]);
    testState.tmdbDown = true;
    await expect(searchTitles("dune")).rejects.toBeInstanceOf(TmdbUnavailableError);
  });
});
