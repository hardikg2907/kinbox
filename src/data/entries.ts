import "server-only";
import { and, count, desc, eq, inArray, sql } from "drizzle-orm";
import { after } from "next/server";
import { cache } from "react";
import { z } from "zod";
import { isIsoDate, isValidWatchDate } from "@/domain/dates";
import { isNoteTooLong, normalizeNote } from "@/domain/note";
import { canRate } from "@/domain/rating";
import { airedNumberedEpisodes } from "@/domain/series";
import {
  changeStatus,
  markSeriesWatched,
  statusAfterWatchDeleted,
  statusOnSave,
  watchAgain as watchAgainRule,
  type StatusChange,
} from "@/domain/status";
import type { Episode, Status } from "@/domain/types";
import { db } from "@/db/client";
import { entries, episodeProgress, titles, watches } from "@/db/schema";
import { getMovie } from "@/lib/tmdb/cached";
import { TmdbUnavailableError } from "@/lib/tmdb/real";
import type { EntryView, SaveResult, SeriesProgressView, WatchView } from "./dto";
import { MESSAGES, UserError } from "./errors";
import { loadSeriesEpisodes, loadTicks, progressView, type Executor, type Tx } from "./series";
import { requireOwner, type Owner } from "./session";
import { ensureTitle, isStale, refreshStaleTitle } from "./titles";
import { getToday } from "./today";

// --- Input schemas: every action and route parses with these before any query ---

// TMDB ids are positive and fit the integer column that stores them.
export const tmdbIdSchema = z.int().positive().max(2_147_483_647);
export const statusSchema = z.enum(["to_watch", "watching", "watched", "dropped"]);
export const kindSchema = z.enum(["movie", "series"]);
export const idSchema = z.uuid();

export const saveTitleInput = z.strictObject({
  kind: kindSchema,
  tmdbId: tmdbIdSchema,
  status: statusSchema,
});
export const setStatusInput = z.strictObject({ entryId: idSchema, status: statusSchema });
export const entryIdInput = z.strictObject({ entryId: idSchema });
export const watchIdInput = z.strictObject({ watchId: idSchema });
export const setWatchDateInput = z.strictObject({
  watchId: idSchema,
  watchedOn: z.string().max(10).refine(isIsoDate).nullable(),
});
export const setRatingInput = z.strictObject({
  entryId: idSchema,
  ratingHalfStars: z.int().min(1).max(10).nullable(),
});
// A generous transport cap; the 1,000-character rule applies after normalising.
export const setNoteInput = z.strictObject({ entryId: idSchema, note: z.string().max(4000) });

export type SaveTitleInput = z.infer<typeof saveTitleInput>;
export type SetStatusInput = z.infer<typeof setStatusInput>;
export type EntryIdInput = z.infer<typeof entryIdInput>;
export type WatchIdInput = z.infer<typeof watchIdInput>;
export type SetWatchDateInput = z.infer<typeof setWatchDateInput>;
export type SetRatingInput = z.infer<typeof setRatingInput>;
export type SetNoteInput = z.infer<typeof setNoteInput>;

// --- Shared Entry primitives ---

export type OwnedEntry = { id: string; status: Status; kind: "movie" | "series"; tmdbId: number };

/** The Owner's Entry with its Title's TMDB identity, read without a lock (before any TMDB call). */
export async function findOwnedEntry(ownerId: string, entryId: string): Promise<OwnedEntry> {
  const [row] = await db()
    .select({ id: entries.id, status: entries.status, kind: titles.kind, tmdbId: titles.tmdbId })
    .from(entries)
    .innerJoin(titles, eq(entries.titleId, titles.id))
    .where(and(eq(entries.id, entryId), eq(entries.userId, ownerId)));
  if (!row) throw new UserError(MESSAGES.entryNotFound);
  return row;
}

/**
 * Locks the Owner's Entry row for the rest of the transaction, so two fast taps
 * on one Entry run one after the other. Every decision reads state after this.
 */
export async function lockEntry(
  tx: Tx,
  ownerId: string,
  entryId: string,
): Promise<{ id: string; status: Status; progressMovedAt: Date | null; statusChangedAt: Date }> {
  const [row] = await tx
    .select({
      id: entries.id,
      status: entries.status,
      progressMovedAt: entries.progressMovedAt,
      statusChangedAt: entries.statusChangedAt,
    })
    .from(entries)
    .where(and(eq(entries.id, entryId), eq(entries.userId, ownerId)))
    .for("update");
  if (!row) throw new UserError(MESSAGES.entryNotFound);
  return row;
}

/** Writes a Status change and its Watch together. Returns the new Watch's id, if one was added. */
export async function applyStatusChange(
  tx: Tx,
  entryId: string,
  current: Status,
  change: StatusChange,
): Promise<{ statusChanged: boolean; addedWatchId: string | null }> {
  const statusChanged = change.status !== current;
  if (statusChanged) {
    await tx
      .update(entries)
      .set({ status: change.status, statusChangedAt: sql`now()` })
      .where(eq(entries.id, entryId));
  }
  if (change.addWatch === null) return { statusChanged, addedWatchId: null };
  const [watch] = await tx
    .insert(watches)
    .values({ entryId, watchedOn: change.addWatch.watchedOn })
    .returning({ id: watches.id });
  if (!watch) throw new Error("Watch insert returned no row");
  return { statusChanged, addedWatchId: watch.id };
}

// Keeps each insert far below Postgres's limit on bound parameters.
const TICK_BATCH = 1000;

/** Ticks Episodes; a tick that already exists is left alone. Returns how many were new. */
export async function insertTicks(tx: Tx, entryId: string, episodes: Episode[]): Promise<number> {
  let inserted = 0;
  for (let start = 0; start < episodes.length; start += TICK_BATCH) {
    const rows = await tx
      .insert(episodeProgress)
      .values(
        episodes.slice(start, start + TICK_BATCH).map((episode) => ({
          entryId,
          seasonNumber: episode.seasonNumber,
          episodeNumber: episode.episodeNumber,
          tmdbEpisodeId: episode.tmdbEpisodeId,
        })),
      )
      .onConflictDoNothing()
      .returning({ episodeNumber: episodeProgress.episodeNumber });
    inserted += rows.length;
  }
  if (inserted > 0) await markProgressMoved(tx, entryId);
  return inserted;
}

export async function markProgressMoved(executor: Executor, entryId: string): Promise<void> {
  await executor
    .update(entries)
    .set({ progressMovedAt: sql`now()` })
    .where(eq(entries.id, entryId));
}

// --- Writes ---

function pickerSeasons(details: { seasons: { seasonNumber: number; name: string; episodeCount: number }[] }) {
  return details.seasons
    .filter((season) => season.seasonNumber >= 1 && season.episodeCount > 0)
    .map(({ seasonNumber, name, episodeCount }) => ({ seasonNumber, name, episodeCount }));
}

export async function saveTitle(owner: Owner, input: SaveTitleInput): Promise<SaveResult> {
  const { titleId, details } = await ensureTitle(input.kind, input.tmdbId);
  const change = statusOnSave(input.status);

  let toTick: Episode[] = [];
  if (details.kind === "series" && change.status === "watched") {
    const [series, today] = await Promise.all([loadSeriesEpisodes(details.tmdbId), getToday()]);
    toTick = airedNumberedEpisodes(series.episodes, today);
  }

  return db().transaction(async (tx) => {
    const [created] = await tx
      .insert(entries)
      .values({ userId: owner.id, titleId, status: change.status })
      .onConflictDoNothing({ target: [entries.userId, entries.titleId] })
      .returning({ id: entries.id, status: entries.status });

    if (!created) {
      // A double tap or a second tab: the Title is already in the Library, so nothing changes.
      const [existing] = await tx
        .select({ id: entries.id, status: entries.status })
        .from(entries)
        .where(and(eq(entries.userId, owner.id), eq(entries.titleId, titleId)));
      if (!existing) throw new Error("Entry missing after a save conflict");
      return { entryId: existing.id, status: existing.status, created: false, seasons: null };
    }

    await applyStatusChange(tx, created.id, created.status, change);
    await insertTicks(tx, created.id, toTick);
    return {
      entryId: created.id,
      status: created.status,
      created: true,
      seasons:
        details.kind === "series" && created.status === "watching" ? pickerSeasons(details) : null,
    };
  });
}

export async function setStatus(
  owner: Owner,
  input: SetStatusInput,
): Promise<{ status: Status; addedWatch: boolean }> {
  const entry = await findOwnedEntry(owner.id, input.entryId);
  const today = await getToday();
  const series =
    entry.kind === "series" && input.status === "watched"
      ? await loadSeriesEpisodes(entry.tmdbId)
      : null;

  return db().transaction(async (tx) => {
    const locked = await lockEntry(tx, owner.id, entry.id);
    const change = series
      ? markSeriesWatched(locked.status, today)
      : changeStatus(locked.status, input.status, today);
    const { addedWatchId } = await applyStatusChange(tx, locked.id, locked.status, change);
    if (series && locked.status !== "watched") {
      await insertTicks(tx, locked.id, airedNumberedEpisodes(series.episodes, today));
    }
    return { status: change.status, addedWatch: addedWatchId !== null };
  });
}

export async function watchAgain(owner: Owner, input: EntryIdInput): Promise<{ watch: WatchView }> {
  const today = await getToday();
  return db().transaction(async (tx) => {
    const locked = await lockEntry(tx, owner.id, input.entryId);
    const change = watchAgainRule(today);
    const { addedWatchId } = await applyStatusChange(tx, locked.id, locked.status, change);
    if (addedWatchId === null) throw new Error("Watched again added no Watch");
    return { watch: { id: addedWatchId, watchedOn: today } };
  });
}

function ownedEntryIds(ownerId: string) {
  return db().select({ id: entries.id }).from(entries).where(eq(entries.userId, ownerId));
}

export async function setWatchDate(
  owner: Owner,
  input: SetWatchDateInput,
): Promise<{ watch: WatchView }> {
  if (input.watchedOn !== null && !isValidWatchDate(input.watchedOn, await getToday())) {
    throw new UserError(MESSAGES.watchDate);
  }
  const [row] = await db()
    .update(watches)
    .set({ watchedOn: input.watchedOn })
    .where(and(eq(watches.id, input.watchId), inArray(watches.entryId, ownedEntryIds(owner.id))))
    .returning({ id: watches.id, watchedOn: watches.watchedOn });
  if (!row) throw new UserError(MESSAGES.entryNotFound);
  return { watch: row };
}

export async function deleteWatch(owner: Owner, input: WatchIdInput): Promise<{ status: Status }> {
  return db().transaction(async (tx) => {
    const [watch] = await tx
      .select({ entryId: watches.entryId })
      .from(watches)
      .innerJoin(entries, eq(watches.entryId, entries.id))
      .where(and(eq(watches.id, input.watchId), eq(entries.userId, owner.id)));
    if (!watch) throw new UserError(MESSAGES.entryNotFound);

    const locked = await lockEntry(tx, owner.id, watch.entryId);
    const deleted = await tx
      .delete(watches)
      .where(and(eq(watches.id, input.watchId), eq(watches.entryId, locked.id)))
      .returning({ id: watches.id });
    if (deleted.length === 0) throw new UserError(MESSAGES.entryNotFound);

    const [remaining] = await tx
      .select({ n: count() })
      .from(watches)
      .where(eq(watches.entryId, locked.id));
    const status = statusAfterWatchDeleted(locked.status, remaining?.n ?? 0);
    await applyStatusChange(tx, locked.id, locked.status, { status, addWatch: null });
    return { status };
  });
}

export async function setRating(
  owner: Owner,
  input: SetRatingInput,
): Promise<{ ratingHalfStars: number | null }> {
  return db().transaction(async (tx) => {
    const locked = await lockEntry(tx, owner.id, input.entryId);
    // Clearing is always allowed: a Rating kept from before a move back to To watch can still go.
    if (input.ratingHalfStars !== null && !canRate(locked.status)) {
      throw new UserError(MESSAGES.rateNotStarted);
    }
    await tx
      .update(entries)
      .set({ ratingHalfStars: input.ratingHalfStars })
      .where(eq(entries.id, locked.id));
    return { ratingHalfStars: input.ratingHalfStars };
  });
}

export async function setNote(owner: Owner, input: SetNoteInput): Promise<{ note: string | null }> {
  const note = normalizeNote(input.note);
  if (note !== null && isNoteTooLong(note)) throw new UserError(MESSAGES.noteTooLong);
  const [row] = await db()
    .update(entries)
    .set({ note })
    .where(and(eq(entries.id, input.entryId), eq(entries.userId, owner.id)))
    .returning({ note: entries.note });
  if (!row) throw new UserError(MESSAGES.entryNotFound);
  return { note: row.note };
}

export async function deleteEntry(owner: Owner, input: EntryIdInput): Promise<null> {
  const deleted = await db()
    .delete(entries)
    .where(and(eq(entries.id, input.entryId), eq(entries.userId, owner.id)))
    .returning({ id: entries.id });
  if (deleted.length === 0) throw new UserError(MESSAGES.entryNotFound);
  return null;
}

// --- Reads ---

async function loadWatches(ownerId: string, entryId: string): Promise<WatchView[]> {
  return db()
    .select({ id: watches.id, watchedOn: watches.watchedOn })
    .from(watches)
    .innerJoin(entries, eq(watches.entryId, entries.id))
    .where(and(eq(watches.entryId, entryId), eq(entries.userId, ownerId)))
    .orderBy(sql`${watches.watchedOn} desc nulls last`, desc(watches.createdAt), desc(watches.id));
}

type LiveTitle = {
  name: string;
  year: number | null;
  posterPath: string | null;
  overview: string | null;
  runtimeMinutes: number | null;
  series: SeriesProgressView | null;
};

async function loadLiveTitle(
  ownerId: string,
  entry: { id: string; kind: "movie" | "series"; tmdbId: number },
): Promise<LiveTitle | null> {
  try {
    if (entry.kind === "movie") {
      const movie = await getMovie(entry.tmdbId);
      return movie && { ...movie, series: null };
    }
    const [series, watched, today] = await Promise.all([
      loadSeriesEpisodes(entry.tmdbId),
      loadTicks(db(), ownerId, entry.id),
      getToday(),
    ]);
    const { name, year, posterPath, overview } = series.details;
    return {
      name,
      year,
      posterPath,
      overview,
      runtimeMinutes: null,
      series: progressView(series, watched, today),
    };
  } catch (error) {
    if (error instanceof TmdbUnavailableError) return null;
    throw error;
  }
}

export async function getEntryFor(owner: Owner, entryId: string): Promise<EntryView | null> {
  if (!idSchema.safeParse(entryId).success) return null;
  const [row] = await db()
    .select({
      id: entries.id,
      status: entries.status,
      ratingHalfStars: entries.ratingHalfStars,
      note: entries.note,
      titleId: titles.id,
      kind: titles.kind,
      tmdbId: titles.tmdbId,
      name: titles.name,
      year: titles.year,
      posterPath: titles.posterPath,
      refreshedAt: titles.refreshedAt,
    })
    .from(entries)
    .innerJoin(titles, eq(entries.titleId, titles.id))
    .where(and(eq(entries.id, entryId), eq(entries.userId, owner.id)));
  if (!row) return null;

  if (isStale(row.refreshedAt)) after(() => refreshStaleTitle(row.titleId));

  const [entryWatches, live] = await Promise.all([
    loadWatches(owner.id, row.id),
    loadLiveTitle(owner.id, row),
  ]);
  return {
    id: row.id,
    status: row.status,
    ratingHalfStars: row.ratingHalfStars,
    canRate: canRate(row.status),
    note: row.note,
    title: {
      kind: row.kind,
      tmdbId: row.tmdbId,
      name: live?.name ?? row.name,
      year: live ? live.year : row.year,
      posterPath: live ? live.posterPath : row.posterPath,
      overview: live?.overview ?? null,
      runtimeMinutes: live?.runtimeMinutes ?? null,
    },
    watches: entryWatches,
    series: live?.series ?? null,
    tmdbUnavailable: live === null,
  };
}

/** The Owner's Entry page data, or null when the Owner has no such Entry. */
export const getEntry = cache(async (entryId: string): Promise<EntryView | null> => {
  const owner = await requireOwner();
  return getEntryFor(owner, entryId);
});
