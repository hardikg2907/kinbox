import "server-only";
import { and, count, desc, eq, inArray, sql, type SQLWrapper } from "drizzle-orm";
import { after } from "next/server";
import { cache } from "react";
import { z } from "zod";
import { isIsoDate, isValidWatchDate } from "@/domain/dates";
import { isNoteTooLong, normalizeNote } from "@/domain/note";
import { canRate } from "@/domain/rating";
import { airedNumberedEpisodes } from "@/domain/series";
import {
  changeStatus,
  isUnchangedSinceMove,
  markSeriesWatched,
  moveChangedAnything,
  statusAfterUndo,
  statusAfterWatchDeleted,
  statusOnSave,
  watchAgain as watchAgainRule,
  type MovedEntry,
  type StatusChange,
  type StatusMoveRecord,
} from "@/domain/status";
import type { Episode, Status } from "@/domain/types";
import { db } from "@/db/client";
import { entries, episodeProgress, titles, watches } from "@/db/schema";
import { getMovie } from "@/lib/tmdb/cached";
import { TmdbUnavailableError } from "@/lib/tmdb/real";
import type {
  EntryView,
  SaveResult,
  SeriesProgressView,
  StatusMove,
  StatusMoveUndo,
  WatchAgainMove,
  WatchView,
} from "./dto";
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

// The stamps come from the database clock, which can run a little ahead of this server's.
const CLOCK_SKEW_MS = 60_000;

// A time from the client only puts back what the server handed out; a future one would pin the card to the top.
export const pastTimeSchema = z.iso
  .datetime({ offset: true })
  .refine((value) => Date.parse(value) <= Date.now() + CLOCK_SKEW_MS);

// Undo compares these for equality as text, so only the one form the server hands out is accepted.
const stampSchema = pastTimeSchema.pipe(z.iso.datetime({ precision: 6 }));

export const undoStatusMoveInput = z.strictObject({
  entryId: idSchema,
  status: statusSchema,
  previousStatus: statusSchema,
  previousStatusChangedAt: stampSchema,
  previousProgressMovedAt: stampSchema.nullable(),
  movedAt: stampSchema,
  addedWatchId: idSchema.nullable(),
  tickedCount: z.int().min(0).max(100_000),
  watchCount: z.int().min(0).max(100_000),
});

export type SaveTitleInput = z.infer<typeof saveTitleInput>;
export type SetStatusInput = z.infer<typeof setStatusInput>;
export type EntryIdInput = z.infer<typeof entryIdInput>;
export type WatchIdInput = z.infer<typeof watchIdInput>;
export type SetWatchDateInput = z.infer<typeof setWatchDateInput>;
export type SetRatingInput = z.infer<typeof setRatingInput>;
export type SetNoteInput = z.infer<typeof setNoteInput>;
export type UndoStatusMoveInput = z.infer<typeof undoStatusMoveInput>;

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

// Postgres keeps microseconds and a JS Date only milliseconds. Undo matches stamps exactly,
// so they leave the database as text in one fixed UTC form.
function stampText<T extends string | null>(value: SQLWrapper) {
  return sql<T>`to_char(${value} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`;
}

/**
 * What a Status move writes on a locked Entry, plus the transaction's clock. Every row the move
 * writes is stamped with that clock, since now() is fixed for the whole transaction.
 */
async function readMovedEntry(
  tx: Tx,
  ownerId: string,
  entryId: string,
): Promise<MovedEntry & { now: string }> {
  const [row] = await tx
    .select({
      status: entries.status,
      statusChangedAt: stampText<string>(entries.statusChangedAt),
      progressMovedAt: stampText<string | null>(entries.progressMovedAt),
      watchCount: tx.$count(watches, eq(watches.entryId, entries.id)),
      now: stampText<string>(sql`now()`),
    })
    .from(entries)
    .where(and(eq(entries.id, entryId), eq(entries.userId, ownerId)));
  if (!row) throw new UserError(MESSAGES.entryNotFound);
  return row;
}

function statusMove(
  entryId: string,
  before: MovedEntry & { now: string },
  status: Status,
  addedWatchId: string | null,
  tickedCount: number,
): StatusMove {
  const record: StatusMoveRecord = {
    status,
    previousStatus: before.status,
    previousStatusChangedAt: before.statusChangedAt,
    previousProgressMovedAt: before.progressMovedAt,
    movedAt: before.now,
    addedWatch: addedWatchId !== null,
    tickedCount,
    watchCount: before.watchCount + (addedWatchId === null ? 0 : 1),
  };
  const { addedWatch, ...undoFields } = record;
  const undo: StatusMoveUndo = { entryId, ...undoFields, addedWatchId };
  return {
    status,
    previousStatus: before.status,
    addedWatch,
    tickedCount,
    undo: moveChangedAnything(record) ? undo : null,
  };
}

// --- Writes ---

function pickerSeasons(details: { seasons: { seasonNumber: number; name: string; episodeCount: number }[] }) {
  return details.seasons
    .filter((season) => season.seasonNumber >= 1 && season.episodeCount > 0)
    .map(({ seasonNumber, name, episodeCount }) => ({ seasonNumber, name, episodeCount }));
}

export type NewEntry = {
  titleId: string;
  change: StatusChange;
  /** Episodes to tick along with the Status. */
  ticks: Episode[];
  /** The Import adding this Entry; null for a Title saved by hand. */
  importId: string | null;
};

/**
 * Adds the Owner's Entry for a Title with its Status, Watch and ticks, in the caller's transaction.
 * Every row it writes carries the transaction's now(), so an Entry nobody has touched since keeps
 * created_at = status_changed_at; "Undo this import" relies on that. A Title already in the
 * Library is left exactly as it was.
 */
export async function insertNewEntry(
  tx: Tx,
  ownerId: string,
  entry: NewEntry,
): Promise<{ entryId: string; status: Status; created: boolean }> {
  const [created] = await tx
    .insert(entries)
    .values({
      userId: ownerId,
      titleId: entry.titleId,
      status: entry.change.status,
      importId: entry.importId,
    })
    .onConflictDoNothing({ target: [entries.userId, entries.titleId] })
    .returning({ id: entries.id, status: entries.status });

  if (!created) {
    // A double tap, a second tab or an import line for a Title already in the Library.
    const [existing] = await tx
      .select({ id: entries.id, status: entries.status })
      .from(entries)
      .where(and(eq(entries.userId, ownerId), eq(entries.titleId, entry.titleId)));
    if (!existing) throw new Error("Entry missing after a save conflict");
    return { entryId: existing.id, status: existing.status, created: false };
  }

  await applyStatusChange(tx, created.id, created.status, entry.change);
  await insertTicks(tx, created.id, entry.ticks);
  return { entryId: created.id, status: created.status, created: true };
}

export async function saveTitle(owner: Owner, input: SaveTitleInput): Promise<SaveResult> {
  const { titleId, details } = await ensureTitle(input.kind, input.tmdbId);
  const change = statusOnSave(input.status);

  let ticks: Episode[] = [];
  if (details.kind === "series" && change.status === "watched") {
    const [series, today] = await Promise.all([loadSeriesEpisodes(details.tmdbId), getToday()]);
    ticks = airedNumberedEpisodes(series.episodes, today);
  }

  const saved = await db().transaction((tx) =>
    insertNewEntry(tx, owner.id, { titleId, change, ticks, importId: null }),
  );
  return {
    ...saved,
    seasons:
      saved.created && details.kind === "series" && saved.status === "watching"
        ? pickerSeasons(details)
        : null,
  };
}

export async function setStatus(owner: Owner, input: SetStatusInput): Promise<StatusMove> {
  const entry = await findOwnedEntry(owner.id, input.entryId);
  const today = await getToday();
  const series =
    entry.kind === "series" && input.status === "watched"
      ? await loadSeriesEpisodes(entry.tmdbId)
      : null;

  return db().transaction(async (tx) => {
    const locked = await lockEntry(tx, owner.id, entry.id);
    const before = await readMovedEntry(tx, owner.id, locked.id);
    const change = series
      ? markSeriesWatched(locked.status, today)
      : changeStatus(locked.status, input.status, today);
    const { addedWatchId } = await applyStatusChange(tx, locked.id, locked.status, change);
    const tickedCount =
      series && locked.status !== "watched"
        ? await insertTicks(tx, locked.id, airedNumberedEpisodes(series.episodes, today))
        : 0;
    return statusMove(locked.id, before, change.status, addedWatchId, tickedCount);
  });
}

export async function watchAgain(owner: Owner, input: EntryIdInput): Promise<WatchAgainMove> {
  const today = await getToday();
  return db().transaction(async (tx) => {
    const locked = await lockEntry(tx, owner.id, input.entryId);
    const before = await readMovedEntry(tx, owner.id, locked.id);
    const change = watchAgainRule(today);
    const { addedWatchId } = await applyStatusChange(tx, locked.id, locked.status, change);
    if (addedWatchId === null) throw new Error("Watched again added no Watch");
    return {
      ...statusMove(locked.id, before, change.status, addedWatchId, 0),
      watch: { id: addedWatchId, watchedOn: today },
    };
  });
}

/** Reverses one Status move or "Watched again", or refuses when the Entry changed since. Needs no TMDB call. */
export async function undoStatusMove(
  owner: Owner,
  input: UndoStatusMoveInput,
): Promise<{ status: Status }> {
  const move: StatusMoveRecord = { ...input, addedWatch: input.addedWatchId !== null };
  const movedAt = sql`${input.movedAt}::timestamptz`;

  // Any refusal below throws, so the transaction rolls back and nothing changes.
  return db().transaction(async (tx) => {
    const locked = await lockEntry(tx, owner.id, input.entryId);
    const current = await readMovedEntry(tx, owner.id, locked.id);
    if (!isUnchangedSinceMove(move, current)) throw new UserError(MESSAGES.changedSince);

    // The Watch and ticks the move added carry its time; rows from before it keep their own.
    // Undo removes exactly the rows with that time on this Entry, and only if they are what
    // the move reported, so a forged Watch id or count removes nothing.
    const removed = await tx
      .delete(watches)
      .where(and(eq(watches.entryId, locked.id), eq(watches.createdAt, movedAt)))
      .returning({ id: watches.id });
    const watchMatches =
      input.addedWatchId === null
        ? removed.length === 0
        : removed.length === 1 && removed[0]?.id === input.addedWatchId;
    if (!watchMatches) throw new UserError(MESSAGES.changedSince);

    const unticked = await tx
      .delete(episodeProgress)
      .where(and(eq(episodeProgress.entryId, locked.id), eq(episodeProgress.createdAt, movedAt)))
      .returning({ episodeNumber: episodeProgress.episodeNumber });
    if (unticked.length !== input.tickedCount) throw new UserError(MESSAGES.changedSince);

    const status = statusAfterUndo(move);
    await tx
      .update(entries)
      .set({
        status,
        // A Status that cannot go back to the old one really changed, so it is dated now.
        statusChangedAt:
          status === input.previousStatus
            ? sql`${input.previousStatusChangedAt}::timestamptz`
            : sql`now()`,
        progressMovedAt:
          input.previousProgressMovedAt === null
            ? null
            : sql`${input.previousProgressMovedAt}::timestamptz`,
      })
      .where(eq(entries.id, locked.id));
    return { status };
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
