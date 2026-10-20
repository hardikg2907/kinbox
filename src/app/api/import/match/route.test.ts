import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { saveTitle } from "@/data/entries";
import { MESSAGES } from "@/data/errors";
import { closeDb } from "@/db/client";
import type { TitleKind } from "@/domain/types";
import { getTmdbClient } from "@/lib/tmdb/client";
import { createFakeTmdbClient } from "@/lib/tmdb/fake";
import { resetDatabase } from "@/test/db";
import { OWNER_A, OWNER_B, resetTestState, signInAs, testState, TMDB } from "@/test/mocks";
import { POST } from "./route";

vi.mock("@/data/session", async () => (await import("@/test/mocks")).sessionModule());
vi.mock("@/data/today", async () => (await import("@/test/mocks")).todayModule());
vi.mock("@/lib/tmdb/client", async () => (await import("@/test/mocks")).tmdbClientModule());
vi.mock("next/cache", async () => (await import("@/test/mocks")).nextCacheModule());
vi.mock("next/server", async () => (await import("@/test/mocks")).nextServerModule());

const ENDPOINT = "http://localhost/api/import/match";
const JSON_TYPE = { "content-type": "application/json" };
const MAX_BODY_BYTES = 16_384;

const dune = { id: 0, query: "Dune: Part Two", several: false };

function post(body: unknown, headers: Record<string, string> = JSON_TYPE): Request {
  return new Request(ENDPOINT, {
    method: "POST",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

async function candidate(kind: TitleKind, tmdbId: number, inLibrary = false) {
  const fake = createFakeTmdbClient();
  const title = kind === "movie" ? await fake.getMovie(tmdbId) : await fake.getSeries(tmdbId);
  if (!title) throw new Error("Missing fixture");
  return { kind, tmdbId, name: title.name, year: title.year, posterPath: title.posterPath, inLibrary };
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

describe("POST /api/import/match", () => {
  it("answers each line with its result and candidates, in the request's order, never cached", async () => {
    const response = await POST(
      post({
        lines: [
          dune,
          { id: 1, query: "Westworld", year: 2016, kind: "series", several: false },
          { id: 2, query: "Matrix", altQuery: "Not this one", kind: "movie", several: false },
          { id: 3, query: "Breaking", kind: "series", several: false },
          { id: 4, query: "Westworld", several: true },
          { id: 9, query: "Nothing like it", several: false },
        ],
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("Server-Timing")).toMatch(/^session;dur=\d+\.\d, match;dur=\d+\.\d$/);
    expect(await response.json()).toEqual({
      lines: [
        { id: 0, result: "found", candidates: [await candidate("movie", TMDB.dune)] },
        { id: 1, result: "found", candidates: [await candidate("series", TMDB.westworld)] },
        { id: 2, result: "found", candidates: [await candidate("movie", TMDB.matrix)] },
        { id: 3, result: "check", candidates: [await candidate("series", TMDB.breakingBad)] },
        { id: 4, result: "check", candidates: [await candidate("series", TMDB.westworld)] },
        { id: 9, result: "not_found", candidates: [] },
      ],
    });
  });

  it("finds a name typed with a space through the joined-up search", async () => {
    const response = await POST(post({ lines: [{ id: 0, query: "West world", kind: "series", several: false }] }));

    expect(await response.json()).toEqual({
      lines: [{ id: 0, result: "found", candidates: [await candidate("series", TMDB.westworld)] }],
    });
  });

  it("answers 'error' when the joined-up search for a line fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    testState.tmdbSearchDownFor.add("westworld");

    const response = await POST(post({ lines: [{ id: 0, query: "West world", several: false }] }));

    expect(await response.json()).toEqual({ lines: [{ id: 0, result: "error", candidates: [] }] });
  });

  it("accepts a charset on the JSON type and 100 characters outside the Basic Multilingual Plane", async () => {
    const response = await POST(
      post({ lines: [{ id: 0, query: "😀".repeat(100), several: false }] }, {
        "content-type": "Application/JSON; charset=utf-8",
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ lines: [{ id: 0, result: "not_found", candidates: [] }] });
  });

  it("marks a candidate as in the Library only for the Owner who saved it", async () => {
    await saveTitle(OWNER_B, { kind: "movie", tmdbId: TMDB.dune, status: "to_watch" });
    const body = { lines: [dune, { id: 1, query: "Breaking", several: false }] };

    const before = await (await POST(post(body))).json();
    expect(before.lines.map((line: { candidates: { inLibrary: boolean }[] }) => line.candidates[0].inLibrary)).toEqual([
      false,
      false,
    ]);

    await saveTitle(OWNER_A, { kind: "movie", tmdbId: TMDB.dune, status: "to_watch" });
    await saveTitle(OWNER_A, { kind: "series", tmdbId: TMDB.breakingBad, status: "watching" });
    const after = await (await POST(post(body))).json();
    expect(after).toEqual({
      lines: [
        { id: 0, result: "found", candidates: [await candidate("movie", TMDB.dune, true)] },
        { id: 1, result: "check", candidates: [await candidate("series", TMDB.breakingBad, true)] },
      ],
    });
  });

  it("answers 'error' for a line whose search fails and still answers the others", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    testState.tmdbSearchDownFor.add("dune: part two");

    const response = await POST(post({ lines: [dune, { id: 1, query: "Westworld", several: false }] }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      lines: [
        { id: 0, result: "error", candidates: [] },
        { id: 1, result: "found", candidates: [await candidate("series", TMDB.westworld)] },
      ],
    });
    expect(log).toHaveBeenCalled();
    expect(JSON.stringify(log.mock.calls).toLowerCase()).not.toContain("dune");
  });

  it("answers 'error' when the search for a line's alternate text fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    testState.tmdbSearchDownFor.add("um dia");

    const response = await POST(post({ lines: [{ id: 0, query: "Breaking", altQuery: "Um Dia", several: false }] }));

    expect(await response.json()).toEqual({ lines: [{ id: 0, result: "error", candidates: [] }] });
  });

  it("fails the whole request on an error that is not TMDB being down", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(getTmdbClient(), "searchMulti").mockRejectedValue(new Error("unexpected"));

    const response = await POST(post({ lines: [dune] }));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: MESSAGES.generic });
  });

  it("runs at most 4 searches at once", async () => {
    let running = 0;
    let most = 0;
    const search = vi.spyOn(getTmdbClient(), "searchMulti").mockImplementation(async () => {
      running += 1;
      most = Math.max(most, running);
      await new Promise((resolve) => setTimeout(resolve, 5));
      running -= 1;
      return [];
    });
    const lines = Array.from({ length: 10 }, (_, id) => ({ id, query: `Title${id}`, several: false }));

    const response = await POST(post({ lines }));

    expect(response.status).toBe(200);
    expect(search).toHaveBeenCalledTimes(10);
    expect(most).toBe(4);
  });

  it("answers 401 without a session", async () => {
    signInAs(null);
    const response = await POST(post({ lines: [dune] }));
    expect(response.status).toBe(401);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await response.json()).toEqual({ error: MESSAGES.signIn });
  });

  it("answers 415 for a body that is not JSON by type", async () => {
    const plain = await POST(post({ lines: [dune] }, { "content-type": "text/plain" }));
    expect(plain.status).toBe(415);
    expect(await plain.json()).toEqual({ error: MESSAGES.invalid });

    const untyped = await POST(
      new Request(ENDPOINT, { method: "POST", body: new TextEncoder().encode(JSON.stringify({ lines: [dune] })) }),
    );
    expect(untyped.status).toBe(415);

    const lookalike = await POST(post({ lines: [dune] }, { "content-type": "application/jsonp" }));
    expect(lookalike.status).toBe(415);
  });

  it.each([
    ["an extra key at the top", { lines: [dune], page: 2 }],
    ["an extra key on a line", { lines: [{ ...dune, intent: "watched" }] }],
    ["no lines", { lines: [] }],
    ["11 lines", { lines: Array.from({ length: 11 }, (_, id) => ({ ...dune, id })) }],
    ["no lines key", {}],
    ["an empty query", { lines: [{ ...dune, query: "   " }] }],
    ["a 101-character query", { lines: [{ ...dune, query: "😀".repeat(101) }] }],
    ["an empty alternate text", { lines: [{ ...dune, altQuery: "" }] }],
    ["a 101-character alternate text", { lines: [{ ...dune, altQuery: "a".repeat(101) }] }],
    ["a negative id", { lines: [{ ...dune, id: -1 }] }],
    ["an id of 500", { lines: [{ ...dune, id: 500 }] }],
    ["an id that is not a whole number", { lines: [{ ...dune, id: 1.5 }] }],
    ["a year before 1800", { lines: [{ ...dune, year: 1799 }] }],
    ["a year after 2200", { lines: [{ ...dune, year: 2201 }] }],
    ["an unknown kind", { lines: [{ ...dune, kind: "anime" }] }],
    ["a missing several flag", { lines: [{ id: 0, query: "Dune" }] }],
    ["a list instead of an object", [dune]],
  ])("answers 400 for %s", async (_name, body) => {
    const response = await POST(post(body));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: MESSAGES.invalid });
  });

  it.each([
    ["broken JSON", "{\"lines\": ["],
    ["an empty body", ""],
  ])("answers 400 for %s", async (_name, body) => {
    const response = await POST(post(body));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: MESSAGES.invalid });
  });

  it("answers 413 at once for a declared length over 16 KB", async () => {
    const response = await POST(post({ lines: [dune] }, { ...JSON_TYPE, "content-length": String(MAX_BODY_BYTES + 1) }));
    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ error: MESSAGES.invalid });
  });

  it("answers 413 for a body over 16 KB that declares no length", async () => {
    const padded = JSON.stringify({ lines: [dune] }).padEnd(MAX_BODY_BYTES + 1, " ");
    const response = await POST(post(padded));
    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ error: MESSAGES.invalid });
  });

  it("reads a body of exactly 16 KB", async () => {
    const padded = JSON.stringify({ lines: [dune] }).padEnd(MAX_BODY_BYTES, " ");
    expect((await POST(post(padded))).status).toBe(200);
  });
});
