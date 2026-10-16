import type { Episode, EpisodeKey, IsoDate, TitleKind } from "@/domain/types";

export type SearchResult = {
  kind: TitleKind;
  tmdbId: number;
  name: string;
  year: number | null;
  posterPath: string | null;
};

export type MovieDetails = {
  kind: "movie";
  tmdbId: number;
  name: string;
  year: number | null;
  posterPath: string | null;
  overview: string | null;
  runtimeMinutes: number | null;
};

export type SeasonSummary = {
  seasonNumber: number;
  name: string;
  episodeCount: number;
  airDate: IsoDate | null;
};

export type SeriesDetails = {
  kind: "series";
  tmdbId: number;
  name: string;
  year: number | null;
  posterPath: string | null;
  overview: string | null;
  /** TMDB's raw status, such as "Returning Series", "Ended" or "Canceled". */
  status: string | null;
  seasons: SeasonSummary[];
  lastEpisodeToAir: (EpisodeKey & { airDate: IsoDate | null }) | null;
  nextEpisodeToAir: (EpisodeKey & { airDate: IsoDate | null }) | null;
};

export type SeasonDetails = {
  seasonNumber: number;
  name: string;
  episodes: Episode[];
};

export interface TmdbClient {
  /** Movies and Series only; people and other result types are dropped. */
  searchMulti(query: string): Promise<SearchResult[]>;
  /** Null when TMDB has no such Movie. */
  getMovie(tmdbId: number): Promise<MovieDetails | null>;
  /** Null when TMDB has no such Series. */
  getSeries(tmdbId: number): Promise<SeriesDetails | null>;
  /** Several Seasons of one Series. Unknown season numbers are left out of the result. */
  getSeasons(tmdbId: number, seasonNumbers: number[]): Promise<SeasonDetails[]>;
}
