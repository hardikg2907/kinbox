import { afterEach, describe, expect, it, vi } from "vitest";
import { TmdbUnavailableError } from "@/lib/tmdb/real";
import { errorResponse, jsonResponse, MESSAGES, UserError, userMessage } from "./errors";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("userMessage", () => {
  it("passes a UserError's sentence through", () => {
    expect(userMessage(new UserError(MESSAGES.caughtUp), "t")).toBe(MESSAGES.caughtUp);
  });

  it("maps TMDB failures to the TMDB sentence", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(userMessage(new TmdbUnavailableError({ status: 429 }), "t")).toBe(MESSAGES.tmdbDown);
  });

  it("logs only the tag, name and message of anything else, and shows the generic sentence", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const error = Object.assign(new TypeError("bad thing"), { input: "owner@example.com" });

    expect(userMessage(error, "saveTitle")).toBe(MESSAGES.generic);
    expect(log).toHaveBeenCalledWith("[saveTitle] TypeError: bad thing");
    expect(JSON.stringify(log.mock.calls)).not.toContain("owner@example.com");
  });
});

describe("route responses", () => {
  it("are never cached and map errors to status codes", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const ok = jsonResponse({ a: 1 });
    expect(ok.status).toBe(200);
    expect(ok.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await ok.json()).toEqual({ a: 1 });

    expect(errorResponse(new TmdbUnavailableError(), "t").status).toBe(503);
    expect(errorResponse(new UserError("x"), "t").status).toBe(400);
    const generic = errorResponse(new Error("boom"), "t");
    expect(generic.status).toBe(500);
    expect(await generic.json()).toEqual({ error: MESSAGES.generic });
  });
});
