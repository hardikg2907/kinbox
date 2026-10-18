import type { IsoDate, Status } from "./types";

export type StatusChange = {
  status: Status;
  /** A Watch the caller must add in the same transaction as the Status change. */
  addWatch: null | { watchedOn: IsoDate | null };
};

export function statusOnSave(target: Status): StatusChange {
  return { status: target, addWatch: target === "watched" ? { watchedOn: null } : null };
}

export function changeStatus(current: Status, target: Status, today: IsoDate): StatusChange {
  if (target === current) return { status: current, addWatch: null };
  return { status: target, addWatch: target === "watched" ? { watchedOn: today } : null };
}

export function watchAgain(today: IsoDate): StatusChange {
  return { status: "watched", addWatch: { watchedOn: today } };
}

export function statusAfterWatchDeleted(current: Status, remainingWatches: number): Status {
  return current === "watched" && remainingWatches === 0 ? "to_watch" : current;
}

export function afterEpisodeTicked(
  current: Status,
  ctx: { finished: boolean; allNumberedWatched: boolean; today: IsoDate },
): StatusChange {
  if (current === "watched") return { status: "watched", addWatch: null };
  if (ctx.finished && ctx.allNumberedWatched) return watchAgain(ctx.today);
  return { status: "watching", addWatch: null };
}

// Unticking never moves the Status or removes a Watch, so callers can leave the Entry alone.
export function afterEpisodeUnticked(current: Status): Status {
  return current;
}

export function markSeriesWatched(current: Status, today: IsoDate): StatusChange {
  return changeStatus(current, "watched", today);
}

/** The parts of an Entry that a Status move writes and its Undo puts back. Times are exact database stamps. */
export type MovedEntry = {
  status: Status;
  statusChangedAt: string;
  progressMovedAt: string | null;
  watchCount: number;
};

/** What a Status move did, as its Undo hands it back. */
export type StatusMoveRecord = {
  /** Where the move left the Entry. */
  status: Status;
  previousStatus: Status;
  previousStatusChangedAt: string;
  previousProgressMovedAt: string | null;
  /** The database time of the move. Every row the move wrote carries it. */
  movedAt: string;
  addedWatch: boolean;
  tickedCount: number;
  /** The Entry's Watches right after the move. */
  watchCount: number;
};

/** A move to the Status the Entry already has, adding nothing, has nothing to undo. */
export function moveChangedAnything(move: StatusMoveRecord): boolean {
  return move.status !== move.previousStatus || move.addedWatch || move.tickedCount > 0;
}

export function entryAfterMove(move: StatusMoveRecord): MovedEntry {
  return {
    status: move.status,
    statusChangedAt:
      move.status === move.previousStatus ? move.previousStatusChangedAt : move.movedAt,
    progressMovedAt: move.tickedCount > 0 ? move.movedAt : move.previousProgressMovedAt,
    watchCount: move.watchCount,
  };
}

/**
 * Undo never overwrites a later change. A later move, tick or untick stamps a different time,
 * and a later Watch, added or deleted, changes the count. Times are compared for equality, not
 * order: a database stamp is when its transaction began, which can be before an earlier commit.
 */
export function isUnchangedSinceMove(move: StatusMoveRecord, current: MovedEntry): boolean {
  const after = entryAfterMove(move);
  return (
    current.status === after.status &&
    current.statusChangedAt === after.statusChangedAt &&
    current.progressMovedAt === after.progressMovedAt &&
    current.watchCount === after.watchCount
  );
}

/** The Status Undo puts back. It still has to agree with the Watches left once the move's Watch goes. */
export function statusAfterUndo(move: StatusMoveRecord): Status {
  const remaining = Math.max(0, move.watchCount - (move.addedWatch ? 1 : 0));
  return statusAfterWatchDeleted(move.previousStatus, remaining);
}
