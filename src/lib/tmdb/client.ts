import "server-only";
import { env, isTmdbFakeEnabled } from "@/lib/env";
import { createFakeTmdbClient } from "./fake";
import { createRealTmdbClient } from "./real";
import type { TmdbClient } from "./types";

let cached: TmdbClient | undefined;

/** The TMDB client for this process: the fixture-backed fake or the real client. */
export function getTmdbClient(): TmdbClient {
  if (cached) return cached;
  if (isTmdbFakeEnabled()) {
    cached = createFakeTmdbClient();
    return cached;
  }
  const token = env().TMDB_API_READ_TOKEN;
  // env() already requires the token in production; this covers TMDB_FAKE=0 without one.
  if (!token) throw new Error("TMDB_API_READ_TOKEN is required to call TMDB");
  cached = createRealTmdbClient({ token });
  return cached;
}
