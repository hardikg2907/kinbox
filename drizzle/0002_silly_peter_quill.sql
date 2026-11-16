CREATE TABLE "imdb_ratings" (
	"imdb_id" text PRIMARY KEY NOT NULL,
	"rating_tenths" smallint,
	"votes" integer,
	CONSTRAINT "imdb_ratings_imdb_id_check" CHECK ("imdb_ratings"."imdb_id" ~ '^tt[0-9]{7,10}$'),
	CONSTRAINT "imdb_ratings_rating_tenths_check" CHECK ("imdb_ratings"."rating_tenths" is null or "imdb_ratings"."rating_tenths" between 10 and 100),
	CONSTRAINT "imdb_ratings_votes_check" CHECK ("imdb_ratings"."votes" is null or "imdb_ratings"."votes" >= 0)
);
--> statement-breakpoint
CREATE TABLE "imdb_sync" (
	"id" smallint PRIMARY KEY NOT NULL,
	"etag" text,
	"locked_until" timestamp with time zone DEFAULT 'epoch' NOT NULL,
	"retry_after" timestamp with time zone DEFAULT 'epoch' NOT NULL,
	"last_success_at" timestamp with time zone,
	CONSTRAINT "imdb_sync_single_row_check" CHECK ("imdb_sync"."id" = 1)
);
--> statement-breakpoint
ALTER TABLE "titles" ADD COLUMN "imdb_id" text;--> statement-breakpoint
ALTER TABLE "titles" ADD COLUMN "imdb_checked_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "titles_imdb_id_idx" ON "titles" USING btree ("imdb_id");--> statement-breakpoint
ALTER TABLE "titles" ADD CONSTRAINT "titles_imdb_id_check" CHECK ("titles"."imdb_id" is null or "titles"."imdb_id" ~ '^tt[0-9]{7,10}$');--> statement-breakpoint
INSERT INTO "imdb_sync" ("id") VALUES (1) ON CONFLICT DO NOTHING;
