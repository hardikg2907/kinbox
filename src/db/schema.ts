import { sql } from "drizzle-orm";
import {
  check,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema";

export * from "./auth-schema";

export const titleKind = pgEnum("title_kind", ["movie", "series"]);
export const entryStatus = pgEnum("entry_status", ["to_watch", "watching", "watched", "dropped"]);

// A snapshot of TMDB data shared by every Library. TMDB allows keeping it for
// six months at most, so refreshed_at drives the refresh.
export const titles = pgTable(
  "titles",
  {
    id: uuid().primaryKey().defaultRandom(),
    kind: titleKind().notNull(),
    // TMDB numbers movies and TV shows separately, so the id is only unique per kind.
    tmdbId: integer().notNull(),
    name: text().notNull(),
    year: smallint(),
    posterPath: text(),
    tmdbStatus: text(),
    imdbId: text(),
    // Null until TMDB's IMDb id has been looked up for this Title, so Titles saved earlier get found.
    imdbCheckedAt: timestamp({ withTimezone: true }),
    refreshedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("titles_kind_tmdb_id_key").on(t.kind, t.tmdbId),
    index("titles_imdb_id_idx").on(t.imdbId),
    check("titles_imdb_id_check", sql`${t.imdbId} is null or ${t.imdbId} ~ '^tt[0-9]{7,10}$'`),
  ],
);

// IMDb's public score, kept only for the IMDb ids of stored Titles. A row with a null rating means
// IMDb was checked and has no rating for that id.
export const imdbRatings = pgTable(
  "imdb_ratings",
  {
    imdbId: text().primaryKey(),
    // Tenths of a point: 87 is 8.7.
    ratingTenths: smallint(),
    votes: integer(),
  },
  (t) => [
    check("imdb_ratings_imdb_id_check", sql`${t.imdbId} ~ '^tt[0-9]{7,10}$'`),
    check(
      "imdb_ratings_rating_tenths_check",
      sql`${t.ratingTenths} is null or ${t.ratingTenths} between 10 and 100`,
    ),
    check("imdb_ratings_votes_check", sql`${t.votes} is null or ${t.votes} >= 0`),
  ],
);

// One row (id 1) that makes sure only one ratings refresh runs at a time and remembers how the
// last one went.
export const imdbSync = pgTable(
  "imdb_sync",
  {
    id: smallint().primaryKey(),
    etag: text(),
    lockedUntil: timestamp({ withTimezone: true }).notNull().default(sql`'epoch'`),
    retryAfter: timestamp({ withTimezone: true }).notNull().default(sql`'epoch'`),
    lastSuccessAt: timestamp({ withTimezone: true }),
  },
  (t) => [check("imdb_sync_single_row_check", sql`${t.id} = 1`)],
);

// finished_at stays null while rows are still being added; one Owner has at most one open Import.
export const imports = pgTable(
  "imports",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    uniqueIndex("imports_user_id_open_key")
      .on(t.userId)
      .where(sql`${t.finishedAt} is null`),
  ],
);

export const entries = pgTable(
  "entries",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    titleId: uuid()
      .notNull()
      .references(() => titles.id, { onDelete: "restrict" }),
    status: entryStatus().notNull(),
    // Half-star units: 1 is half a star, 10 is five stars.
    ratingHalfStars: smallint(),
    note: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    statusChangedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    progressMovedAt: timestamp({ withTimezone: true }),
    // Lets "Undo this import" find the Entries an Import created; null for a Title saved by hand.
    importId: uuid().references(() => imports.id, { onDelete: "set null" }),
  },
  (t) => [
    unique("entries_user_id_title_id_key").on(t.userId, t.titleId),
    index("entries_user_id_status_idx").on(t.userId, t.status),
    index("entries_import_id_idx").on(t.importId),
    check(
      "entries_rating_half_stars_check",
      sql`${t.ratingHalfStars} is null or ${t.ratingHalfStars} between 1 and 10`,
    ),
    check("entries_note_length_check", sql`${t.note} is null or char_length(${t.note}) <= 1000`),
  ],
);

export const watches = pgTable(
  "watches",
  {
    id: uuid().primaryKey().defaultRandom(),
    entryId: uuid()
      .notNull()
      .references(() => entries.id, { onDelete: "cascade" }),
    // Null means "date unknown".
    watchedOn: date({ mode: "string" }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("watches_entry_id_idx").on(t.entryId)],
);

export const episodeProgress = pgTable(
  "episode_progress",
  {
    entryId: uuid()
      .notNull()
      .references(() => entries.id, { onDelete: "cascade" }),
    seasonNumber: integer().notNull(),
    episodeNumber: integer().notNull(),
    // Kept so a later re-map can follow Episodes that TMDB renumbers or recreates.
    tmdbEpisodeId: integer().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.entryId, t.seasonNumber, t.episodeNumber] })],
);
