import type { Episode, EpisodeKey, IsoDate, TitleKind } from "@/domain/types";

export type SearchResult = {
  kind: TitleKind;
  tmdbId: number;
  name: string;
  /** TMDB's `original_title` / `original_name`: the name in the Title's original language. */
  originalName: string | null;
  year: number | null;
  /** TMDB's `release_date` / `first_air_date`; null when TMDB has none. */
  releaseDate: IsoDate | null;
  /** TMDB's popularity score; 0 when TMDB sends none or a value that is not a number of 0 or more. */
  popularity: number;
  posterPath: string | null;
};

export type MovieDetails = {
  kind: "movie";
  tmdbId: number;
  name: string;
  year: number | null;
  /** TMDB's `release_date`; null when TMDB has none. */
  releaseDate: IsoDate | null;
  posterPath: string | null;
  overview: string | null;
  runtimeMinutes: number | null;
  /** IMDb's `tt` id; null when TMDB has none. */
  imdbId: string | null;
};

export type SeasonSummary = {
  seasonNumber: number;
  name: string;
  episodeCount: number;
  airDate: IsoDate | null;
};

/** A Series as the combined Season request returns it, which carries no IMDb id. */
export type SeriesBase = {
  kind: "series";
  tmdbId: number;
  name: string;
  year: number | null;
  /** TMDB's `first_air_date`; null when TMDB has none. */
  releaseDate: IsoDate | null;
  posterPath: string | null;
  overview: string | null;
  /** TMDB's raw status, such as "Returning Series", "Ended" or "Canceled". */
  status: string | null;
  seasons: SeasonSummary[];
  lastEpisodeToAir: (EpisodeKey & { airDate: IsoDate | null }) | null;
  nextEpisodeToAir: (EpisodeKey & { airDate: IsoDate | null }) | null;
};

export type SeriesDetails = SeriesBase & {
  /** IMDb's `tt` id; null when TMDB has none. */
  imdbId: string | null;
};

export type SeasonDetails = {
  seasonNumber: number;
  name: string;
  episodes: Episode[];
};

export type SeriesWithSeasons = { details: SeriesBase; seasons: SeasonDetails[] };

export interface TmdbClient {
  /** Movies and Series only; people and other result types are dropped. */
  searchMulti(query: string): Promise<SearchResult[]>;
  /** Null when TMDB has no such Movie. */
  getMovie(tmdbId: number): Promise<MovieDetails | null>;
  /** Null when TMDB has no such Series. */
  getSeries(tmdbId: number): Promise<SeriesDetails | null>;
  /** A Series with every Season it lists, Specials included. Null when TMDB has no such Series. */
  getSeriesWithSeasons(tmdbId: number): Promise<SeriesWithSeasons | null>;
  /** Several Seasons of one Series. Unknown season numbers are left out of the result. */
  getSeasons(tmdbId: number, seasonNumbers: number[]): Promise<SeasonDetails[]>;
}
