import type { NextRequest } from "next/server";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { saveTitle } from "@/data/entries";
import { MESSAGES } from "@/data/errors";
import { closeDb } from "@/db/client";
import { resetDatabase } from "@/test/db";
import { OWNER_A, resetTestState, signInAs, testState, TMDB } from "@/test/mocks";
import { GET } from "./route";

vi.mock("@/data/session", async () => (await import("@/test/mocks")).sessionModule());
vi.mock("@/data/today", async () => (await import("@/test/mocks")).todayModule());
vi.mock("@/lib/tmdb/client", async () => (await import("@/test/mocks")).tmdbClientModule());
vi.mock("next/cache", async () => (await import("@/test/mocks")).nextCacheModule());
vi.mock("next/server", async () => (await import("@/test/mocks")).nextServerModule());

function request(search: string): NextRequest {
  return { nextUrl: new URL(`http://localhost/api/search${search}`) } as NextRequest;
}

beforeEach(async () => {
  resetTestState();
  await resetDatabase();
});

afterAll(async () => {
  await closeDb();
});

describe("GET /api/search", () => {
  it("returns matches with the Owner's Entries, never cached", async () => {
    const { entryId } = await saveTitle(OWNER_A, { kind: "movie", tmdbId: TMDB.dune, status: "to_watch" });

    const response = await GET(request("?q=dune"));

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await response.json()).toEqual({
      results: [expect.objectContaining({ tmdbId: TMDB.dune, entry: { id: entryId, status: "to_watch" } })],
    });
  });

  it("answers 401 without a session", async () => {
    signInAs(null);
    const response = await GET(request("?q=dune"));
    expect(response.status).toBe(401);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await response.json()).toEqual({ error: MESSAGES.signIn });
  });

  it.each(["", "?q=", "?q=%20%20", `?q=${"a".repeat(101)}`, "?q=dune&page=2", "?q=dune&q=matrix"])(
    "answers 400 for the query %j",
    async (search) => {
      const response = await GET(request(search));
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: MESSAGES.invalid });
    },
  );

  it("answers 503 when TMDB cannot be reached", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    testState.tmdbDown = true;
    const response = await GET(request("?q=dune"));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: MESSAGES.tmdbDown });
  });
});
