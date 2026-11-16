import { eq, sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { closeDb, db } from "@/db/client";
import { imdbRatings, imdbSync, titles } from "@/db/schema";
import { resetDatabase } from "@/test/db";
import { resetTestState, testState, TMDB } from "@/test/mocks";
import { syncImdbRatingsIfDue } from "./imdb-ratings";

vi.mock("@/lib/tmdb/client", async () => (await import("@/test/mocks")).tmdbClientModule());
vi.mock("next/cache", async () => (await import("@/test/mocks")).nextCacheModule());
vi.mock("@/lib/imdb/ratings-file", async () => (await import("@/test/mocks")).imdbRatingsFileModule());

const MATRIX = "tt0133093";
const INCEPTION = "tt1375666";
const DUNE = "tt15239678";

let nextTmdbId = 700_000;

async function addTitle(imdbId: string | null, checked = true): Promise<void> {
  await db()
    .insert(titles)
    .values({
      kind: "movie",
      tmdbId: nextTmdbId++,
      name: "A Title",
      imdbId,
      imdbCheckedAt: checked ? new Date() : null,
    });
}

async function setSync(values: {
  etag?: string | null;
  lockedUntil?: Date;
  retryAfter?: Date;
  lastSuccessAt?: Date | null;
  lastFullReadAt?: Date | null;
}): Promise<void> {
  await db()
    .insert(imdbSync)
    .values({ id: 1, ...values })
    .onConflictDoUpdate({ target: imdbSync.id, set: values });
}

async function syncRow() {
  const [row] = await db().select().from(imdbSync);
  return row;
}

async function ratingRows() {
  const rows = await db().select().from(imdbRatings).orderBy(imdbRatings.imdbId);
  return Object.fromEntries(rows.map((row) => [row.imdbId, [row.ratingTenths, row.votes]]));
}

const HOURS = 60 * 60 * 1000;
const hoursAgo = (hours: number) => new Date(Date.now() - hours * HOURS);
const inMinutes = (minutes: number) => new Date(Date.now() + minutes * 60 * 1000);
const minutesAgo = (minutes: number) => inMinutes(-minutes);

beforeEach(async () => {
  resetTestState();
  await resetDatabase();
});

afterAll(async () => {
  await closeDb();
});

describe("syncImdbRatingsIfDue", () => {
  it("reads the file on the first run and stores one row per stored IMDb id", async () => {
    await addTitle(MATRIX);
    await addTitle(DUNE);
    await addTitle(MATRIX);
    await addTitle(null);
    testState.imdbRatings.set(MATRIX, { ratingTenths: 87, votes: 2_213_456 });

    await syncImdbRatingsIfDue();

    expect(await ratingRows()).toEqual({ [MATRIX]: [87, 2_213_456], [DUNE]: [null, null] });
    expect(testState.imdbCalls).toHaveLength(1);
    expect(testState.imdbCalls[0]?.wanted.sort()).toEqual([MATRIX, DUNE].sort());
    const row = await syncRow();
    expect(row?.etag).toBe('"fixture-etag"');
    expect(row?.lastSuccessAt).toBeInstanceOf(Date);
    expect(row!.lockedUntil.getTime()).toBeLessThanOrEqual(Date.now() + 1000);
  });

  it("works when the single row is gone", async () => {
    await addTitle(MATRIX);
    expect(await syncRow()).toBeUndefined();

    await syncImdbRatingsIfDue();

    expect(testState.imdbCalls).toHaveLength(1);
    expect(await syncRow()).toMatchObject({ id: 1 });
  });

  it("does nothing when the last success is recent and no Title is missing a rating", async () => {
    await addTitle(MATRIX);
    await db().insert(imdbRatings).values({ imdbId: MATRIX, ratingTenths: 87, votes: 1 });
    await setSync({ lastSuccessAt: hoursAgo(5), etag: '"old"' });

    await syncImdbRatingsIfDue();

    expect(testState.imdbCalls).toHaveLength(0);
    expect((await syncRow())?.etag).toBe('"old"');
  });

  it("does nothing while another run holds the lease", async () => {
    await addTitle(MATRIX);
    await setSync({ lockedUntil: inMinutes(3) });

    await syncImdbRatingsIfDue();

    expect(testState.imdbCalls).toHaveLength(0);
    expect(await ratingRows()).toEqual({});
  });

  it("lets only one of two runs at the same moment read the file", async () => {
    await addTitle(MATRIX);

    await Promise.all([syncImdbRatingsIfDue(), syncImdbRatingsIfDue(), syncImdbRatingsIfDue()]);

    expect(testState.imdbCalls).toHaveLength(1);
  });

  it("waits out a retry delay even when a Title has no rating", async () => {
    await addTitle(MATRIX);
    await setSync({ retryAfter: inMinutes(10) });

    await syncImdbRatingsIfDue();

    expect(testState.imdbCalls).toHaveLength(0);
  });

  it("sends the stored ETag and keeps the data on 304", async () => {
    await addTitle(MATRIX);
    await db().insert(imdbRatings).values({ imdbId: MATRIX, ratingTenths: 87, votes: 1 });
    await setSync({ etag: '"stored"', lastSuccessAt: hoursAgo(21) });
    testState.imdbUnchanged = true;
    testState.imdbRatings.set(MATRIX, { ratingTenths: 10, votes: 2 });

    await syncImdbRatingsIfDue();

    expect(testState.imdbCalls).toEqual([{ wanted: [MATRIX], etag: '"stored"' }]);
    expect(await ratingRows()).toEqual({ [MATRIX]: [87, 1] });
    const row = await syncRow();
    expect(row?.etag).toBe('"stored"');
    expect(Date.now() - row!.lastSuccessAt!.getTime()).toBeLessThan(10_000);
    expect(row!.lockedUntil.getTime()).toBeLessThanOrEqual(Date.now() + 1000);
  });

  it("reads the whole file when a Title has no rating row yet, even with an ETag", async () => {
    await addTitle(MATRIX);
    await addTitle(INCEPTION);
    await db().insert(imdbRatings).values({ imdbId: MATRIX, ratingTenths: 87, votes: 1 });
    // Recent success: only the missing row makes this run due.
    await setSync({ etag: '"stored"', lastSuccessAt: hoursAgo(1) });
    testState.imdbUnchanged = true;
    testState.imdbRatings.set(INCEPTION, { ratingTenths: 88, votes: 5 });

    await syncImdbRatingsIfDue();

    expect(testState.imdbCalls).toEqual([{ wanted: expect.arrayContaining([MATRIX, INCEPTION]), etag: null }]);
    expect((await ratingRows())[INCEPTION]).toEqual([88, 5]);
  });

  it("writes new, changed and vanished ratings, leaves unchanged rows alone and drops orphans", async () => {
    await addTitle(MATRIX);
    await addTitle(INCEPTION);
    await addTitle(DUNE);
    await db()
      .insert(imdbRatings)
      .values([
        { imdbId: MATRIX, ratingTenths: 87, votes: 100 },
        { imdbId: INCEPTION, ratingTenths: 88, votes: 200 },
        { imdbId: DUNE, ratingTenths: null, votes: null },
        { imdbId: "tt0000001", ratingTenths: 50, votes: 3 },
      ]);
    await setSync({ lastSuccessAt: hoursAgo(30) });
    const stamp = async (id: string) =>
      (await db().execute<{ x: string }>(sql`select xmin::text as x from imdb_ratings where imdb_id = ${id}`))
        .rows[0]?.x;
    const before = await stamp(MATRIX);

    testState.imdbRatings.set(MATRIX, { ratingTenths: 87, votes: 100 });
    testState.imdbRatings.set(DUNE, { ratingTenths: 80, votes: 9 });
    // INCEPTION has no rating in the file any more.

    await syncImdbRatingsIfDue();

    expect(await ratingRows()).toEqual({
      [MATRIX]: [87, 100],
      [INCEPTION]: [null, null],
      [DUNE]: [80, 9],
    });
    expect(await stamp(MATRIX)).toBe(before);
  });

  it("looks up IMDb ids for Titles saved earlier, then rates them from the same read", async () => {
    await db()
      .insert(titles)
      .values({ kind: "movie", tmdbId: TMDB.matrix, name: "The Matrix", refreshedAt: hoursAgo(1) });
    testState.imdbRatings.set(MATRIX, { ratingTenths: 87, votes: 2_213_456 });

    await syncImdbRatingsIfDue();

    const [title] = await db().select().from(titles).where(eq(titles.tmdbId, TMDB.matrix));
    expect(title).toMatchObject({ imdbId: MATRIX });
    expect(title?.imdbCheckedAt).toBeInstanceOf(Date);
    expect(testState.imdbCalls).toHaveLength(1);
    expect(await ratingRows()).toEqual({ [MATRIX]: [87, 2_213_456] });
  });

  it("asks only with the ETag when TMDB is down and no stored Title lacks a rating", async () => {
    await addTitle(MATRIX);
    await db().insert(imdbRatings).values({ imdbId: MATRIX, ratingTenths: 87, votes: 1 });
    await db()
      .insert(titles)
      .values({ kind: "movie", tmdbId: TMDB.dune, name: "Dune", imdbCheckedAt: null });
    await setSync({ etag: '"stored"', lastSuccessAt: hoursAgo(1) });
    testState.tmdbDown = true;
    testState.imdbUnchanged = true;

    await syncImdbRatingsIfDue();

    expect(testState.imdbCalls).toEqual([{ wanted: [MATRIX], etag: '"stored"' }]);
    expect((await syncRow())!.retryAfter.getTime()).toBeGreaterThan(Date.now() + 25 * 60 * 1000);

    await syncImdbRatingsIfDue();
    expect(testState.imdbCalls).toHaveLength(1);
  });

  it("sends the ETag when the only reason to run is Titles never looked up", async () => {
    await addTitle(MATRIX);
    await db().insert(imdbRatings).values({ imdbId: MATRIX, ratingTenths: 87, votes: 1 });
    // TMDB lists The Pitt without an IMDb id, so the lookup leaves nothing missing.
    await db()
      .insert(titles)
      .values({ kind: "series", tmdbId: TMDB.thePitt, name: "The Pitt", imdbCheckedAt: null });
    await setSync({ etag: '"stored"', lastSuccessAt: hoursAgo(1) });
    testState.imdbUnchanged = true;

    await syncImdbRatingsIfDue();

    expect(testState.imdbCalls).toEqual([{ wanted: [MATRIX], etag: '"stored"' }]);
    const [pitt] = await db().select().from(titles).where(eq(titles.tmdbId, TMDB.thePitt));
    expect(pitt?.imdbCheckedAt).toBeInstanceOf(Date);
    expect((await syncRow())?.etag).toBe('"stored"');
  });

  it("reads the whole file when TMDB is down and a stored Title lacks a rating", async () => {
    await addTitle(MATRIX);
    await db()
      .insert(titles)
      .values({ kind: "movie", tmdbId: TMDB.dune, name: "Dune", imdbCheckedAt: null });
    testState.tmdbDown = true;

    await syncImdbRatingsIfDue();

    expect(testState.imdbCalls).toEqual([{ wanted: [MATRIX], etag: null }]);
    expect((await syncRow())!.retryAfter.getTime()).toBeGreaterThan(Date.now() + 25 * 60 * 1000);
  });

  it("downloads the whole file once for missing ratings within two minutes", async () => {
    await addTitle(MATRIX);
    await syncImdbRatingsIfDue();
    expect(testState.imdbCalls).toHaveLength(1);
    expect((await syncRow())?.lastFullReadAt).toBeInstanceOf(Date);

    // A new Title now has no rating row, but the file was just read.
    await addTitle(DUNE);
    await syncImdbRatingsIfDue();
    await syncImdbRatingsIfDue();
    expect(testState.imdbCalls).toHaveLength(1);

    await setSync({ lastFullReadAt: minutesAgo(3) });
    await syncImdbRatingsIfDue();
    expect(testState.imdbCalls).toHaveLength(2);
    expect((await ratingRows())[DUNE]).toEqual([null, null]);
  });

  it("does not read the file for missing ratings when Titles only just got their ids", async () => {
    await db()
      .insert(titles)
      .values({ kind: "movie", tmdbId: TMDB.matrix, name: "The Matrix", imdbCheckedAt: null });
    await setSync({ lastSuccessAt: hoursAgo(1), lastFullReadAt: minutesAgo(1) });

    await syncImdbRatingsIfDue();

    expect(testState.imdbCalls).toHaveLength(0);
    const row = await syncRow();
    expect(row!.lockedUntil.getTime()).toBeLessThanOrEqual(Date.now() + 1000);
    // The lookup itself was kept.
    const [title] = await db().select().from(titles).where(eq(titles.tmdbId, TMDB.matrix));
    expect(title?.imdbId).toBe(MATRIX);
  });

  it("refreshes after 20 hours even when the file was read recently", async () => {
    await addTitle(MATRIX);
    await db().insert(imdbRatings).values({ imdbId: MATRIX, ratingTenths: 87, votes: 1 });
    await setSync({ lastSuccessAt: hoursAgo(21), lastFullReadAt: minutesAgo(1), etag: '"stored"' });

    await syncImdbRatingsIfDue();

    expect(testState.imdbCalls).toEqual([{ wanted: [MATRIX], etag: '"stored"' }]);
  });

  it("leaves another run's lease and state alone when its own lease was taken over", async () => {
    await addTitle(MATRIX);
    const otherRun = "11111111-1111-4111-8111-111111111111";
    const lease = inMinutes(4);
    testState.imdbOnRead = async () => {
      await db()
        .update(imdbSync)
        .set({ runId: otherRun, lockedUntil: lease, etag: '"theirs"' })
        .where(eq(imdbSync.id, 1));
    };

    await syncImdbRatingsIfDue();

    const row = await syncRow();
    expect(row).toMatchObject({ runId: otherRun, etag: '"theirs"', lastSuccessAt: null, lastFullReadAt: null });
    expect(row!.lockedUntil.getTime()).toBe(lease.getTime());
    // The ratings are safe to write twice, so they were kept.
    expect(await ratingRows()).toEqual({ [MATRIX]: [null, null] });
  });

  it("does not release another run's lease after a failure either", async () => {
    await addTitle(MATRIX);
    const otherRun = "11111111-1111-4111-8111-111111111111";
    const lease = inMinutes(4);
    testState.imdbDown = true;
    testState.imdbOnRead = async () => {
      await db().update(imdbSync).set({ runId: otherRun, lockedUntil: lease }).where(eq(imdbSync.id, 1));
    };
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await syncImdbRatingsIfDue();

    const row = await syncRow();
    expect(row!.lockedUntil.getTime()).toBe(lease.getTime());
    expect(row!.retryAfter.getTime()).toBeLessThan(Date.now());
    log.mockRestore();
  });

  it("marks success without reading when no Title has an IMDb id", async () => {
    await addTitle(null);

    await syncImdbRatingsIfDue();

    expect(testState.imdbCalls).toHaveLength(0);
    expect((await syncRow())?.lastSuccessAt).toBeInstanceOf(Date);
  });

  it("never throws, releases the lease and waits 30 minutes after a failure", async () => {
    await addTitle(MATRIX);
    testState.imdbDown = true;
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(syncImdbRatingsIfDue()).resolves.toBeUndefined();

    const row = await syncRow();
    expect(row?.lastSuccessAt).toBeNull();
    expect(row!.lockedUntil.getTime()).toBeLessThanOrEqual(Date.now() + 1000);
    const wait = row!.retryAfter.getTime() - Date.now();
    expect(wait).toBeGreaterThan(29 * 60 * 1000);
    expect(wait).toBeLessThanOrEqual(30 * 60 * 1000 + 1000);
    expect(log).toHaveBeenCalledWith("[syncImdbRatings] IMDb file unusable (fetch_failed)");
    expect(await ratingRows()).toEqual({});

    testState.imdbDown = false;
    await syncImdbRatingsIfDue();
    expect(testState.imdbCalls).toHaveLength(1);
    log.mockRestore();
  });

  it("does not touch another run's lease when it never got one", async () => {
    await addTitle(MATRIX);
    const lease = inMinutes(3);
    await setSync({ lockedUntil: lease });

    await syncImdbRatingsIfDue();

    const row = await syncRow();
    expect(row!.lockedUntil.getTime()).toBe(lease.getTime());
    expect(row!.retryAfter.getTime()).toBeLessThan(Date.now());
  });
});
