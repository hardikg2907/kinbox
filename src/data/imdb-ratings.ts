import "server-only";
import { eq, isNotNull, notExists, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { imdbRatings, imdbSync, titles } from "@/db/schema";
import {
  ImdbFileError,
  readImdbRatings,
  type ImdbRating,
  type ReadImdbRatingsOptions,
} from "@/lib/imdb/ratings-file";
import { logUnexpected } from "./errors";
import { backfillImdbIds } from "./titles";

// Keeps each statement far below Postgres's limit on bound parameters.
const UPSERT_BATCH = 5000;

export type SyncImdbRatingsOptions = Pick<ReadImdbRatingsOptions, "fetch" | "minRows">;

// A Title whose IMDb id was never looked up, or whose id has no rating row yet, forces a full
// read: an unchanged file cannot give it a rating.
const SOMETHING_MISSING = sql`(
  exists (select 1 from titles t where t.imdb_checked_at is null)
  or exists (
    select 1 from titles t
    where t.imdb_id is not null
      and not exists (select 1 from imdb_ratings r where r.imdb_id = t.imdb_id)
  )
)`;

type Claim = { etag: string | null; has_missing: boolean };

// One statement decides whether this run starts, so two requests cannot both pass: only the one
// that moves locked_until sees a row come back.
async function claimRun(): Promise<Claim | null> {
  await db().insert(imdbSync).values({ id: 1 }).onConflictDoNothing();
  const result = await db().execute<Claim>(sql`
    update imdb_sync
    set locked_until = now() + interval '5 minutes'
    where id = 1
      and locked_until < now()
      and retry_after < now()
      and (
        last_success_at is null
        or last_success_at < now() - interval '20 hours'
        or ${SOMETHING_MISSING}
      )
    returning etag, ${SOMETHING_MISSING} as has_missing
  `);
  return result.rows[0] ?? null;
}

async function wantedIds(): Promise<Set<string>> {
  const rows = await db()
    .selectDistinct({ imdbId: titles.imdbId })
    .from(titles)
    .where(isNotNull(titles.imdbId));
  return new Set(rows.flatMap((row) => (row.imdbId === null ? [] : [row.imdbId])));
}

async function storeRatings(
  wanted: ReadonlySet<string>,
  ratings: ReadonlyMap<string, ImdbRating>,
  etag: string | null,
  retryLater: boolean,
): Promise<void> {
  const rows = [...wanted].map((imdbId) => {
    const found = ratings.get(imdbId);
    return { imdbId, ratingTenths: found?.ratingTenths ?? null, votes: found?.votes ?? null };
  });

  await db().transaction(async (tx) => {
    for (let start = 0; start < rows.length; start += UPSERT_BATCH) {
      await tx
        .insert(imdbRatings)
        .values(rows.slice(start, start + UPSERT_BATCH))
        .onConflictDoUpdate({
          target: imdbRatings.imdbId,
          set: {
            ratingTenths: sql`excluded.rating_tenths`,
            votes: sql`excluded.votes`,
          },
          // "Is distinct from" treats null as a value, so a rating that appears or vanishes is
          // written, while a row that did not change is not rewritten.
          setWhere: sql`(${imdbRatings.ratingTenths}, ${imdbRatings.votes}) is distinct from (excluded.rating_tenths, excluded.votes)`,
        });
    }
    await tx
      .delete(imdbRatings)
      .where(notExists(tx.select({ one: sql`1` }).from(titles).where(eq(titles.imdbId, imdbRatings.imdbId))));
    await finishRun(tx, { etag, retryLater });
  });
}

type Executor = Pick<ReturnType<typeof db>, "update">;

async function finishRun(
  executor: Executor,
  outcome: { etag: string | null; retryLater: boolean; keepEtag?: boolean },
): Promise<void> {
  await executor
    .update(imdbSync)
    .set({
      ...(outcome.keepEtag ? {} : { etag: outcome.etag }),
      lastSuccessAt: sql`now()`,
      lockedUntil: sql`now()`,
      // Titles still waiting for an IMDb id would otherwise start a full read on every request.
      ...(outcome.retryLater ? { retryAfter: sql`now() + interval '30 minutes'` } : {}),
    })
    .where(eq(imdbSync.id, 1));
}

async function releaseAfterFailure(): Promise<void> {
  try {
    await db().execute(
      sql`update imdb_sync set locked_until = now(), retry_after = now() + interval '30 minutes' where id = 1`,
    );
  } catch (error) {
    logUnexpected(error, "syncImdbRatings.release");
  }
}

function logFailure(error: unknown): void {
  if (error instanceof ImdbFileError) {
    console.error(`[syncImdbRatings] IMDb file unusable (${error.reason})`);
  } else {
    logUnexpected(error, "syncImdbRatings");
  }
}

/**
 * Refreshes the stored IMDb ratings when the last refresh is over 20 hours old or a stored Title
 * has no rating row yet. One database row lets one run at a time proceed. Never throws: it runs
 * after the response.
 */
export async function syncImdbRatingsIfDue(options: SyncImdbRatingsOptions = {}): Promise<void> {
  let claimed = false;
  try {
    const claim = await claimRun();
    if (claim === null) return;
    claimed = true;

    const { complete } = await backfillImdbIds();
    const wanted = await wantedIds();
    if (wanted.size === 0) {
      await finishRun(db(), { etag: null, retryLater: !complete, keepEtag: true });
      return;
    }

    const result = await readImdbRatings(wanted, {
      ...options,
      etag: claim.has_missing ? null : claim.etag,
    });
    if (result.kind === "unchanged") {
      await finishRun(db(), { etag: null, retryLater: !complete, keepEtag: true });
      return;
    }
    await storeRatings(wanted, result.ratings, result.etag, !complete);
  } catch (error) {
    if (claimed) await releaseAfterFailure();
    logFailure(error);
  }
}
