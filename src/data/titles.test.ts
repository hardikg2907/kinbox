import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { closeDb, db } from "@/db/client";
import { titles } from "@/db/schema";
import { resetDatabase } from "@/test/db";
import { resetTestState, testState, TMDB } from "@/test/mocks";
import { MESSAGES } from "./errors";
import { ensureTitle, refreshStaleTitle } from "./titles";

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
