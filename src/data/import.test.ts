import { and, asc, count, eq, inArray, isNull, sql } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Status, TitleKind } from "@/domain/types";
import { closeDb, db } from "@/db/client";
import { entries, episodeProgress, imports, titles, watches } from "@/db/schema";
import { getTmdbClient } from "@/lib/tmdb/client";
import { entryRow, resetDatabase, setEntryTimes, tickKeys, watchRows } from "@/test/db";
import { OWNER_A, OWNER_B, resetTestState, testState, TMDB, TODAY } from "@/test/mocks";
import {
  deleteWatch,
  saveTitle,
  setNote,
  setRating,
  setStatus,
  setWatchDate,
  undoStatusMove,
  watchAgain,
} from "./entries";
import { MESSAGES } from "./errors";
import { addImportRows, finishImport, startImport, undoImport } from "./import";
import { tickEpisode } from "./progress";
import type { Owner } from "./session";

vi.mock("@/data/session", async () => (await import("@/test/mocks")).sessionModule());
vi.mock("@/data/today", async () => (await import("@/test/mocks")).todayModule());
vi.mock("@/lib/tmdb/client", async () => (await import("@/test/mocks")).tmdbClientModule());
vi.mock("next/cache", async () => (await import("@/test/mocks")).nextCacheModule());
vi.mock("next/server", async () => (await import("@/test/mocks")).nextServerModule());

type Row = { kind: TitleKind; tmdbId: number; intent: Status };

const movie = (tmdbId: number, intent: Status): Row => ({ kind: "movie", tmdbId, intent });
const series = (tmdbId: number, intent: Status): Row => ({ kind: "series", tmdbId, intent });

const OLD = new Date("2020-01-01T00:00:00Z");

async function addRows(rows: Row[], owner: Owner = OWNER_A) {
  const { importId } = await startImport(owner);
  return { importId, results: await addImportRows(owner, { importId, rows }) };
}

async function entryOf(owner: Owner, kind: TitleKind, tmdbId: number) {
  const [row] = await db()
    .select({ id: entries.id })
    .from(entries)
    .innerJoin(titles, eq(entries.titleId, titles.id))
    .where(and(eq(entries.userId, owner.id), eq(titles.kind, kind), eq(titles.tmdbId, tmdbId)));
  if (!row) throw new Error(`No Entry for ${kind} ${tmdbId}`);
  return (await entryRow(row.id))!;
}

async function entryCount(owner: Owner): Promise<number> {
  const [row] = await db().select({ n: count() }).from(entries).where(eq(entries.userId, owner.id));
  return row?.n ?? 0;
}

async function importsOf(owner: Owner) {
  return db()
    .select({ id: imports.id, open: isNull(imports.finishedAt) })
    .from(imports)
    .where(eq(imports.userId, owner.id))
    .orderBy(asc(imports.createdAt));
}

async function importedEntryIds(importId: string): Promise<string[]> {
  const rows = await db().select({ id: entries.id }).from(entries).where(eq(entries.importId, importId));
  return rows.map((row) => row.id).sort();
}

/** The Watches and ticks still pointing at these Entries. */
async function rowsUnder(entryIds: string[]) {
  const [watchCount] = await db()
    .select({ n: count() })
    .from(watches)
    .where(inArray(watches.entryId, entryIds));
  const [tickCount] = await db()
    .select({ n: count() })
    .from(episodeProgress)
    .where(inArray(episodeProgress.entryId, entryIds));
  return { watches: watchCount?.n ?? 0, ticks: tickCount?.n ?? 0 };
}

/** An Entry with its Watches and ticks, to show a step left them exactly as they were. */
async function entryWithRows(entryId: string) {
  return { entry: await entryRow(entryId), watches: await watchRows(entryId), ticks: await tickKeys(entryId) };
}

async function finishedAtText(importId: string) {
  const [row] = await db()
    .select({ finishedAt: sql<string | null>`${imports.finishedAt}::text` })
    .from(imports)
    .where(eq(imports.id, importId));
  return row?.finishedAt;
}

/**
 * Whether every stamp on an Entry and its rows equals the Entry's created_at. Compared in the
 * database, since a JS Date drops the microseconds Postgres keeps.
 */
async function stampsAgainstCreation(entryId: string) {
  const [entry] = await db()
    .select({
      statusChangedAt: sql<boolean>`${entries.statusChangedAt} = ${entries.createdAt}`,
      progressMovedAt: sql<boolean | null>`${entries.progressMovedAt} = ${entries.createdAt}`,
    })
    .from(entries)
    .where(eq(entries.id, entryId));
  const watchStamps = await db()
    .select({ same: sql<boolean>`${watches.createdAt} = ${entries.createdAt}` })
    .from(watches)
    .innerJoin(entries, eq(watches.entryId, entries.id))
    .where(eq(watches.entryId, entryId))
    .orderBy(asc(watches.createdAt));
  const tickStamps = await db()
    .select({ same: sql<boolean>`${episodeProgress.createdAt} = ${entries.createdAt}` })
    .from(episodeProgress)
    .innerJoin(entries, eq(episodeProgress.entryId, entries.id))
    .where(eq(episodeProgress.entryId, entryId));
  return {
    ...entry,
    watches: watchStamps.map((row) => row.same),
    ticks: [...new Set(tickStamps.map((row) => row.same))],
  };
}

beforeEach(async () => {
  resetTestState();
  await resetDatabase();
});

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(async () => {
  await closeDb();
});

describe("addImportRows: what gets saved", () => {
  it("saves any intent on a Title that is not out yet as To watch, with no Watch and no ticks", async () => {
    // Before Inception, Dune, Westworld and The Pitt came out.
    testState.today = "2010-01-01";
    const rows = [
      movie(TMDB.inception, "watched"),
      movie(TMDB.dune, "watching"),
      series(TMDB.westworld, "watched"),
      series(TMDB.thePitt, "dropped"),
    ];

    const { results } = await addRows(rows);

    expect(results).toEqual(
      rows.map(({ kind, tmdbId }) => ({ kind, tmdbId, result: "added", status: "to_watch", caughtUp: false })),
    );
    for (const { kind, tmdbId } of rows) {
      const entry = await entryOf(OWNER_A, kind, tmdbId);
      expect(entry.status).toBe("to_watch");
      expect(await watchRows(entry.id)).toEqual([]);
      expect(await tickKeys(entry.id)).toEqual([]);
    }
  });

  it("saves To watch, Watching and Dropped as asked, with no Watch and no ticks", async () => {
    const rows = [
      movie(TMDB.inception, "to_watch"),
      movie(TMDB.matrix, "watching"),
      movie(TMDB.dune, "dropped"),
      series(TMDB.breakingBad, "watching"),
      series(TMDB.thePitt, "dropped"),
    ];

    const { results } = await addRows(rows);

    expect(results).toEqual(
      rows.map(({ kind, tmdbId, intent }) => ({ kind, tmdbId, result: "added", status: intent, caughtUp: false })),
    );
    for (const { kind, tmdbId, intent } of rows) {
      const entry = await entryOf(OWNER_A, kind, tmdbId);
      expect(entry.status).toBe(intent);
      expect(await watchRows(entry.id)).toEqual([]);
      expect(await tickKeys(entry.id)).toEqual([]);
      expect(entry.progressMovedAt).toBeNull();
    }
  });

  it("saves a watched Movie as Watched with one Watch of unknown date", async () => {
    const { results } = await addRows([movie(TMDB.matrix, "watched")]);

    expect(results).toEqual([
      { kind: "movie", tmdbId: TMDB.matrix, result: "added", status: "watched", caughtUp: false },
    ]);
    const entry = await entryOf(OWNER_A, "movie", TMDB.matrix);
    expect(entry.status).toBe("watched");
    expect(await watchRows(entry.id)).toEqual([{ id: expect.any(String), watchedOn: null }]);
    expect(await tickKeys(entry.id)).toEqual([]);
  });

  it("saves a watched finished Series as Watched with a Watch of unknown date, ticking every aired numbered Episode", async () => {
    const { results } = await addRows([series(TMDB.breakingBad, "watched"), series(TMDB.westworld, "watched")]);

    expect(results).toEqual([
      { kind: "series", tmdbId: TMDB.breakingBad, result: "added", status: "watched", caughtUp: false },
      { kind: "series", tmdbId: TMDB.westworld, result: "added", status: "watched", caughtUp: false },
    ]);
    const ended = await entryOf(OWNER_A, "series", TMDB.breakingBad);
    const ticks = await tickKeys(ended.id);
    expect(ticks).toHaveLength(20);
    expect(ticks.some((key) => key.startsWith("0:"))).toBe(false);
    expect(await watchRows(ended.id)).toEqual([{ id: expect.any(String), watchedOn: null }]);

    const canceled = await entryOf(OWNER_A, "series", TMDB.westworld);
    expect(await tickKeys(canceled.id)).toHaveLength(20);
    expect(await watchRows(canceled.id)).toHaveLength(1);
  });

  it("saves a watched unfinished Series as Watching and caught up, with no Watch", async () => {
    const { results } = await addRows([series(TMDB.thePitt, "watched")]);

    expect(results).toEqual([
      { kind: "series", tmdbId: TMDB.thePitt, result: "added", status: "watching", caughtUp: true },
    ]);
    const entry = await entryOf(OWNER_A, "series", TMDB.thePitt);
    expect(entry.status).toBe("watching");
    const ticks = await tickKeys(entry.id);
    expect(ticks).toHaveLength(25);
    expect(ticks).not.toContain("2:11");
    expect(await watchRows(entry.id)).toEqual([]);
  });

  it("saves a watched Series that is out but has no aired Episode as To watch", async () => {
    // TMDB lists the Series with no release date, and today is before its first Episode airs.
    const client = getTmdbClient();
    const getSeries = client.getSeries;
    vi.spyOn(client, "getSeries").mockImplementation(async (tmdbId) => {
      const details = await getSeries(tmdbId);
      return details && { ...details, releaseDate: null };
    });
    testState.today = "2024-12-01";

    const { results } = await addRows([series(TMDB.thePitt, "watched")]);

    expect(results).toEqual([
      { kind: "series", tmdbId: TMDB.thePitt, result: "added", status: "to_watch", caughtUp: false },
    ]);
    const entry = await entryOf(OWNER_A, "series", TMDB.thePitt);
    expect(await tickKeys(entry.id)).toEqual([]);
    expect(await watchRows(entry.id)).toEqual([]);
  });
});

describe("addImportRows: the Entries it writes", () => {
  it("links every added Entry to its Import, and a hand save to none", async () => {
    await saveTitle(OWNER_A, { kind: "movie", tmdbId: TMDB.dune, status: "to_watch" });
    const { importId } = await addRows([movie(TMDB.inception, "to_watch"), series(TMDB.thePitt, "watched")]);

    expect((await entryOf(OWNER_A, "movie", TMDB.inception)).importId).toBe(importId);
    expect((await entryOf(OWNER_A, "series", TMDB.thePitt)).importId).toBe(importId);
    expect((await entryOf(OWNER_A, "movie", TMDB.dune)).importId).toBeNull();
  });

  it("stamps an imported Entry, its Watch and its ticks with one time", async () => {
    await addRows([movie(TMDB.matrix, "watched"), series(TMDB.thePitt, "watched"), series(TMDB.breakingBad, "watched")]);

    const watchedMovie = await entryOf(OWNER_A, "movie", TMDB.matrix);
    expect(await stampsAgainstCreation(watchedMovie.id)).toEqual({
      statusChangedAt: true,
      progressMovedAt: null,
      watches: [true],
      ticks: [],
    });
    expect(watchedMovie.progressMovedAt).toBeNull();

    const caughtUp = await entryOf(OWNER_A, "series", TMDB.thePitt);
    expect(await stampsAgainstCreation(caughtUp.id)).toEqual({
      statusChangedAt: true,
      progressMovedAt: true,
      watches: [],
      ticks: [true],
    });

    const finished = await entryOf(OWNER_A, "series", TMDB.breakingBad);
    expect(await stampsAgainstCreation(finished.id)).toEqual({
      statusChangedAt: true,
      progressMovedAt: true,
      watches: [true],
      ticks: [true],
    });
  });

  it("writes the rows one after another, in the order given", async () => {
    const rows = [
      series(TMDB.breakingBad, "watched"),
      movie(TMDB.inception, "to_watch"),
      series(TMDB.westworld, "watched"),
      movie(TMDB.matrix, "watched"),
      movie(TMDB.dune, "to_watch"),
    ];

    await addRows(rows);

    const written = await db()
      .select({ tmdbId: titles.tmdbId, createdAt: sql<string>`${entries.createdAt}::text` })
      .from(entries)
      .innerJoin(titles, eq(entries.titleId, titles.id))
      .where(eq(entries.userId, OWNER_A.id))
      .orderBy(asc(entries.createdAt));
    expect(written.map((row) => row.tmdbId)).toEqual(rows.map((row) => row.tmdbId));
    expect(new Set(written.map((row) => row.createdAt)).size).toBe(rows.length);
  });

  it("leaves a Title already in the Library exactly as it was, whatever the intent", async () => {
    const { entryId: movieId } = await saveTitle(OWNER_A, { kind: "movie", tmdbId: TMDB.matrix, status: "to_watch" });
    const { entryId: seriesId } = await saveTitle(OWNER_A, {
      kind: "series",
      tmdbId: TMDB.breakingBad,
      status: "watching",
    });
    await setEntryTimes(movieId, { createdAt: OLD, statusChangedAt: OLD });
    await setEntryTimes(seriesId, { createdAt: OLD, statusChangedAt: OLD });
    const before = [await entryRow(movieId), await entryRow(seriesId)];

    const { results } = await addRows([movie(TMDB.matrix, "watched"), series(TMDB.breakingBad, "watched")]);

    expect(results).toEqual([
      { kind: "movie", tmdbId: TMDB.matrix, result: "already" },
      { kind: "series", tmdbId: TMDB.breakingBad, result: "already" },
    ]);
    expect([await entryRow(movieId), await entryRow(seriesId)]).toEqual(before);
    expect(await watchRows(movieId)).toEqual([]);
    expect(await watchRows(seriesId)).toEqual([]);
    expect(await tickKeys(seriesId)).toEqual([]);
    expect(await entryCount(OWNER_A)).toBe(2);
  });

  it("adds a Title named twice in one call once, and reports the second as already there", async () => {
    const { results } = await addRows([movie(TMDB.inception, "to_watch"), movie(TMDB.inception, "watched")]);

    expect(results).toEqual([
      { kind: "movie", tmdbId: TMDB.inception, result: "added", status: "to_watch", caughtUp: false },
      { kind: "movie", tmdbId: TMDB.inception, result: "already" },
    ]);
    const entry = await entryOf(OWNER_A, "movie", TMDB.inception);
    expect(await watchRows(entry.id)).toEqual([]);
    expect(await entryCount(OWNER_A)).toBe(1);
  });

  it("adds the other rows when one fails, and logs no Title or id", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    testState.tmdbDownFor.add(TMDB.matrix);
    const unknownId = 424242;

    const { results } = await addRows([
      movie(TMDB.inception, "watched"),
      movie(TMDB.matrix, "watched"),
      movie(unknownId, "to_watch"),
      series(TMDB.breakingBad, "watched"),
    ]);

    expect(results).toEqual([
      { kind: "movie", tmdbId: TMDB.inception, result: "added", status: "watched", caughtUp: false },
      { kind: "movie", tmdbId: TMDB.matrix, result: "failed" },
      { kind: "movie", tmdbId: unknownId, result: "failed" },
      { kind: "series", tmdbId: TMDB.breakingBad, result: "added", status: "watched", caughtUp: false },
    ]);
    expect(await entryCount(OWNER_A)).toBe(2);

    const output = JSON.stringify(logged.mock.calls);
    expect(logged).toHaveBeenCalled();
    for (const secret of ["Matrix", String(TMDB.matrix), String(unknownId), OWNER_A.id]) {
      expect(output).not.toContain(secret);
    }
  });

  it("fails a Series row whose Episodes cannot be loaded, and adds nothing for it", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const client = getTmdbClient();
    vi.spyOn(client, "getSeasons").mockRejectedValue(new Error("Seasons failed"));

    const { results } = await addRows([series(TMDB.thePitt, "watched"), movie(TMDB.dune, "to_watch")]);

    expect(results).toEqual([
      { kind: "series", tmdbId: TMDB.thePitt, result: "failed" },
      { kind: "movie", tmdbId: TMDB.dune, result: "added", status: "to_watch", caughtUp: false },
    ]);
    expect(await entryCount(OWNER_A)).toBe(1);
  });
});

describe("Imports", () => {
  it("closes the open Import when another starts, and refuses rows for the closed one", async () => {
    const first = await startImport(OWNER_A);
    const second = await startImport(OWNER_A);

    expect(second.importId).not.toBe(first.importId);
    expect(await importsOf(OWNER_A)).toEqual([
      { id: first.importId, open: false },
      { id: second.importId, open: true },
    ]);
    await expect(
      addImportRows(OWNER_A, { importId: first.importId, rows: [movie(TMDB.inception, "to_watch")] }),
    ).rejects.toThrow(MESSAGES.importFinished);
    expect(await entryCount(OWNER_A)).toBe(0);
  });

  it("leaves exactly one Import open when two start at once", async () => {
    const started = await Promise.all([startImport(OWNER_A), startImport(OWNER_A), startImport(OWNER_A)]);

    expect(new Set(started.map((s) => s.importId)).size).toBe(3);
    const all = await importsOf(OWNER_A);
    expect(all).toHaveLength(3);
    expect(all.filter((row) => row.open)).toHaveLength(1);
  });

  it("keeps each Owner's open Import apart", async () => {
    const a = await startImport(OWNER_A);
    const b = await startImport(OWNER_B);

    expect(await importsOf(OWNER_A)).toEqual([{ id: a.importId, open: true }]);
    expect(await importsOf(OWNER_B)).toEqual([{ id: b.importId, open: true }]);
  });

  it("refuses another Owner's Import, and an unknown one, with the same message and adds nothing", async () => {
    const { importId } = await startImport(OWNER_B);
    const rows = [movie(TMDB.inception, "to_watch")];

    await expect(addImportRows(OWNER_A, { importId, rows })).rejects.toThrow(MESSAGES.importFinished);
    await expect(
      addImportRows(OWNER_A, { importId: "00000000-0000-4000-8000-000000000000", rows }),
    ).rejects.toThrow(MESSAGES.importFinished);
    expect(await entryCount(OWNER_A)).toBe(0);
    expect(await entryCount(OWNER_B)).toBe(0);
  });

  it("finishes an Import, after which it takes no rows; finishing again is harmless", async () => {
    const { importId } = await startImport(OWNER_A);

    expect(await finishImport(OWNER_A, { importId })).toBeNull();
    expect(await importsOf(OWNER_A)).toEqual([{ id: importId, open: false }]);
    await expect(
      addImportRows(OWNER_A, { importId, rows: [movie(TMDB.inception, "to_watch")] }),
    ).rejects.toThrow(MESSAGES.importFinished);

    const [closed] = await db()
      .select({ finishedAt: sql<string>`${imports.finishedAt}::text` })
      .from(imports)
      .where(eq(imports.id, importId));
    expect(await finishImport(OWNER_A, { importId })).toBeNull();
    const [again] = await db()
      .select({ finishedAt: sql<string>`${imports.finishedAt}::text` })
      .from(imports)
      .where(eq(imports.id, importId));
    expect(again).toEqual(closed);
  });

  it("never finishes another Owner's Import", async () => {
    const { importId } = await startImport(OWNER_B);

    expect(await finishImport(OWNER_A, { importId })).toBeNull();
    expect(await importsOf(OWNER_B)).toEqual([{ id: importId, open: true }]);
  });
});

type Stamps = Awaited<ReturnType<typeof stampsAgainstCreation>>;
type Change = [name: string, row: Row, change: (entryId: string) => Promise<unknown>, stamps: Stamps];

async function onlyWatchId(entryId: string): Promise<string> {
  const [watch, ...more] = await watchRows(entryId);
  if (!watch || more.length > 0) throw new Error("Expected exactly one Watch");
  return watch.id;
}

// Each change trips a different part of the unchanged test; the stamps show which.
const CHANGES: Change[] = [
  [
    "a Status move",
    movie(TMDB.inception, "to_watch"),
    (entryId) => setStatus(OWNER_A, { entryId, status: "watching" }),
    { statusChangedAt: false, progressMovedAt: null, watches: [], ticks: [] },
  ],
  [
    "a tick",
    series(TMDB.thePitt, "watching"),
    (entryId) => tickEpisode(OWNER_A, { entryId, seasonNumber: 1, episodeNumber: 1, watched: true }),
    { statusChangedAt: true, progressMovedAt: false, watches: [], ticks: [false] },
  ],
  [
    "an untick",
    series(TMDB.breakingBad, "watched"),
    (entryId) => tickEpisode(OWNER_A, { entryId, seasonNumber: 1, episodeNumber: 1, watched: false }),
    { statusChangedAt: true, progressMovedAt: false, watches: [true], ticks: [true] },
  ],
  [
    "a Rating",
    movie(TMDB.matrix, "watched"),
    (entryId) => setRating(OWNER_A, { entryId, ratingHalfStars: 8 }),
    { statusChangedAt: true, progressMovedAt: null, watches: [true], ticks: [] },
  ],
  [
    "a Note",
    movie(TMDB.inception, "to_watch"),
    (entryId) => setNote(OWNER_A, { entryId, note: "Sam says the ending is worth it" }),
    { statusChangedAt: true, progressMovedAt: null, watches: [], ticks: [] },
  ],
  [
    "a new Watch",
    movie(TMDB.matrix, "watched"),
    (entryId) => watchAgain(OWNER_A, { entryId }),
    { statusChangedAt: true, progressMovedAt: null, watches: [true, false], ticks: [] },
  ],
  [
    "a date set on its imported Watch",
    movie(TMDB.matrix, "watched"),
    async (entryId) => setWatchDate(OWNER_A, { watchId: await onlyWatchId(entryId), watchedOn: "2021-05-01" }),
    { statusChangedAt: true, progressMovedAt: null, watches: [true], ticks: [] },
  ],
  [
    "its imported Watch deleted",
    movie(TMDB.matrix, "watched"),
    async (entryId) => deleteWatch(OWNER_A, { watchId: await onlyWatchId(entryId) }),
    { statusChangedAt: false, progressMovedAt: null, watches: [], ticks: [] },
  ],
];

describe("undoImport: what it removes", () => {
  it("removes every unchanged Entry the Import added, with its Watches and ticks, and keeps the Titles", async () => {
    const rows = [
      movie(TMDB.inception, "to_watch"),
      movie(TMDB.matrix, "watched"),
      series(TMDB.thePitt, "watched"),
      series(TMDB.breakingBad, "watched"),
    ];
    const { importId, results } = await addRows(rows);
    expect(results.map((row) => row.result)).toEqual(["added", "added", "added", "added"]);
    const added = await importedEntryIds(importId);
    expect(added).toHaveLength(4);
    // The Watched Movie and the Watched Series have a Watch each; the two Series have 25 + 20 ticks.
    expect(await rowsUnder(added)).toEqual({ watches: 2, ticks: 45 });

    expect(await undoImport(OWNER_A, { importId })).toEqual({ removed: 4, kept: 0 });

    expect(await entryCount(OWNER_A)).toBe(0);
    expect(await rowsUnder(added)).toEqual({ watches: 0, ticks: 0 });
    const kept = await db()
      .select({ tmdbId: titles.tmdbId })
      .from(titles)
      .where(inArray(titles.tmdbId, rows.map((row) => row.tmdbId)));
    expect(kept).toHaveLength(4);
  });

  it.each(CHANGES)("keeps an imported Entry with %s, exactly as it is", async (_, row, change, stamps) => {
    const { importId } = await addRows([row]);
    const entry = await entryOf(OWNER_A, row.kind, row.tmdbId);
    await change(entry.id);
    expect(await stampsAgainstCreation(entry.id)).toEqual(stamps);
    const before = await entryWithRows(entry.id);

    expect(await undoImport(OWNER_A, { importId })).toEqual({ removed: 0, kept: 1 });

    expect(await entryWithRows(entry.id)).toEqual(before);
    expect(await importedEntryIds(importId)).toEqual([entry.id]);
  });

  it("removes an Entry whose Status move was undone, since that Undo puts its stamps back", async () => {
    const { importId } = await addRows([movie(TMDB.inception, "to_watch")]);
    const entry = await entryOf(OWNER_A, "movie", TMDB.inception);
    const move = await setStatus(OWNER_A, { entryId: entry.id, status: "watched" });
    expect(move.undo).not.toBeNull();
    expect(await undoStatusMove(OWNER_A, move.undo!)).toEqual({ status: "to_watch" });
    expect(await stampsAgainstCreation(entry.id)).toEqual({
      statusChangedAt: true,
      progressMovedAt: null,
      watches: [],
      ticks: [],
    });

    expect(await undoImport(OWNER_A, { importId })).toEqual({ removed: 1, kept: 0 });
    expect(await entryCount(OWNER_A)).toBe(0);
  });

  it("keeps an imported Series with a later tick, even when its progress stamp was written back", async () => {
    // Before Season 2 Episode 9 aired, so the import leaves the Series caught up with that one to come.
    testState.today = "2026-03-01";
    const { importId, results } = await addRows([series(TMDB.thePitt, "watched")]);
    expect(results).toEqual([
      { kind: "series", tmdbId: TMDB.thePitt, result: "added", status: "watching", caughtUp: true },
    ]);
    const entry = await entryOf(OWNER_A, "series", TMDB.thePitt);
    testState.today = TODAY;
    await tickEpisode(OWNER_A, { entryId: entry.id, seasonNumber: 2, episodeNumber: 9, watched: true });
    // An Undo elsewhere writes this stamp back from the browser's copy, so it can land on created_at.
    await db()
      .update(entries)
      .set({ progressMovedAt: sql`${entries.createdAt}` })
      .where(eq(entries.id, entry.id));
    const stamps = await stampsAgainstCreation(entry.id);
    expect(stamps).toMatchObject({ statusChangedAt: true, progressMovedAt: true, watches: [] });
    expect(new Set(stamps.ticks)).toEqual(new Set([true, false]));
    const before = await entryWithRows(entry.id);

    expect(await undoImport(OWNER_A, { importId })).toEqual({ removed: 0, kept: 1 });

    expect(await entryWithRows(entry.id)).toEqual(before);
  });

  it("counts what it removed and what it kept on a mixed Import", async () => {
    const { importId } = await addRows([
      movie(TMDB.inception, "to_watch"),
      movie(TMDB.matrix, "watched"),
      movie(TMDB.dune, "to_watch"),
      series(TMDB.thePitt, "watched"),
      series(TMDB.breakingBad, "watched"),
    ]);
    const matrix = await entryOf(OWNER_A, "movie", TMDB.matrix);
    const pitt = await entryOf(OWNER_A, "series", TMDB.thePitt);
    await setRating(OWNER_A, { entryId: matrix.id, ratingHalfStars: 9 });
    await tickEpisode(OWNER_A, { entryId: pitt.id, seasonNumber: 1, episodeNumber: 3, watched: false });

    expect(await undoImport(OWNER_A, { importId })).toEqual({ removed: 3, kept: 2 });

    expect(await importedEntryIds(importId)).toEqual([matrix.id, pitt.id].sort());
    expect(await entryCount(OWNER_A)).toBe(2);
  });

  it("leaves Entries from another Import, saved by hand, or already in the Library when imported", async () => {
    const { entryId: handSaved } = await saveTitle(OWNER_A, { kind: "movie", tmdbId: TMDB.dune, status: "to_watch" });
    const first = await addRows([series(TMDB.westworld, "to_watch")]);
    const westworld = await entryOf(OWNER_A, "series", TMDB.westworld);
    const second = await addRows([
      movie(TMDB.matrix, "to_watch"),
      series(TMDB.westworld, "watched"),
      movie(TMDB.dune, "watched"),
    ]);
    expect(second.results.map((row) => row.result)).toEqual(["added", "already", "already"]);
    const before = [await entryWithRows(handSaved), await entryWithRows(westworld.id)];

    expect(await undoImport(OWNER_A, { importId: second.importId })).toEqual({ removed: 1, kept: 0 });

    expect([await entryWithRows(handSaved), await entryWithRows(westworld.id)]).toEqual(before);
    expect(before[0]?.entry?.importId).toBeNull();
    expect(before[1]?.entry?.importId).toBe(first.importId);
    expect(await entryCount(OWNER_A)).toBe(2);

    // Starting the second Import closed the first; a finished Import can still be undone.
    expect(await undoImport(OWNER_A, { importId: first.importId })).toEqual({ removed: 1, kept: 0 });
    expect(await entryWithRows(handSaved)).toEqual(before[0]);
    expect(await entryCount(OWNER_A)).toBe(1);
  });

  it("does nothing with another Owner's Import or an unknown one, and never shows it exists", async () => {
    const b = await addRows([movie(TMDB.inception, "to_watch"), movie(TMDB.matrix, "watched")], OWNER_B);
    const bEntries = await importedEntryIds(b.importId);
    expect(bEntries).toHaveLength(2);
    const before = await Promise.all(bEntries.map(entryWithRows));

    expect(await undoImport(OWNER_A, { importId: b.importId })).toEqual({ removed: 0, kept: 0 });
    expect(
      await undoImport(OWNER_A, { importId: "00000000-0000-4000-8000-000000000000" }),
    ).toEqual({ removed: 0, kept: 0 });

    expect(await Promise.all(bEntries.map(entryWithRows))).toEqual(before);
    expect(await importsOf(OWNER_B)).toEqual([{ id: b.importId, open: true }]);
  });

  it("removes nothing the second time, and reports the same Entries kept", async () => {
    const { importId } = await addRows([movie(TMDB.inception, "to_watch"), movie(TMDB.matrix, "watched")]);
    const matrix = await entryOf(OWNER_A, "movie", TMDB.matrix);
    await setNote(OWNER_A, { entryId: matrix.id, note: "Rewatch with Sam" });

    expect(await undoImport(OWNER_A, { importId })).toEqual({ removed: 1, kept: 1 });
    expect(await undoImport(OWNER_A, { importId })).toEqual({ removed: 0, kept: 1 });
    expect(await importedEntryIds(importId)).toEqual([matrix.id]);
  });
});

describe("undoImport: the Import", () => {
  it("closes the Import, so it takes no more rows", async () => {
    const { importId } = await addRows([movie(TMDB.inception, "to_watch")]);

    await undoImport(OWNER_A, { importId });

    expect(await importsOf(OWNER_A)).toEqual([{ id: importId, open: false }]);
    await expect(
      addImportRows(OWNER_A, { importId, rows: [movie(TMDB.matrix, "to_watch")] }),
    ).rejects.toThrow(MESSAGES.importFinished);
    expect(await entryCount(OWNER_A)).toBe(0);
  });

  it("undoes an Import that has finished, and keeps the time it finished", async () => {
    const { importId } = await addRows([movie(TMDB.inception, "to_watch")]);
    await finishImport(OWNER_A, { importId });
    const finishedAt = await finishedAtText(importId);
    expect(finishedAt).not.toBeNull();

    expect(await undoImport(OWNER_A, { importId })).toEqual({ removed: 1, kept: 0 });
    expect(await finishedAtText(importId)).toBe(finishedAt);
  });
});

describe("addImportRows: an Import that closes while its rows load", () => {
  it.each([
    ["undone", (importId: string) => undoImport(OWNER_A, { importId })],
    ["finished", (importId: string) => finishImport(OWNER_A, { importId })],
    ["replaced by a newer Import", () => startImport(OWNER_A)],
  ])("writes no row once the Import is %s", async (_, close) => {
    const { importId } = await startImport(OWNER_A);
    // The Import passes the open check, then closes while the rows load, before any is written.
    const client = getTmdbClient();
    const getMovie = client.getMovie;
    let closing: Promise<unknown> | null = null;
    vi.spyOn(client, "getMovie").mockImplementation(async (tmdbId) => {
      closing ??= close(importId);
      await closing;
      return getMovie(tmdbId);
    });
    const rows = [movie(TMDB.inception, "to_watch"), series(TMDB.breakingBad, "watched"), movie(TMDB.matrix, "watched")];

    const results = await addImportRows(OWNER_A, { importId, rows });

    expect(results).toEqual(rows.map(({ kind, tmdbId }) => ({ kind, tmdbId, result: "failed" })));
    expect(await importedEntryIds(importId)).toEqual([]);
    expect(await entryCount(OWNER_A)).toBe(0);
    expect((await importsOf(OWNER_A)).find((row) => row.id === importId)?.open).toBe(false);
  });
});
