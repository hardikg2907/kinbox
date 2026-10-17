import "server-only";
import { TmdbUnavailableError } from "@/lib/tmdb/real";
import { describeError } from "@/lib/log";

export const MESSAGES = {
  invalid: "Something in that request wasn't valid.",
  entryNotFound: "We couldn't find that title in your library.",
  titleNotFound: "We couldn't find that title in the movie database.",
  episodeNotFound: "We couldn't find that episode.",
  seasonNotFound: "We couldn't find that season.",
  notSeries: "Episodes only apply to a series.",
  caughtUp: "You're caught up on this series.",
  rateNotStarted: "Start watching it to rate it.",
  noteTooLong: "Notes can be up to 1,000 characters.",
  watchDate: "Pick a date between 1 Jan 1900 and today.",
  tmdbDown: "Can't reach the movie database right now. Try again in a minute.",
  signIn: "Sign in to continue.",
  generic: "Couldn't save that. Try again.",
} as const;

/** A failure the Owner can act on; its message is safe to show as is. */
export class UserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserError";
  }
}

/**
 * The sentence to show for a failed request. Unexpected errors are logged by
 * name and database error code only, so inputs, cookies and emails never reach the logs.
 */
export function userMessage(error: unknown, tag: string): string {
  if (error instanceof UserError) return error.message;
  if (error instanceof TmdbUnavailableError) {
    console.error(`[${tag}] TMDB unavailable`, { status: error.status });
    return MESSAGES.tmdbDown;
  }
  logUnexpected(error, tag);
  return MESSAGES.generic;
}

/** A JSON reply from a route handler; per-Owner data must never sit in a shared cache. */
export function jsonResponse(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
}

export function errorResponse(error: unknown, tag: string): Response {
  const status =
    error instanceof TmdbUnavailableError ? 503 : error instanceof UserError ? 400 : 500;
  return jsonResponse({ error: userMessage(error, tag) }, status);
}

export function logUnexpected(error: unknown, tag: string): void {
  console.error(`[${tag}] ${describeError(error)}`);
}
