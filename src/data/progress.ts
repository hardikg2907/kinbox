import "server-only";
import { and, count, eq, gt, gte, or } from "drizzle-orm";
import { cache } from "react";
import { z } from "zod";
import {
  airedKeys,
  earlierUnwatched,
  episodeKey,
  episodesBefore,
  isSpecial,
  seasonEpisodes,
  summarizeProgress,
} from "@/domain/series";
import { afterEpisodeTicked, statusAfterWatchDeleted } from "@/domain/status";
import type { Episode, IsoDate, Status } from "@/domain/types";
import { db } from "@/db/client";
import { entries, episodeProgress, watches } from "@/db/schema";
import type { ProgressChange, SeasonView, WatchedNextUndo } from "./dto";
import {
  applyStatusChange,
  findOwnedEntry,
  idSchema,
  insertTicks,
  lockEntry,
  markProgressMoved,
  pastTimeSchema,
  statusSchema,
  type OwnedEntry,
} from "./entries";
import { MESSAGES, UserError } from "./errors";
import {
  findEpisode,
  loadSeriesEpisodes,
  loadTicks,
  progressView,
  seasonView,
  type LoadedSeries,
  type Tx,
} from "./series";
import { requireOwner, type Owner } from "./session";
import { getToday } from "./today";

// --- Input schemas ---

const seasonNumberSchema = z.int().min(0).max(1000);
// TMDB numbers some pilots 0 inside a numbered Season; they are ordinary Episodes.
const episodeNumberSchema = z.int().min(0).max(10000);

export const tickEpisodeInput = z.strictObject({
  entryId: idSchema,
  seasonNumber: seasonNumberSchema,
  episodeNumber: episodeNumberSchema,
  watched: z.boolean(),
});
export const episodeInput = z.strictObject({
  entryId: idSchema,
  seasonNumber: seasonNumberSchema,
  episodeNumber: episodeNumberSchema,
});
export const markSeasonInput = z.strictObject({
  entryId: idSchema,
  seasonNumber: seasonNumberSchema,
  watched: z.boolean(),
});
export const watchedNextInput = z.strictObject({ entryId: idSchema });
export const undoWatchedNextInput = z.strictObject({
  entryId: idSchema,
  seasonNumber: seasonNumberSchema,
  episodeNumber: episodeNumberSchema,
  previousStatus: statusSchema,
  addedWatchId: idSchema.nullable(),
  previousProgressMovedAt: pastTimeSchema.nullable(),
  previousStatusChangedAt: pastTimeSchema,
});

export type TickEpisodeInput = z.infer<typeof tickEpisodeInput>;
export type EpisodeInput = z.infer<typeof episodeInput>;
export type MarkSeasonInput = z.infer<typeof markSeasonInput>;
export type WatchedNextInput = z.infer<typeof watchedNextInput>;
export type UndoWatchedNextInput = z.infer<typeof undoWatchedNextInput>;

// --- Shared steps ---

type Prepared = { ownerId: string; entry: OwnedEntry; series: LoadedSeries; today: IsoDate };

// TMDB is read before the transaction opens, so no network call ever holds the Entry lock.
async function prepare(owner: Owner, entryId: string): Promise<Prepared> {
  const entry = await findOwnedEntry(owner.id, entryId);
  if (entry.kind !== "series") throw new UserError(MESSAGES.notSeries);
  const [series, today] = await Promise.all([loadSeriesEpisodes(entry.tmdbId), getToday()]);
  return { ownerId: owner.id, entry, series, today };
}

function requireEpisode(series: LoadedSeries, seasonNumber: number, episodeNumber: number): Episode {
  const episode = findEpisode(series.episodes, seasonNumber, episodeNumber);
  if (episode === null) throw new UserError(MESSAGES.episodeNotFound);
  return episode;
}

type Outcome = {
  status: Status;
  statusChanged: boolean;
  addedWatchId: string | null;
  watched: Set<string>;
};

/** Ticks Episodes, then moves the Status once for the whole tap. A tap that ticks nothing changes nothing. */
async function tickAndAdvance(
  tx: Tx,
  locked: { id: string; status: Status },
  prepared: Prepared,
  toTick: Episode[],
): Promise<Outcome> {
  const inserted = await insertTicks(tx, locked.id, toTick);
  const watched = await loadTicks(tx, prepared.ownerId, locked.id);
  if (inserted === 0) {
    return { status: locked.status, statusChanged: false, addedWatchId: null, watched };
  }
  const { allNumberedWatched } = summarizeProgress(prepared.series.episodes, watched, prepared.today);
  const change = afterEpisodeTicked(locked.status, {
    finished: prepared.series.episodes.finished,
    allNumberedWatched,
    today: prepared.today,
  });
  const result = await applyStatusChange(tx, locked.id, locked.status, change);
  return { status: change.status, watched, ...result };
}

async function untick(
  tx: Tx,
  ownerId: string,
  entryId: string,
  where: { seasonNumber: number; episodeNumber?: number },
): Promise<Set<string>> {
  const deleted = await tx
    .delete(episodeProgress)
    .where(
      and(
        eq(episodeProgress.entryId, entryId),
        eq(episodeProgress.seasonNumber, where.seasonNumber),
        where.episodeNumber === undefined
          ? undefined
          : eq(episodeProgress.episodeNumber, where.episodeNumber),
      ),
    )
    .returning({ episodeNumber: episodeProgress.episodeNumber });
  if (deleted.length > 0) await markProgressMoved(tx, entryId);
  return loadTicks(tx, ownerId, entryId);
}

function toChange(
  prepared: Prepared,
  outcome: Outcome,
  extra: { earlierUnwatchedCount?: number; undo?: WatchedNextUndo } = {},
): ProgressChange {
  return {
    status: outcome.status,
    statusChanged: outcome.statusChanged,
    addedWatch: outcome.addedWatchId !== null,
    earlierUnwatchedCount: extra.earlierUnwatchedCount ?? 0,
    progress: progressView(prepared.series, outcome.watched, prepared.today),
    undo: extra.undo ?? null,
  };
}

function unchanged(status: Status, watched: Set<string>): Outcome {
  return { status, statusChanged: false, addedWatchId: null, watched };
}

// --- Writes ---

export async function tickEpisode(owner: Owner, input: TickEpisodeInput): Promise<ProgressChange> {
  const prepared = await prepare(owner, input.entryId);

  if (!input.watched) {
    // Unticking never moves the Status, and works even for an Episode TMDB no longer lists.
    return db().transaction(async (tx) => {
      const locked = await lockEntry(tx, owner.id, prepared.entry.id);
      const watched = await untick(tx, owner.id, locked.id, input);
      return toChange(prepared, unchanged(locked.status, watched));
    });
  }

  const target = requireEpisode(prepared.series, input.seasonNumber, input.episodeNumber);
  return db().transaction(async (tx) => {
    const locked = await lockEntry(tx, owner.id, prepared.entry.id);
    const outcome = await tickAndAdvance(tx, locked, prepared, [target]);
    const earlierUnwatchedCount = isSpecial(target)
      ? 0
      : earlierUnwatched(prepared.series.episodes, outcome.watched, target).length;
    return toChange(prepared, outcome, { earlierUnwatchedCount });
  });
}

export async function markEarlier(owner: Owner, input: EpisodeInput): Promise<ProgressChange> {
  const prepared = await prepare(owner, input.entryId);
  const target = requireEpisode(prepared.series, input.seasonNumber, input.episodeNumber);
  return db().transaction(async (tx) => {
    const locked = await lockEntry(tx, owner.id, prepared.entry.id);
    const watched = await loadTicks(tx, prepared.ownerId, locked.id);
    const toTick = earlierUnwatched(prepared.series.episodes, watched, target);
    return toChange(prepared, await tickAndAdvance(tx, locked, prepared, toTick));
  });
}

export async function markSeason(owner: Owner, input: MarkSeasonInput): Promise<ProgressChange> {
  const prepared = await prepare(owner, input.entryId);
  const { episodes } = prepared.series;

  if (!input.watched) {
    return db().transaction(async (tx) => {
      const locked = await lockEntry(tx, owner.id, prepared.entry.id);
      const watched = await untick(tx, owner.id, locked.id, { seasonNumber: input.seasonNumber });
      return toChange(prepared, unchanged(locked.status, watched));
    });
  }

  if (!episodes.seasons.some((season) => season.seasonNumber === input.seasonNumber)) {
    throw new UserError(MESSAGES.seasonNotFound);
  }
  const aired = airedKeys(episodes, prepared.today);
  const toTick = seasonEpisodes(episodes, input.seasonNumber).filter((episode) =>
    aired.has(episodeKey(episode)),
  );
  return db().transaction(async (tx) => {
    const locked = await lockEntry(tx, owner.id, prepared.entry.id);
    return toChange(prepared, await tickAndAdvance(tx, locked, prepared, toTick));
  });
}

export async function watchedNext(owner: Owner, input: WatchedNextInput): Promise<ProgressChange> {
  const prepared = await prepare(owner, input.entryId);
  return db().transaction(async (tx) => {
    const locked = await lockEntry(tx, owner.id, prepared.entry.id);
    const before = await loadTicks(tx, owner.id, locked.id);
    const { next } = summarizeProgress(prepared.series.episodes, before, prepared.today);
    if (next === null) throw new UserError(MESSAGES.caughtUp);

    const outcome = await tickAndAdvance(tx, locked, prepared, [next]);
    return toChange(prepared, outcome, {
      undo: {
        seasonNumber: next.seasonNumber,
        episodeNumber: next.episodeNumber,
        previousStatus: locked.status,
        addedWatchId: outcome.addedWatchId,
        previousProgressMovedAt: locked.progressMovedAt?.toISOString() ?? null,
        previousStatusChangedAt: locked.statusChangedAt.toISOString(),
      },
    });
  });
}

export async function undoWatchedNext(
  owner: Owner,
  input: UndoWatchedNextInput,
): Promise<ProgressChange> {
  const prepared = await prepare(owner, input.entryId);
  return db().transaction(async (tx) => {
    const locked = await lockEntry(tx, owner.id, prepared.entry.id);
    const watched = await untick(tx, owner.id, locked.id, input);

    if (input.addedWatchId !== null) {
      // Scoped to this Entry, so an id from elsewhere deletes nothing.
      await tx
        .delete(watches)
        .where(and(eq(watches.id, input.addedWatchId), eq(watches.entryId, locked.id)));
    }
    const [remaining] = await tx
      .select({ n: count() })
      .from(watches)
      .where(eq(watches.entryId, locked.id));
    // The restored Status comes from the client, so it still has to agree with the Watches left.
    const status = statusAfterWatchDeleted(input.previousStatus, remaining?.n ?? 0);
    const { statusChanged } = await applyStatusChange(tx, locked.id, locked.status, {
      status,
      addWatch: null,
    });
    // Last, because the untick and the Status change above both stamp now(). A Status that
    // could not go back to the old one really changed, so it keeps that stamp.
    await tx
      .update(entries)
      .set({
        progressMovedAt: input.previousProgressMovedAt ? new Date(input.previousProgressMovedAt) : null,
        ...(status === input.previousStatus
          ? { statusChangedAt: new Date(input.previousStatusChangedAt) }
          : {}),
      })
      .where(eq(entries.id, locked.id));
    return toChange(prepared, { status, statusChanged, addedWatchId: null, watched });
  });
}

// The pick sets the place rather than adding to it, so a corrected pick right after saving
// leaves no ticks behind from the earlier one. Specials are never touched.
export async function setNextToWatch(owner: Owner, input: EpisodeInput): Promise<ProgressChange> {
  const prepared = await prepare(owner, input.entryId);
  const target = requireEpisode(prepared.series, input.seasonNumber, input.episodeNumber);
  // The picker offers numbered Seasons only; Specials never count toward "Next".
  if (isSpecial(target)) throw new UserError(MESSAGES.episodeNotFound);
  const aired = airedKeys(prepared.series.episodes, prepared.today);
  const toTick = episodesBefore(prepared.series.episodes, target).filter((episode) =>
    aired.has(episodeKey(episode)),
  );
  return db().transaction(async (tx) => {
    const locked = await lockEntry(tx, owner.id, prepared.entry.id);
    const unticked = await tx
      .delete(episodeProgress)
      .where(
        and(
          eq(episodeProgress.entryId, locked.id),
          gte(episodeProgress.seasonNumber, 1),
          or(
            gt(episodeProgress.seasonNumber, target.seasonNumber),
            and(
              eq(episodeProgress.seasonNumber, target.seasonNumber),
              gte(episodeProgress.episodeNumber, target.episodeNumber),
            ),
          ),
        ),
      )
      .returning({ episodeNumber: episodeProgress.episodeNumber });
    if (unticked.length > 0) await markProgressMoved(tx, locked.id);
    return toChange(prepared, await tickAndAdvance(tx, locked, prepared, toTick));
  });
}

// --- Reads ---

export async function getSeasonFor(
  owner: Owner,
  entryId: string,
  seasonNumber: number,
): Promise<SeasonView | null> {
  if (!idSchema.safeParse(entryId).success) return null;
  if (!seasonNumberSchema.safeParse(seasonNumber).success) return null;

  let entry: OwnedEntry;
  try {
    entry = await findOwnedEntry(owner.id, entryId);
  } catch (error) {
    if (error instanceof UserError) return null;
    throw error;
  }
  if (entry.kind !== "series") return null;

  const [series, watched, today] = await Promise.all([
    loadSeriesEpisodes(entry.tmdbId),
    loadTicks(db(), owner.id, entry.id),
    getToday(),
  ]);
  return seasonView(series, seasonNumber, watched, today);
}

/** One Season's Episodes with the Owner's ticks, or null when there is no such Entry or Season. */
export const getSeason = cache(
  async (entryId: string, seasonNumber: number): Promise<SeasonView | null> => {
    const owner = await requireOwner();
    return getSeasonFor(owner, entryId, seasonNumber);
  },
);
