import type { NextRequest } from "next/server";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { MESSAGES } from "@/data/errors";
import { closeDb } from "@/db/client";
import { insertEntry, resetDatabase } from "@/test/db";
import { OWNER_A, resetTestState, signInAs } from "@/test/mocks";
import { GET } from "./route";

vi.mock("@/data/session", async () => (await import("@/test/mocks")).sessionModule());
vi.mock("@/data/today", async () => (await import("@/test/mocks")).todayModule());
vi.mock("@/lib/tmdb/client", async () => (await import("@/test/mocks")).tmdbClientModule());
vi.mock("next/cache", async () => (await import("@/test/mocks")).nextCacheModule());
vi.mock("next/server", async () => (await import("@/test/mocks")).nextServerModule());

function request(search: string): NextRequest {
  return { nextUrl: new URL(`http://localhost/api/search/library${search}`) } as NextRequest;
}

beforeEach(async () => {
  resetTestState();
  await resetDatabase();
});

afterAll(async () => {
  await closeDb();
});

describe("GET /api/search/library", () => {
  it("returns the Owner's matching Titles, never cached, with session and database timings", async () => {
    const { entryId } = await insertEntry({ owner: OWNER_A, status: "to_watch", name: "Dune" });

    const response = await GET(request("?q=dun"));

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("Server-Timing")).toMatch(/^session;dur=\d+\.\d, db;dur=\d+\.\d$/);
    expect(await response.json()).toEqual({
      results: [expect.objectContaining({ name: "Dune", entry: { id: entryId, status: "to_watch" } })],
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
});
