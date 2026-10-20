import { and, asc, count, eq, isNull, sql } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Status, TitleKind } from "@/domain/types";
import { closeDb, db } from "@/db/client";
import { entries, episodeProgress, imports, titles, watches } from "@/db/schema";
import { getTmdbClient } from "@/lib/tmdb/client";
import { entryRow, resetDatabase, setEntryTimes, tickKeys, watchRows } from "@/test/db";
import { OWNER_A, OWNER_B, resetTestState, testState, TMDB } from "@/test/mocks";
import { saveTitle } from "./entries";
import { MESSAGES } from "./errors";
import { addImportRows, finishImport, startImport } from "./import";
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
    .where(eq(watches.entryId, entryId));
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

describe("addImportRows: an Import that closes while its rows load", () => {
  it.each([
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
