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
    refreshedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("titles_kind_tmdb_id_key").on(t.kind, t.tmdbId)],
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
  },
  (t) => [
    unique("entries_user_id_title_id_key").on(t.userId, t.titleId),
    index("entries_user_id_status_idx").on(t.userId, t.status),
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
