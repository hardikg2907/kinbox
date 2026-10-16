import type { Episode, EpisodeKey, IsoDate, SeriesEpisodes } from "./types";

export function isFinished(tmdbStatus: string | null): boolean {
  return tmdbStatus === "Ended" || tmdbStatus === "Canceled" || tmdbStatus === "Cancelled";
}

export function episodeKey(k: EpisodeKey): string {
  return `${k.seasonNumber}:${k.episodeNumber}`;
}

export function isSpecial(k: EpisodeKey): boolean {
  return k.seasonNumber === 0;
}

export function formatEpisode(k: EpisodeKey): string {
  return isSpecial(k) ? `Special ${k.episodeNumber}` : `S${k.seasonNumber} E${k.episodeNumber}`;
}

function byBroadcastOrder(a: EpisodeKey, b: EpisodeKey): number {
  return a.seasonNumber - b.seasonNumber || a.episodeNumber - b.episodeNumber;
}

export function numberedEpisodes(series: SeriesEpisodes): Episode[] {
  return series.seasons
    .filter((season) => season.seasonNumber >= 1)
    .flatMap((season) => season.episodes)
    .sort(byBroadcastOrder);
}

function hasAirDateOnOrBefore(episode: Episode, today: IsoDate): boolean {
  return episode.airDate !== null && episode.airDate <= today;
}

/**
 * Old and regional Series often lack air dates for Episodes that aired long ago,
 * so an undated Episode inherits "aired" from any later numbered Episode that
 * has aired. A dated Episode is always judged by its own date.
 */
export function airedKeys(series: SeriesEpisodes, today: IsoDate): Set<string> {
  const numbered = numberedEpisodes(series);
  const lastAiredIndex = numbered.findLastIndex((episode) => hasAirDateOnOrBefore(episode, today));

  const aired = new Set<string>();
  const addIfAired = (episode: Episode, undatedCountsAsAired: boolean) => {
    const isAired =
      episode.airDate === null ? undatedCountsAsAired : hasAirDateOnOrBefore(episode, today);
    if (isAired) aired.add(episodeKey(episode));
  };

  numbered.forEach((episode, index) => addIfAired(episode, index < lastAiredIndex));
  series.seasons
    .filter((season) => season.seasonNumber === 0)
    .flatMap((season) => season.episodes)
    .forEach((special) => addIfAired(special, lastAiredIndex >= 0));

  return aired;
}

export type ProgressSummary = {
  next: Episode | null;
  caughtUp: boolean;
  allNumberedWatched: boolean;
  /** Watched numbered Episodes. */
  watchedCount: number;
  /** Aired numbered Episodes. */
  airedCount: number;
  /** Numbered Episodes. */
  totalCount: number;
};

export function summarizeProgress(
  series: SeriesEpisodes,
  watched: ReadonlySet<string>,
  today: IsoDate,
): ProgressSummary {
  const numbered = numberedEpisodes(series);
  const aired = airedKeys(series, today);
  const isWatched = (episode: Episode) => watched.has(episodeKey(episode));
  const isAired = (episode: Episode) => aired.has(episodeKey(episode));
  const isAiredAndUnwatched = (episode: Episode) => isAired(episode) && !isWatched(episode);

  const lastWatchedIndex = numbered.findLastIndex(isWatched);
  const next =
    numbered.slice(lastWatchedIndex + 1).find(isAiredAndUnwatched) ??
    numbered.find(isAiredAndUnwatched) ??
    null;

  return {
    next,
    caughtUp: !series.finished && !numbered.some(isAiredAndUnwatched),
    allNumberedWatched: numbered.length > 0 && numbered.every(isWatched),
    watchedCount: numbered.filter(isWatched).length,
    airedCount: numbered.filter(isAired).length,
    totalCount: numbered.length,
  };
}

export function isEpisodeAired(series: SeriesEpisodes, episode: EpisodeKey, today: IsoDate): boolean {
  return airedKeys(series, today).has(episodeKey(episode));
}

export function airedNumberedEpisodes(series: SeriesEpisodes, today: IsoDate): Episode[] {
  const aired = airedKeys(series, today);
  return numberedEpisodes(series).filter((episode) => aired.has(episodeKey(episode)));
}

export function seasonEpisodes(series: SeriesEpisodes, seasonNumber: number): Episode[] {
  return series.seasons
    .filter((season) => season.seasonNumber === seasonNumber)
    .flatMap((season) => season.episodes)
    .sort(byBroadcastOrder);
}

export function episodesBefore(series: SeriesEpisodes, place: EpisodeKey): Episode[] {
  const numbered = numberedEpisodes(series);
  const key = episodeKey(place);
  const index = numbered.findIndex((episode) => episodeKey(episode) === key);
  return index < 0 ? [] : numbered.slice(0, index);
}

export function earlierUnwatched(
  series: SeriesEpisodes,
  watched: ReadonlySet<string>,
  target: EpisodeKey,
): Episode[] {
  return episodesBefore(series, target).filter((episode) => !watched.has(episodeKey(episode)));
}
