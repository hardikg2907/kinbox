import "server-only";
import { and, asc, eq, isNull, lt } from "drizzle-orm";
import type { TitleKind } from "@/domain/types";
import { db } from "@/db/client";
import { entries, titles } from "@/db/schema";
import { getMovie, getSeries } from "@/lib/tmdb/cached";
import { TmdbUnavailableError } from "@/lib/tmdb/real";
import type { MovieDetails, SeriesDetails } from "@/lib/tmdb/types";
import { logUnexpected, MESSAGES, UserError } from "./errors";

// TMDB allows a stored snapshot for six months at most; a month keeps names and posters fresh.
const STALE_AFTER_MS = 30 * 24 * 60 * 60 * 1000;
// Keeps one Library read from fanning out into a burst of TMDB calls; later reads catch up.
const MAX_REFRESHES_PER_READ = 5;

export type TitleDetails = MovieDetails | SeriesDetails;

function fetchDetails(kind: TitleKind, tmdbId: number): Promise<TitleDetails | null> {
  return kind === "movie" ? getMovie(tmdbId) : getSeries(tmdbId);
}

function snapshotOf(details: TitleDetails) {
  return {
    name: details.name,
    year: details.year,
    posterPath: details.posterPath,
    tmdbStatus: details.kind === "series" ? details.status : null,
    imdbId: details.imdbId,
    imdbCheckedAt: new Date(),
  };
}

async function writeSnapshot(titleId: string, details: TitleDetails): Promise<void> {
  await db()
    .update(titles)
    .set({ ...snapshotOf(details), refreshedAt: new Date() })
    .where(eq(titles.id, titleId));
}

export function isStale(refreshedAt: Date, now: Date = new Date()): boolean {
  return now.getTime() - refreshedAt.getTime() > STALE_AFTER_MS;
}

/**
 * The stored Title for a TMDB id, created or refreshed from TMDB. The snapshot
 * always comes from TMDB, never from the client. Also returns the details so
 * callers do not fetch them twice.
 */
export async function ensureTitle(
  kind: TitleKind,
  tmdbId: number,
): Promise<{ titleId: string; details: TitleDetails }> {
  const details = await fetchDetails(kind, tmdbId);
  if (details === null) throw new UserError(MESSAGES.titleNotFound);

  const snapshot = snapshotOf(details);
  const [row] = await db()
    .insert(titles)
    .values({ kind, tmdbId, ...snapshot, refreshedAt: new Date() })
    .onConflictDoUpdate({
      target: [titles.kind, titles.tmdbId],
      set: { ...snapshot, refreshedAt: new Date() },
    })
    .returning({ id: titles.id });
  if (!row) throw new Error("Title upsert returned no row");
  return { titleId: row.id, details };
}

/** Re-fetches a Title snapshot that is older than a month. Never throws: it runs after the response. */
export async function refreshStaleTitle(titleId: string): Promise<void> {
  try {
    const cutoff = new Date(Date.now() - STALE_AFTER_MS);
    const [title] = await db()
      .select({ kind: titles.kind, tmdbId: titles.tmdbId })
      .from(titles)
      .where(and(eq(titles.id, titleId), lt(titles.refreshedAt, cutoff)));
    if (!title) return;

    const details = await fetchDetails(title.kind, title.tmdbId);
    // A Title TMDB no longer lists keeps its snapshot; there is nothing newer to store.
    if (details === null) return;

    await writeSnapshot(titleId, details);
  } catch (error) {
    logUnexpected(error, "refreshStaleTitle");
  }
}

/**
 * Refreshes the stalest Title snapshots in the Owner's Library, oldest first, so Titles the
 * Owner never opens still stay within TMDB's limit. Never throws: it runs after the response.
 */
export async function refreshStaleTitlesFor(ownerId: string): Promise<void> {
  try {
    const cutoff = new Date(Date.now() - STALE_AFTER_MS);
    const stale = await db()
      .select({ id: titles.id })
      .from(titles)
      .innerJoin(entries, eq(entries.titleId, titles.id))
      .where(and(eq(entries.userId, ownerId), lt(titles.refreshedAt, cutoff)))
      .orderBy(asc(titles.refreshedAt), asc(titles.id))
      .limit(MAX_REFRESHES_PER_READ);
    await Promise.all(stale.map((title) => refreshStaleTitle(title.id)));
  } catch (error) {
    logUnexpected(error, "refreshStaleTitlesFor");
  }
}

/**
 * Looks up TMDB's IMDb id for Titles saved before ids were kept, oldest snapshot first, and stores
 * the full fresh snapshot. A Title TMDB no longer lists is only marked as checked. Stops quietly
 * when TMDB is unavailable; any other error reaches the caller. `complete` is false when some
 * Titles are still unchecked afterwards, because TMDB was down or the limit was reached.
 */
export async function backfillImdbIds(
  options: { limit?: number; concurrency?: number } = {},
): Promise<{ complete: boolean }> {
  const { limit = 500, concurrency = 6 } = options;
  const pending = await db()
    .select({ id: titles.id, kind: titles.kind, tmdbId: titles.tmdbId })
    .from(titles)
    .where(isNull(titles.imdbCheckedAt))
    .orderBy(asc(titles.refreshedAt), asc(titles.id))
    .limit(limit);

  let next = 0;
  // Set on TMDB being down or on any failure, so the other workers start no new fetch.
  let stopped = false;
  let tmdbDown = false;
  async function work(): Promise<void> {
    while (!stopped) {
      const title = pending[next++];
      if (!title) return;
      try {
        const details = await fetchDetails(title.kind, title.tmdbId);
        if (details === null) {
          await db().update(titles).set({ imdbCheckedAt: new Date() }).where(eq(titles.id, title.id));
        } else {
          await writeSnapshot(title.id, details);
        }
      } catch (error) {
        stopped = true;
        if (error instanceof TmdbUnavailableError) {
          tmdbDown = true;
          return;
        }
        throw error;
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, pending.length) }, work));
  return { complete: !tmdbDown && pending.length < limit };
}
