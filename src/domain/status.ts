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
