import "server-only";
import { and, eq } from "drizzle-orm";
import {
  airedKeys,
  episodeKey,
  formatEpisode,
  isFinished,
  seasonEpisodes,
  summarizeProgress,
} from "@/domain/series";
import type { Episode, IsoDate, SeriesEpisodes } from "@/domain/types";
import type { Database } from "@/db/client";
import { entries, episodeProgress } from "@/db/schema";
import { getSeasons, getSeries } from "@/lib/tmdb/cached";
import { TmdbUnavailableError } from "@/lib/tmdb/real";
import type { SeriesDetails } from "@/lib/tmdb/types";
import type {
  CardProgress,
  EpisodeView,
  NextEpisode,
  SeasonSummaryView,
  SeasonView,
  SeriesProgressView,
} from "./dto";

export type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];
export type Executor = Database | Tx;

export type LoadedSeries = { details: SeriesDetails; episodes: SeriesEpisodes };

/** A Series and every Season TMDB lists for it, Specials included. */
export async function loadSeriesEpisodes(tmdbId: number): Promise<LoadedSeries> {
  const details = await getSeries(tmdbId);
  // Without its Episode list a stored Series cannot be shown or changed, the same as TMDB being down.
  if (details === null) throw new TmdbUnavailableError({ status: 404, path: "/tv" });
  const seasons = await getSeasons(
    tmdbId,
    details.seasons.map((season) => season.seasonNumber),
  );
  return {
    details,
    episodes: {
      finished: isFinished(details.status),
      seasons: seasons.map((season) => ({
        seasonNumber: season.seasonNumber,
        episodes: season.episodes,
      })),
    },
  };
}

/** The Owner's ticks on one Entry, as episode keys. */
export async function loadTicks(
  executor: Executor,
  ownerId: string,
  entryId: string,
): Promise<Set<string>> {
  const rows = await executor
    .select({
      seasonNumber: episodeProgress.seasonNumber,
      episodeNumber: episodeProgress.episodeNumber,
    })
    .from(episodeProgress)
    .innerJoin(entries, eq(episodeProgress.entryId, entries.id))
    .where(and(eq(episodeProgress.entryId, entryId), eq(entries.userId, ownerId)));
  return new Set(rows.map(episodeKey));
}

export function findEpisode(
  episodes: SeriesEpisodes,
  seasonNumber: number,
  episodeNumber: number,
): Episode | null {
  return (
    seasonEpisodes(episodes, seasonNumber).find(
      (episode) => episode.episodeNumber === episodeNumber,
    ) ?? null
  );
}

function seasonName(details: SeriesDetails, seasonNumber: number): string {
  const listed = details.seasons.find((season) => season.seasonNumber === seasonNumber)?.name;
  if (listed) return listed;
  return seasonNumber === 0 ? "Specials" : `Season ${seasonNumber}`;
}

function nextEpisode(episode: Episode | null): NextEpisode | null {
  if (episode === null) return null;
  return {
    seasonNumber: episode.seasonNumber,
    episodeNumber: episode.episodeNumber,
    name: episode.name,
    label: formatEpisode(episode),
  };
}

export function cardProgress(
  episodes: SeriesEpisodes,
  watched: ReadonlySet<string>,
  today: IsoDate,
): CardProgress {
  const summary = summarizeProgress(episodes, watched, today);
  return {
    next: nextEpisode(summary.next),
    caughtUp: summary.caughtUp,
    allNumberedWatched: summary.allNumberedWatched,
  };
}

export function progressView(
  series: LoadedSeries,
  watched: ReadonlySet<string>,
  today: IsoDate,
): SeriesProgressView {
  const { details, episodes } = series;
  const summary = summarizeProgress(episodes, watched, today);
  const aired = airedKeys(episodes, today);

  const numbered = episodes.seasons
    .filter((season) => season.seasonNumber >= 1)
    .sort((a, b) => a.seasonNumber - b.seasonNumber);
  const specials = episodes.seasons.filter((season) => season.seasonNumber === 0);

  const seasons: SeasonSummaryView[] = [...numbered, ...specials].map((season) => {
    const keys = season.episodes.map(episodeKey);
    return {
      seasonNumber: season.seasonNumber,
      name: seasonName(details, season.seasonNumber),
      isSpecials: season.seasonNumber === 0,
      episodeCount: season.episodes.length,
      watchedCount: keys.filter((key) => watched.has(key)).length,
      airedCount: keys.filter((key) => aired.has(key)).length,
    };
  });

  return {
    finished: episodes.finished,
    next: nextEpisode(summary.next),
    caughtUp: summary.caughtUp,
    allNumberedWatched: summary.allNumberedWatched,
    watchedCount: summary.watchedCount,
    airedCount: summary.airedCount,
    totalCount: summary.totalCount,
    seasons,
  };
}

/** One Season's Episodes, or null when TMDB does not list that Season. */
export function seasonView(
  series: LoadedSeries,
  seasonNumber: number,
  watched: ReadonlySet<string>,
  today: IsoDate,
): SeasonView | null {
  const { details, episodes } = series;
  if (!episodes.seasons.some((season) => season.seasonNumber === seasonNumber)) return null;
  const aired = airedKeys(episodes, today);
  const views: EpisodeView[] = seasonEpisodes(episodes, seasonNumber).map((episode) => {
    const key = episodeKey(episode);
    return {
      seasonNumber: episode.seasonNumber,
      episodeNumber: episode.episodeNumber,
      tmdbEpisodeId: episode.tmdbEpisodeId,
      name: episode.name,
      airDate: episode.airDate,
      aired: aired.has(key),
      watched: watched.has(key),
      label: formatEpisode(episode),
    };
  });
  return { seasonNumber, name: seasonName(details, seasonNumber), episodes: views };
}
