import type { NextRequest } from "next/server";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { saveTitle } from "@/data/entries";
import { MESSAGES } from "@/data/errors";
import { closeDb } from "@/db/client";
import { resetDatabase } from "@/test/db";
import { OWNER_A, OWNER_B, resetTestState, signInAs, testState, TMDB } from "@/test/mocks";
import { GET } from "./route";

vi.mock("@/data/session", async () => (await import("@/test/mocks")).sessionModule());
vi.mock("@/data/today", async () => (await import("@/test/mocks")).todayModule());
vi.mock("@/lib/tmdb/client", async () => (await import("@/test/mocks")).tmdbClientModule());
vi.mock("next/cache", async () => (await import("@/test/mocks")).nextCacheModule());
vi.mock("next/server", async () => (await import("@/test/mocks")).nextServerModule());

function call(id: string, season: string) {
  return GET({} as NextRequest, { params: Promise.resolve({ id, season }) } as never);
}

let entryId: string;

beforeEach(async () => {
  resetTestState();
  await resetDatabase();
  entryId = (await saveTitle(OWNER_A, { kind: "series", tmdbId: TMDB.breakingBad, status: "watching" })).entryId;
});

afterAll(async () => {
  await closeDb();
});

describe("GET /api/entries/[id]/seasons/[season]", () => {
  it("returns the Season, never cached", async () => {
    const response = await call(entryId, "2");
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    const body = await response.json();
    expect(body).toMatchObject({ seasonNumber: 2, name: "Season 2" });
    expect(body.episodes).toHaveLength(13);
  });

  it("answers 401 without a session", async () => {
    signInAs(null);
    expect((await call(entryId, "1")).status).toBe(401);
  });

  it.each([
    ["a malformed id", "not-a-uuid", "1"],
    ["an unknown id", "00000000-0000-4000-8000-000000000000", "1"],
    ["an unlisted Season", "", "9"],
    ["a Season over 1000", "", "1001"],
    ["a non-numeric Season", "", "1e2"],
    ["an empty Season", "", ""],
    ["a negative Season", "", "-1"],
  ])("answers 404 for %s", async (_, id, season) => {
    const response = await call(id || entryId, season);
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: MESSAGES.entryNotFound });
  });

  it("answers 404 for another Owner's Entry", async () => {
    signInAs(OWNER_B);
    expect((await call(entryId, "1")).status).toBe(404);
  });

  it("answers 503 when TMDB cannot be reached", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    testState.tmdbDown = true;
    const response = await call(entryId, "1");
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: MESSAGES.tmdbDown });
  });
});
