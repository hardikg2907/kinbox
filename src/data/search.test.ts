import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { closeDb } from "@/db/client";
import { TmdbUnavailableError } from "@/lib/tmdb/real";
import { insertEntry, resetDatabase, setEntryTimes } from "@/test/db";
import { OWNER_A, OWNER_B, resetTestState, signInAs, testState, TMDB } from "@/test/mocks";
import { saveTitle } from "./entries";
import { searchLibrary, searchTitles } from "./search";

vi.mock("@/data/session", async () => (await import("@/test/mocks")).sessionModule());
vi.mock("@/data/today", async () => (await import("@/test/mocks")).todayModule());
vi.mock("@/lib/tmdb/client", async () => (await import("@/test/mocks")).tmdbClientModule());
vi.mock("next/cache", async () => (await import("@/test/mocks")).nextCacheModule());
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

describe("searchLibrary", () => {
  const names = (items: { name: string }[]) => items.map((item) => item.name);

  it("finds the Owner's Titles by part of the name, ignoring case, with their Entry", async () => {
    const { entryId } = await insertEntry({ owner: OWNER_A, status: "watching", name: "The Matrix Reloaded" });
    await insertEntry({ owner: OWNER_A, status: "watched", name: "Inception" });

    expect(await searchLibrary("MATRIX")).toEqual([
      {
        kind: "movie",
        tmdbId: expect.any(Number),
        name: "The Matrix Reloaded",
        year: null,
        posterPath: null,
        entry: { id: entryId, status: "watching" },
      },
    ]);
  });

  it("never returns the Titles of another Owner", async () => {
    await insertEntry({ owner: OWNER_A, status: "watched", name: "Secret Film" });
    signInAs(OWNER_B);
    expect(await searchLibrary("secret")).toEqual([]);
  });

  it("matches % and _ literally", async () => {
    await insertEntry({ owner: OWNER_A, status: "watched", name: "100% Wolf" });
    await insertEntry({ owner: OWNER_A, status: "watched", name: "Wolf_Man" });
    await insertEntry({ owner: OWNER_A, status: "watched", name: "WolfXMan" });
    await insertEntry({ owner: OWNER_A, status: "watched", name: "Back\\Slash" });

    expect(names(await searchLibrary("%"))).toEqual(["100% Wolf"]);
    expect(names(await searchLibrary("f_m"))).toEqual(["Wolf_Man"]);
    expect(names(await searchLibrary("k\\s"))).toEqual(["Back\\Slash"]);
    expect(await searchLibrary("   ")).toEqual([]);
  });

  it("returns at most 5, names starting with the text first, then the most recently changed", async () => {
    const day = (n: number) => new Date(Date.UTC(2026, 0, n));
    for (let n = 1; n <= 4; n++) {
      const { entryId } = await insertEntry({ owner: OWNER_A, status: "watched", name: `A Star ${n}` });
      await setEntryTimes(entryId, { statusChangedAt: day(10 + n) });
    }
    const { entryId: starts } = await insertEntry({ owner: OWNER_A, status: "watched", name: "Star Old" });
    await setEntryTimes(starts, { statusChangedAt: day(1) });
    const { entryId: startsNew } = await insertEntry({ owner: OWNER_A, status: "watched", name: "Star New" });
    await setEntryTimes(startsNew, { statusChangedAt: day(2) });

    expect(names(await searchLibrary("star"))).toEqual(["Star New", "Star Old", "A Star 4", "A Star 3", "A Star 2"]);
  });

  it("uses the later of the Status change and the Progress move", async () => {
    const day = (n: number) => new Date(Date.UTC(2026, 0, n));
    const { entryId: moved } = await insertEntry({ owner: OWNER_A, status: "watching", name: "Show One" });
    await setEntryTimes(moved, { statusChangedAt: day(1), progressMovedAt: day(20) });
    const { entryId: other } = await insertEntry({ owner: OWNER_A, status: "watching", name: "Show Two" });
    await setEntryTimes(other, { statusChangedAt: day(10) });

    expect(names(await searchLibrary("show"))).toEqual(["Show One", "Show Two"]);
  });
});
