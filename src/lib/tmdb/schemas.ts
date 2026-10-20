import { z } from "zod";
import type { Episode, IsoDate } from "@/domain/types";
import { isPosterPath } from "./images";
import type {
  MovieDetails,
  SearchResult,
  SeasonDetails,
  SeasonSummary,
  SeriesDetails,
} from "./types";

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// Generous limits: they only stop a hostile or broken response from filling storage or the page.
const MAX_NAME_LENGTH = 300;
const MAX_OVERVIEW_LENGTH = 5000;
const MAX_STATUS_LENGTH = 50;

/** Rejects anything that is not a TMDB id, before it reaches a URL path. */
export function assertTmdbId(value: number): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError("TMDB id must be a positive integer");
  }
}

/** Rejects anything that is not a season number (0 is Specials), before it reaches a URL path. */
export function assertSeasonNumber(value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError("Season number must be an integer of 0 or more");
  }
}

function clip(text: string, max: number): string {
  return text.length <= max ? text : Array.from(text).slice(0, max).join("");
}

// TMDB sends "" for unknown values as often as null, so both mean "no value".
function optionalText(max: number) {
  return z
    .string()
    .nullish()
    .transform((value): string | null => {
      const trimmed = value?.trim() ?? "";
      return trimmed === "" ? null : clip(trimmed, max);
    });
}

function requiredText(max: number) {
  return z
    .string()
    .trim()
    .min(1)
    .transform((value) => clip(value, max));
}

// A date that is not YYYY-MM-DD is treated as unknown, which the domain rules read as "unaired".
const optionalDate = z
  .string()
  .nullish()
  .transform((value): IsoDate | null => {
    const trimmed = value?.trim() ?? "";
    return ISO_DATE_PATTERN.test(trimmed) ? trimmed : null;
  });

// Popularity only breaks ties between matches, so a bad value must not fail the whole search.
const optionalPopularity = z
  .unknown()
  .optional()
  .transform((value): number =>
    typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0,
  );

const optionalPosterPath = z
  .string()
  .nullish()
  .transform((value): string | null => (value != null && isPosterPath(value) ? value : null));

const tmdbId = z.int().positive();
const seasonNumber = z.int().min(0);
const episodeNumber = z.int().min(0);

/** The year is the first four digits of a well-formed date; anything else is unknown. */
export function yearFromDate(date: IsoDate | null): number | null {
  if (date === null || !ISO_DATE_PATTERN.test(date)) return null;
  const year = Number(date.slice(0, 4));
  return year >= 1 ? year : null;
}

function defaultSeasonName(number: number): string {
  return number === 0 ? "Specials" : `Season ${number}`;
}

// --- Raw TMDB shapes (untrusted input) ---

const rawSearchMovie = z.object({
  media_type: z.literal("movie"),
  id: tmdbId,
  title: optionalText(MAX_NAME_LENGTH),
  original_title: optionalText(MAX_NAME_LENGTH),
  release_date: optionalDate,
  popularity: optionalPopularity,
  poster_path: optionalPosterPath,
});

const rawSearchTv = z.object({
  media_type: z.literal("tv"),
  id: tmdbId,
  name: optionalText(MAX_NAME_LENGTH),
  original_name: optionalText(MAX_NAME_LENGTH),
  first_air_date: optionalDate,
  popularity: optionalPopularity,
  poster_path: optionalPosterPath,
});

// People and any other result type: the item is dropped without reading its other fields.
// Movie and tv items that are malformed do not land here, so they fail the whole parse.
const rawSearchOther = z
  .object({
    media_type: z.string().refine((type) => type !== "movie" && type !== "tv"),
  })
  .transform(() => ({ media_type: "other" as const }));

export const rawSearchResponseSchema = z.object({
  results: z.array(z.union([rawSearchMovie, rawSearchTv, rawSearchOther])),
});

export const rawMovieSchema = z.object({
  id: tmdbId,
  title: requiredText(MAX_NAME_LENGTH),
  release_date: optionalDate,
  poster_path: optionalPosterPath,
  overview: optionalText(MAX_OVERVIEW_LENGTH),
  // TMDB reports 0 when the runtime is unknown.
  runtime: z
    .number()
    .nullish()
    .transform((value): number | null =>
      value != null && Number.isInteger(value) && value > 0 ? value : null,
    ),
});

const rawSeasonSummary = z.object({
  season_number: seasonNumber,
  name: optionalText(MAX_NAME_LENGTH),
  episode_count: z.int().min(0).nullish(),
  air_date: optionalDate,
});

const rawEpisodeRef = z.object({
  season_number: seasonNumber,
  episode_number: episodeNumber,
  air_date: optionalDate,
});

export const rawSeriesSchema = z.object({
  id: tmdbId,
  name: requiredText(MAX_NAME_LENGTH),
  first_air_date: optionalDate,
  poster_path: optionalPosterPath,
  overview: optionalText(MAX_OVERVIEW_LENGTH),
  status: optionalText(MAX_STATUS_LENGTH),
  seasons: z.array(rawSeasonSummary).nullish(),
  last_episode_to_air: rawEpisodeRef.nullish(),
  next_episode_to_air: rawEpisodeRef.nullish(),
});

const rawEpisode = z.object({
  id: tmdbId,
  season_number: seasonNumber,
  episode_number: episodeNumber,
  name: optionalText(MAX_NAME_LENGTH),
  air_date: optionalDate,
});

export const rawSeasonSchema = z.object({
  season_number: seasonNumber,
  name: optionalText(MAX_NAME_LENGTH),
  episodes: z.array(rawEpisode).nullish(),
});

// --- Mapping raw TMDB JSON to the contract types ---
// Each mapper throws a ZodError when the response does not have the expected shape.

export function mapSearchResponse(json: unknown): SearchResult[] {
  const { results } = rawSearchResponseSchema.parse(json);
  const mapped: SearchResult[] = [];
  for (const item of results) {
    if (item.media_type === "movie" && item.title !== null) {
      mapped.push({
        kind: "movie",
        tmdbId: item.id,
        name: item.title,
        originalName: item.original_title,
        year: yearFromDate(item.release_date),
        releaseDate: item.release_date,
        popularity: item.popularity,
        posterPath: item.poster_path,
      });
    } else if (item.media_type === "tv" && item.name !== null) {
      mapped.push({
        kind: "series",
        tmdbId: item.id,
        name: item.name,
        originalName: item.original_name,
        year: yearFromDate(item.first_air_date),
        releaseDate: item.first_air_date,
        popularity: item.popularity,
        posterPath: item.poster_path,
      });
    }
  }
  return mapped;
}

export function mapMovie(json: unknown): MovieDetails {
  const raw = rawMovieSchema.parse(json);
  return {
    kind: "movie",
    tmdbId: raw.id,
    name: raw.title,
    year: yearFromDate(raw.release_date),
    releaseDate: raw.release_date,
    posterPath: raw.poster_path,
    overview: raw.overview,
    runtimeMinutes: raw.runtime,
  };
}

function mapEpisodeRef(ref: z.infer<typeof rawEpisodeRef> | null | undefined) {
  if (!ref) return null;
  return {
    seasonNumber: ref.season_number,
    episodeNumber: ref.episode_number,
    airDate: ref.air_date,
  };
}

export function mapSeries(json: unknown): SeriesDetails {
  const raw = rawSeriesSchema.parse(json);
  const seasons: SeasonSummary[] = (raw.seasons ?? [])
    .map((season) => ({
      seasonNumber: season.season_number,
      name: season.name ?? defaultSeasonName(season.season_number),
      episodeCount: season.episode_count ?? 0,
      airDate: season.air_date,
    }))
    .sort((a, b) => a.seasonNumber - b.seasonNumber);

  return {
    kind: "series",
    tmdbId: raw.id,
    name: raw.name,
    year: yearFromDate(raw.first_air_date),
    releaseDate: raw.first_air_date,
    posterPath: raw.poster_path,
    overview: raw.overview,
    status: raw.status,
    seasons,
    lastEpisodeToAir: mapEpisodeRef(raw.last_episode_to_air),
    nextEpisodeToAir: mapEpisodeRef(raw.next_episode_to_air),
  };
}

export function mapSeason(json: unknown): SeasonDetails {
  const raw = rawSeasonSchema.parse(json);
  const episodes: Episode[] = (raw.episodes ?? [])
    .map((episode) => ({
      tmdbEpisodeId: episode.id,
      seasonNumber: episode.season_number,
      episodeNumber: episode.episode_number,
      name: episode.name,
      airDate: episode.air_date,
    }))
    .sort((a, b) => a.episodeNumber - b.episodeNumber || a.tmdbEpisodeId - b.tmdbEpisodeId);
  return {
    seasonNumber: raw.season_number,
    name: raw.name ?? defaultSeasonName(raw.season_number),
    episodes,
  };
}

// --- Contract-shape schemas ---
// They check data that is already mapped, such as the bundled fixtures, and tie each
// schema to the exported contract type so the two cannot drift apart.

const contractName = z.string().min(1);
const contractDate = z.string().regex(ISO_DATE_PATTERN);
const contractPosterPath = z.string().refine(isPosterPath).nullable();
const contractYear = z.int().min(1).max(9999).nullable();

export const searchResultSchema: z.ZodType<SearchResult> = z.strictObject({
  kind: z.enum(["movie", "series"]),
  tmdbId,
  name: contractName,
  originalName: contractName.nullable(),
  year: contractYear,
  releaseDate: contractDate.nullable(),
  popularity: z.number().min(0),
  posterPath: contractPosterPath,
});

export const movieDetailsSchema: z.ZodType<MovieDetails> = z.strictObject({
  kind: z.literal("movie"),
  tmdbId,
  name: contractName,
  year: contractYear,
  releaseDate: contractDate.nullable(),
  posterPath: contractPosterPath,
  overview: z.string().nullable(),
  runtimeMinutes: z.int().positive().nullable(),
});

const contractEpisodeRef = z.strictObject({
  seasonNumber,
  episodeNumber,
  airDate: contractDate.nullable(),
});

export const seriesDetailsSchema: z.ZodType<SeriesDetails> = z.strictObject({
  kind: z.literal("series"),
  tmdbId,
  name: contractName,
  year: contractYear,
  releaseDate: contractDate.nullable(),
  posterPath: contractPosterPath,
  overview: z.string().nullable(),
  status: z.string().nullable(),
  seasons: z.array(
    z.strictObject({
      seasonNumber,
      name: z.string(),
      episodeCount: z.int().min(0),
      airDate: contractDate.nullable(),
    }),
  ),
  lastEpisodeToAir: contractEpisodeRef.nullable(),
  nextEpisodeToAir: contractEpisodeRef.nullable(),
});

export const seasonDetailsSchema: z.ZodType<SeasonDetails> = z.strictObject({
  seasonNumber,
  name: z.string(),
  episodes: z.array(
    z.strictObject({
      tmdbEpisodeId: tmdbId,
      seasonNumber,
      episodeNumber,
      name: z.string().nullable(),
      airDate: contractDate.nullable(),
    }),
  ),
});

/** A Series with its Seasons, as stored in a series fixture file. */
export type SeriesFixture = {
  details: SeriesDetails;
  seasons: SeasonDetails[];
};

export const seriesFixtureSchema: z.ZodType<SeriesFixture> = z.strictObject({
  details: seriesDetailsSchema,
  seasons: z.array(seasonDetailsSchema),
});
