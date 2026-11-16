import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { closeDb, db } from "@/db/client";
import { titles } from "@/db/schema";
import { resetDatabase } from "@/test/db";
import { resetTestState, testState, TMDB } from "@/test/mocks";
import { MESSAGES } from "./errors";
import { backfillImdbIds, ensureTitle, refreshStaleTitle } from "./titles";

vi.mock("@/lib/tmdb/client", async () => (await import("@/test/mocks")).tmdbClientModule());
vi.mock("next/cache", async () => (await import("@/test/mocks")).nextCacheModule());

const LONG_AGO = new Date("2025-01-01T00:00:00Z");

async function titleRow(id: string) {
  const [row] = await db().select().from(titles).where(eq(titles.id, id));
  return row;
}

beforeEach(async () => {
  resetTestState();
  await resetDatabase();
});

afterAll(async () => {
  await closeDb();
});

describe("ensureTitle", () => {
  it("creates one Title per kind and TMDB id, and refreshes it on the next call", async () => {
    const first = await ensureTitle("series", TMDB.westworld);
    expect(await titleRow(first.titleId)).toMatchObject({
      kind: "series",
      tmdbId: TMDB.westworld,
      name: "Westworld",
      year: 2016,
      tmdbStatus: "Canceled",
    });

    await db().update(titles).set({ name: "Old name", refreshedAt: LONG_AGO }).where(eq(titles.id, first.titleId));
    const second = await ensureTitle("series", TMDB.westworld);

    expect(second.titleId).toBe(first.titleId);
    expect(second.details.kind).toBe("series");
    const row = await titleRow(first.titleId);
    expect(row?.name).toBe("Westworld");
    expect(row?.refreshedAt.getTime()).toBeGreaterThan(LONG_AGO.getTime());
  });

  it("refuses a TMDB id TMDB does not list", async () => {
    await expect(ensureTitle("movie", 424242)).rejects.toThrow(MESSAGES.titleNotFound);
  });
});

describe("refreshStaleTitle", () => {
  it("re-fetches only a snapshot older than a month", async () => {
    const { titleId } = await ensureTitle("movie", TMDB.matrix);
    const recent = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    await db().update(titles).set({ name: "Old name", refreshedAt: recent }).where(eq(titles.id, titleId));

    await refreshStaleTitle(titleId);
    expect((await titleRow(titleId))?.name).toBe("Old name");

    await db().update(titles).set({ refreshedAt: LONG_AGO }).where(eq(titles.id, titleId));
    await refreshStaleTitle(titleId);
    expect((await titleRow(titleId))?.name).toBe("The Matrix");
  });

  it("never throws, and keeps the snapshot when TMDB is down", async () => {
    const { titleId } = await ensureTitle("movie", TMDB.matrix);
    await db().update(titles).set({ name: "Old name", refreshedAt: LONG_AGO }).where(eq(titles.id, titleId));
    testState.tmdbDown = true;
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(refreshStaleTitle(titleId)).resolves.toBeUndefined();

    expect((await titleRow(titleId))?.name).toBe("Old name");
    expect(log).toHaveBeenCalledWith("[refreshStaleTitle] TmdbUnavailableError");
    log.mockRestore();
  });
});

describe("IMDb id in the snapshot", () => {
  it("stores the id and the time it was looked up when a Title is saved", async () => {
    const movie = await ensureTitle("movie", TMDB.matrix);
    const series = await ensureTitle("series", TMDB.breakingBad);
    const none = await ensureTitle("series", TMDB.thePitt);

    expect(await titleRow(movie.titleId)).toMatchObject({ imdbId: "tt0133093" });
    expect(await titleRow(series.titleId)).toMatchObject({ imdbId: "tt0903747" });
    expect(await titleRow(none.titleId)).toMatchObject({ imdbId: null });
    for (const { titleId } of [movie, series, none]) {
      expect((await titleRow(titleId))?.imdbCheckedAt).toBeInstanceOf(Date);
    }
  });

  it("stores it again when a stale snapshot is refreshed", async () => {
    const { titleId } = await ensureTitle("movie", TMDB.matrix);
    await db()
      .update(titles)
      .set({ imdbId: null, imdbCheckedAt: null, refreshedAt: LONG_AGO })
      .where(eq(titles.id, titleId));

    await refreshStaleTitle(titleId);

    const row = await titleRow(titleId);
    expect(row?.imdbId).toBe("tt0133093");
    expect(row?.imdbCheckedAt).toBeInstanceOf(Date);
  });
});

describe("backfillImdbIds", () => {
  async function unchecked(kind: "movie" | "series", tmdbId: number, refreshedAt: Date) {
    const [row] = await db()
      .insert(titles)
      .values({ kind, tmdbId, name: "Old name", refreshedAt, imdbCheckedAt: null })
      .returning({ id: titles.id });
    return row!.id;
  }

  it("stores the full snapshot of every Title that was never looked up", async () => {
    const movie = await unchecked("movie", TMDB.matrix, LONG_AGO);
    const series = await unchecked("series", TMDB.westworld, LONG_AGO);

    expect(await backfillImdbIds()).toEqual({ complete: true });

    expect(await titleRow(movie)).toMatchObject({ name: "The Matrix", imdbId: "tt0133093" });
    expect(await titleRow(series)).toMatchObject({ name: "Westworld", imdbId: "tt0475784" });
    expect((await titleRow(series))?.imdbCheckedAt).toBeInstanceOf(Date);
    expect((await titleRow(series))?.refreshedAt.getTime()).toBeGreaterThan(LONG_AGO.getTime());
  });

  it("leaves a Title that was already looked up alone", async () => {
    const { titleId } = await ensureTitle("movie", TMDB.matrix);
    await db().update(titles).set({ name: "Kept" }).where(eq(titles.id, titleId));

    await backfillImdbIds();

    expect((await titleRow(titleId))?.name).toBe("Kept");
  });

  it("takes the oldest snapshots first and stops at the limit", async () => {
    const newest = await unchecked("movie", TMDB.dune, new Date("2026-03-01T00:00:00Z"));
    const oldest = await unchecked("movie", TMDB.matrix, new Date("2024-01-01T00:00:00Z"));
    const middle = await unchecked("movie", TMDB.inception, new Date("2025-01-01T00:00:00Z"));

    expect(await backfillImdbIds({ limit: 2, concurrency: 1 })).toEqual({ complete: false });

    expect((await titleRow(oldest))?.imdbCheckedAt).toBeInstanceOf(Date);
    expect((await titleRow(middle))?.imdbCheckedAt).toBeInstanceOf(Date);
    expect((await titleRow(newest))?.imdbCheckedAt).toBeNull();
  });

  it("only marks a Title TMDB no longer lists as looked up", async () => {
    const gone = await unchecked("movie", 424242, LONG_AGO);

    expect(await backfillImdbIds()).toEqual({ complete: true });

    const row = await titleRow(gone);
    expect(row).toMatchObject({ name: "Old name", imdbId: null });
    expect(row?.imdbCheckedAt).toBeInstanceOf(Date);
    expect(row?.refreshedAt.getTime()).toBe(LONG_AGO.getTime());
  });

  it("stops without an error when TMDB is down and leaves the rest for later", async () => {
    const ids = [
      await unchecked("movie", TMDB.matrix, LONG_AGO),
      await unchecked("movie", TMDB.inception, LONG_AGO),
    ];
    testState.tmdbDown = true;

    await expect(backfillImdbIds()).resolves.toEqual({ complete: false });

    for (const id of ids) expect((await titleRow(id))?.imdbCheckedAt).toBeNull();
  });

  it("reports complete when exactly the limit is left, and does not touch the Title after it", async () => {
    const first = await unchecked("movie", TMDB.matrix, new Date("2024-01-01T00:00:00Z"));
    const second = await unchecked("movie", TMDB.inception, new Date("2024-02-01T00:00:00Z"));

    expect(await backfillImdbIds({ limit: 2 })).toEqual({ complete: true });
    for (const id of [first, second]) expect((await titleRow(id))?.imdbCheckedAt).toBeInstanceOf(Date);

    const third = await unchecked("movie", TMDB.dune, new Date("2024-03-01T00:00:00Z"));
    const fourth = await unchecked("series", TMDB.westworld, new Date("2024-04-01T00:00:00Z"));
    await db().update(titles).set({ imdbCheckedAt: null, imdbAttemptedAt: null, refreshedAt: new Date("2024-01-01T00:00:00Z") })
      .where(eq(titles.id, first));
    expect(await backfillImdbIds({ limit: 2 })).toEqual({ complete: false });
    expect((await titleRow(first))?.imdbCheckedAt).toBeInstanceOf(Date);
    expect((await titleRow(third))?.imdbCheckedAt).toBeInstanceOf(Date);
    expect((await titleRow(fourth))?.imdbCheckedAt).toBeNull();
  });

  it("moves a Title that keeps failing behind the others", async () => {
    const stuck = await unchecked("movie", TMDB.matrix, new Date("2024-01-01T00:00:00Z"));
    const other = await unchecked("movie", TMDB.inception, new Date("2024-02-01T00:00:00Z"));
    testState.tmdbDownFor.add(TMDB.matrix);

    expect(await backfillImdbIds({ limit: 1, concurrency: 1 })).toEqual({ complete: false });
    expect((await titleRow(stuck))?.imdbAttemptedAt).toBeInstanceOf(Date);
    expect((await titleRow(other))?.imdbCheckedAt).toBeNull();

    await backfillImdbIds({ limit: 1, concurrency: 1 });

    expect((await titleRow(other))?.imdbCheckedAt).toBeInstanceOf(Date);
    expect((await titleRow(stuck))?.imdbCheckedAt).toBeNull();
  });

  it("marks a Title TMDB refuses as checked and carries on with the others", async () => {
    const refused = await unchecked("movie", TMDB.matrix, new Date("2024-01-01T00:00:00Z"));
    const other = await unchecked("movie", TMDB.inception, new Date("2024-02-01T00:00:00Z"));
    testState.tmdbStatusFor.set(TMDB.matrix, 400);

    expect(await backfillImdbIds({ concurrency: 1 })).toEqual({ complete: true });

    expect(await titleRow(refused)).toMatchObject({ imdbId: null, name: "Old name" });
    expect((await titleRow(refused))?.imdbCheckedAt).toBeInstanceOf(Date);
    expect(await titleRow(other)).toMatchObject({ imdbId: "tt1375666" });
  });

  it.each([401, 403, 429, 500, 503])("stops on a TMDB answer of %i without marking the Title", async (status) => {
    const first = await unchecked("movie", TMDB.matrix, new Date("2024-01-01T00:00:00Z"));
    const second = await unchecked("movie", TMDB.inception, new Date("2024-02-01T00:00:00Z"));
    testState.tmdbStatusFor.set(TMDB.matrix, status);

    expect(await backfillImdbIds({ concurrency: 1 })).toEqual({ complete: false });

    expect((await titleRow(first))?.imdbCheckedAt).toBeNull();
    expect((await titleRow(second))?.imdbCheckedAt).toBeNull();
  });

  it("starts no new fetch after its time budget, and reports it is not complete", async () => {
    const ids = [
      await unchecked("movie", TMDB.matrix, new Date("2024-01-01T00:00:00Z")),
      await unchecked("movie", TMDB.inception, new Date("2024-02-01T00:00:00Z")),
      await unchecked("movie", TMDB.dune, new Date("2024-03-01T00:00:00Z")),
    ];
    // Each look at the clock is a minute later than the one before.
    let clock = -60_000;
    const now = () => (clock += 60_000);

    expect(await backfillImdbIds({ concurrency: 1, budgetMs: 120_000, now })).toEqual({ complete: false });

    expect((await titleRow(ids[0]!))?.imdbCheckedAt).toBeInstanceOf(Date);
    expect((await titleRow(ids[1]!))?.imdbCheckedAt).toBeNull();
    expect((await titleRow(ids[2]!))?.imdbCheckedAt).toBeNull();
  });

  it("starts no new fetch once TMDB failed", async () => {
    await unchecked("movie", TMDB.matrix, new Date("2024-01-01T00:00:00Z"));
    const second = await unchecked("movie", TMDB.inception, new Date("2024-02-01T00:00:00Z"));
    testState.tmdbDownFor.add(TMDB.matrix);

    await backfillImdbIds({ concurrency: 1 });

    expect((await titleRow(second))?.imdbCheckedAt).toBeNull();
  });
});
