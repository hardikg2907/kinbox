import type {
  EpisodeView,
  NextEpisode,
  SeasonView,
  SeriesProgressView,
  WatchView,
} from "@/data/dto";
import { formatEpisode } from "@/domain/series";
import type { IsoDate, Status } from "@/domain/types";

// A Watch the server has not confirmed yet has no real id. Anything that needs
// the id (changing its date, removing it) waits until the refreshed page brings it.
export const PENDING_WATCH_PREFIX = "pending:";

export function isPendingWatch(watch: WatchView): boolean {
  return watch.id.startsWith(PENDING_WATCH_PREFIX);
}

export type EntryModel = {
  status: Status;
  ratingHalfStars: number | null;
  watches: WatchView[];
  series: SeriesProgressView | null;
  /** The "Next" line is waiting for the server to say which Episode comes next. */
  nextPending: boolean;
  /** Seasons opened so far, by season number. */
  seasons: Record<number, SeasonView>;
};

// Each patch is a "set", not a "bump": a patch applied on top of data that
// already holds its result leaves that data unchanged, so a refreshed page
// arriving mid-action never double counts.
export type Patch =
  | { type: "status"; status: Status; today: IsoDate; pendingWatchId: string }
  | { type: "watch-again"; today: IsoDate; pendingWatchId: string }
  | { type: "watch-date"; watchId: string; watchedOn: IsoDate | null }
  | { type: "watch-remove"; watchId: string }
  | { type: "rating"; value: number | null }
  | { type: "tick"; seasonNumber: number; episodeNumber: number; watched: boolean }
  | {
      type: "advance";
      seasonNumber: number;
      episodeNumber: number;
      seasonWatchedCount: number;
      guess: NextEpisode | null;
    }
  | { type: "season"; seasonNumber: number; watched: boolean }
  | { type: "earlier"; seasonNumber: number; episodeNumber: number }
  | {
      type: "undo";
      seasonNumber: number;
      episodeNumber: number;
      previousStatus: Status;
      addedWatchId: string | null;
      series: SeriesProgressView | null;
    };

export function sortWatches(watches: WatchView[]): WatchView[] {
  return [...watches].sort((a, b) => {
    if (a.watchedOn === b.watchedOn) return 0;
    if (a.watchedOn === null) return 1;
    if (b.watchedOn === null) return -1;
    return a.watchedOn < b.watchedOn ? 1 : -1;
  });
}

export function withPendingWatch(watches: WatchView[], id: string, watchedOn: IsoDate): WatchView[] {
  if (watches.some((watch) => watch.id === id)) return watches;
  return sortWatches([{ id, watchedOn }, ...watches]);
}

function forwardStatus(status: Status): Status {
  return status === "to_watch" || status === "dropped" ? "watching" : status;
}

function withSeasonCount(
  series: SeriesProgressView,
  seasonNumber: number,
  count: number,
): SeriesProgressView {
  const seasons = series.seasons.map((season) =>
    season.seasonNumber === seasonNumber ? { ...season, watchedCount: count } : season,
  );
  // Specials never count toward the Series total.
  const watchedCount = seasons
    .filter((season) => !season.isSpecials)
    .reduce((sum, season) => sum + season.watchedCount, 0);
  return { ...series, seasons, watchedCount };
}

// Flags come from the opened Season when there is one; otherwise the caller's
// absolute `fallbackCount` (or nothing) stands in.
function updateSeason(
  model: EntryModel,
  seasonNumber: number,
  decide: (episode: EpisodeView) => boolean,
  fallbackCount: number | null,
): EntryModel {
  const opened = model.seasons[seasonNumber];
  let seasons = model.seasons;
  let count = fallbackCount;
  if (opened) {
    const episodes = opened.episodes.map((episode) => {
      const watched = decide(episode);
      return watched === episode.watched ? episode : { ...episode, watched };
    });
    seasons = { ...model.seasons, [seasonNumber]: { ...opened, episodes } };
    count = episodes.filter((episode) => episode.watched).length;
  }
  const series =
    model.series && count !== null ? withSeasonCount(model.series, seasonNumber, count) : model.series;
  return { ...model, seasons, series };
}

export function applyPatch(model: EntryModel, patch: Patch): EntryModel {
  switch (patch.type) {
    case "status": {
      if (patch.status !== "watched" || model.status === "watched") {
        return { ...model, status: patch.status };
      }
      let next: EntryModel = {
        ...model,
        status: "watched",
        watches: withPendingWatch(model.watches, patch.pendingWatchId, patch.today),
      };
      // Marking a Series watched ticks every aired numbered Episode.
      const series = model.series;
      if (series) {
        for (const season of series.seasons) {
          if (season.isSpecials) continue;
          next = updateSeason(
            next,
            season.seasonNumber,
            (episode) => episode.aired || episode.watched,
            Math.max(season.watchedCount, season.airedCount),
          );
        }
        if (next.series) {
          next = {
            ...next,
            nextPending: false,
            series: { ...next.series, next: null, caughtUp: !next.series.finished, allNumberedWatched: true },
          };
        }
      }
      return next;
    }
    case "watch-again":
      return {
        ...model,
        status: "watched",
        watches: withPendingWatch(model.watches, patch.pendingWatchId, patch.today),
      };
    case "watch-date":
      return {
        ...model,
        watches: sortWatches(
          model.watches.map((watch) =>
            watch.id === patch.watchId ? { ...watch, watchedOn: patch.watchedOn } : watch,
          ),
        ),
      };
    case "watch-remove": {
      const watches = model.watches.filter((watch) => watch.id !== patch.watchId);
      const status = model.status === "watched" && watches.length === 0 ? "to_watch" : model.status;
      return { ...model, watches, status };
    }
    case "rating":
      return { ...model, ratingHalfStars: patch.value };
    case "tick": {
      const next = updateSeason(
        model,
        patch.seasonNumber,
        (episode) => (episode.episodeNumber === patch.episodeNumber ? patch.watched : episode.watched),
        null,
      );
      return { ...next, status: patch.watched ? forwardStatus(model.status) : model.status };
    }
    case "advance": {
      const ticked = updateSeason(
        model,
        patch.seasonNumber,
        (episode) => (episode.episodeNumber === patch.episodeNumber ? true : episode.watched),
        patch.seasonWatchedCount,
      );
      return {
        ...ticked,
        status: forwardStatus(model.status),
        nextPending: patch.guess === null,
        series: ticked.series && {
          ...ticked.series,
          next: patch.guess ?? ticked.series.next,
          caughtUp: false,
        },
      };
    }
    case "season": {
      const next = updateSeason(
        model,
        patch.seasonNumber,
        (episode) => (patch.watched ? episode.aired || episode.watched : false),
        null,
      );
      return { ...next, status: patch.watched ? forwardStatus(model.status) : model.status };
    }
    case "earlier": {
      let next = model;
      for (const season of model.series?.seasons ?? []) {
        if (season.isSpecials || season.seasonNumber >= patch.seasonNumber) continue;
        next = updateSeason(next, season.seasonNumber, () => true, season.episodeCount);
      }
      next = updateSeason(
        next,
        patch.seasonNumber,
        (episode) => episode.episodeNumber <= patch.episodeNumber || episode.watched,
        null,
      );
      return { ...next, status: forwardStatus(model.status) };
    }
    case "undo": {
      const reverted = updateSeason(
        model,
        patch.seasonNumber,
        (episode) => (episode.episodeNumber === patch.episodeNumber ? false : episode.watched),
        null,
      );
      const before = patch.series;
      return {
        ...reverted,
        status: patch.previousStatus,
        nextPending: false,
        // The id may still be a placeholder when the refreshed page has not landed yet.
        watches: patch.addedWatchId
          ? reverted.watches.filter((watch) => watch.id !== patch.addedWatchId && !isPendingWatch(watch))
          : reverted.watches,
        series:
          reverted.series && before
            ? {
                ...reverted.series,
                next: before.next,
                caughtUp: before.caughtUp,
                allNumberedWatched: before.allNumberedWatched,
              }
            : reverted.series,
      };
    }
  }
}

/**
 * A best guess at the Episode after `next`, so the "Next" line can change at the
 * tap. Returns null when the answer is not obvious (the server will say).
 */
export function guessNext(series: SeriesProgressView, next: NextEpisode): NextEpisode | null {
  const season = series.seasons.find((candidate) => candidate.seasonNumber === next.seasonNumber);
  if (!season || season.isSpecials) return null;
  if (next.episodeNumber < season.airedCount) return nextOf(next.seasonNumber, next.episodeNumber + 1);
  if (next.episodeNumber >= season.episodeCount) {
    const following = series.seasons.find(
      (candidate) =>
        !candidate.isSpecials && candidate.seasonNumber > next.seasonNumber && candidate.airedCount > 0,
    );
    if (following) return nextOf(following.seasonNumber, 1);
  }
  return null;
}

function nextOf(seasonNumber: number, episodeNumber: number): NextEpisode {
  const key = { seasonNumber, episodeNumber };
  return { ...key, name: null, label: formatEpisode(key) };
}
