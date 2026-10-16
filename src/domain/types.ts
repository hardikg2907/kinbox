export type Status = "to_watch" | "watching" | "watched" | "dropped";

export const STATUSES: readonly Status[] = ["to_watch", "watching", "watched", "dropped"];

export type TitleKind = "movie" | "series";

/** An ISO calendar date, YYYY-MM-DD, in the Owner's time zone. */
export type IsoDate = string;

export type EpisodeKey = {
  /** 0 is TMDB's Specials season. */
  seasonNumber: number;
  episodeNumber: number;
};

export type Episode = EpisodeKey & {
  tmdbEpisodeId: number;
  name: string | null;
  /** Null when TMDB has no air date yet; such an Episode counts as unaired. */
  airDate: IsoDate | null;
};

export type Season = {
  seasonNumber: number;
  /** In TMDB broadcast order. */
  episodes: Episode[];
};

/** Everything the Series progress rules need about one Series. */
export type SeriesEpisodes = {
  /** TMDB says the Series ended or was cancelled. */
  finished: boolean;
  seasons: Season[];
};
