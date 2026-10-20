import { count, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ActionResult } from "@/data/dto";
import { MESSAGES } from "@/data/errors";
import { closeDb, db } from "@/db/client";
import { entries } from "@/db/schema";
import { resetDatabase } from "@/test/db";
import { OWNER_A, resetTestState, signInAs, TMDB } from "@/test/mocks";
import { addToImport, finishImport, startImport } from "./import";

vi.mock("@/data/session", async () => (await import("@/test/mocks")).sessionModule());
vi.mock("@/data/today", async () => (await import("@/test/mocks")).todayModule());
vi.mock("@/lib/tmdb/client", async () => (await import("@/test/mocks")).tmdbClientModule());
vi.mock("next/cache", async () => (await import("@/test/mocks")).nextCacheModule());
vi.mock("next/server", async () => (await import("@/test/mocks")).nextServerModule());

function ok<T>(result: ActionResult<T>): T {
  if (!result.ok) throw new Error(`Expected success, got: ${result.error}`);
  return result.data;
}

function failure(result: ActionResult<unknown>): string {
  if (result.ok) throw new Error("Expected a failure");
  return result.error;
}

async function entryCount(): Promise<number> {
  const [row] = await db().select({ n: count() }).from(entries).where(eq(entries.userId, OWNER_A.id));
  return row?.n ?? 0;
}

const MOVIES = [TMDB.inception, TMDB.matrix, TMDB.dune, 11, 12, 13];
const rows = (n: number) =>
  MOVIES.slice(0, n).map((tmdbId) => ({ kind: "movie" as const, tmdbId, intent: "to_watch" as const }));

beforeEach(async () => {
  resetTestState();
  vi.mocked(refresh).mockClear();
  await resetDatabase();
});

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(async () => {
  await closeDb();
});

describe("startImport", () => {
  it("opens an Import and returns its id", async () => {
    const { importId } = ok(await startImport());
    expect(importId).toMatch(/^[0-9a-f-]{36}$/);
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});

describe("addToImport", () => {
  it("adds 1 row, and up to 5 in one call", async () => {
    const { importId } = ok(await startImport());

    expect(ok(await addToImport({ importId, rows: rows(1) }))).toEqual([
      { kind: "movie", tmdbId: TMDB.inception, result: "added", status: "to_watch", caughtUp: false },
    ]);

    vi.spyOn(console, "error").mockImplementation(() => {});
    const five = ok(await addToImport({ importId, rows: rows(5) }));
    expect(five.map((row) => row.result)).toEqual(["already", "added", "added", "failed", "failed"]);
    expect(await entryCount()).toBe(3);
  });

  it("says when the Import has finished", async () => {
    const { importId } = ok(await startImport());
    ok(await finishImport({ importId }));

    expect(failure(await addToImport({ importId, rows: rows(1) }))).toBe(MESSAGES.importFinished);
    expect(await entryCount()).toBe(0);
  });

  it.each([
    ["no rows", (importId: string) => ({ importId, rows: [] })],
    ["6 rows", (importId: string) => ({ importId, rows: rows(6) })],
    ["an extra key", (importId: string) => ({ importId, rows: rows(1), extra: true })],
    ["an extra key in a row", (importId: string) => ({ importId, rows: [{ ...rows(1)[0], name: "Inception" }] })],
    ["a zero TMDB id", (importId: string) => ({ importId, rows: [{ ...rows(1)[0], tmdbId: 0 }] })],
    ["a negative TMDB id", (importId: string) => ({ importId, rows: [{ ...rows(1)[0], tmdbId: -603 }] })],
    ["a fractional TMDB id", (importId: string) => ({ importId, rows: [{ ...rows(1)[0], tmdbId: 1.5 }] })],
    ["an unknown kind", (importId: string) => ({ importId, rows: [{ ...rows(1)[0], kind: "person" }] })],
    ["an unknown intent", (importId: string) => ({ importId, rows: [{ ...rows(1)[0], intent: "completed" }] })],
    ["a bad Import id", () => ({ importId: "not-a-uuid", rows: rows(1) })],
    ["no Import id", () => ({ rows: rows(1) })],
  ])("refuses %s", async (_, build) => {
    const { importId } = ok(await startImport());
    vi.mocked(refresh).mockClear();

    expect(failure(await addToImport(build(importId) as never))).toBe(MESSAGES.invalid);
    expect(refresh).not.toHaveBeenCalled();
    expect(await entryCount()).toBe(0);
  });
});

describe("finishImport", () => {
  it("closes the Import, and a repeat is harmless", async () => {
    const { importId } = ok(await startImport());
    expect(ok(await finishImport({ importId }))).toBeNull();
    expect(ok(await finishImport({ importId }))).toBeNull();
  });

  it.each([{ importId: "not-a-uuid" }, { importId: crypto.randomUUID(), extra: 1 }, {}, null])(
    "refuses malformed input %j",
    async (input) => {
      expect(failure(await finishImport(input as never))).toBe(MESSAGES.invalid);
    },
  );
});

describe("without a session", () => {
  it("sends a signed-out caller to sign in", async () => {
    signInAs(null);
    const importId = crypto.randomUUID();
    await expect(startImport()).rejects.toThrow(/NEXT_REDIRECT/);
    await expect(addToImport({ importId, rows: rows(1) })).rejects.toThrow(/NEXT_REDIRECT/);
    await expect(finishImport({ importId })).rejects.toThrow(/NEXT_REDIRECT/);
  });
});
