import "server-only";
import { randomUUID } from "node:crypto";
import { and, eq, isNotNull, notExists, sql } from "drizzle-orm";
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

// A stored Title whose IMDb id has no rating row yet: only a full read can give it one.
const WANTED_WITHOUT_RATING = sql`exists (
  select 1 from titles t
  where t.imdb_id is not null
    and not exists (select 1 from imdb_ratings r where r.imdb_id = t.imdb_id)
)`;

type Claim = { etag: string | null; recent_full_read: boolean };

// One statement decides whether this run starts, so two requests cannot both pass: only the one
// that moves locked_until sees a row come back. Missing ratings alone may start a run only when the
// whole file was not read in the last two minutes, so a burst of saves cannot download it per request.
async function claimRun(runId: string): Promise<Claim | null> {
  await db().insert(imdbSync).values({ id: 1 }).onConflictDoNothing();
  const result = await db().execute<Claim>(sql`
    update imdb_sync
    set locked_until = now() + interval '5 minutes', run_id = ${runId}::uuid
    where id = 1
      and locked_until < now()
      and retry_after < now()
      and (
        last_success_at is null
        or last_success_at < now() - interval '20 hours'
        or exists (select 1 from titles t where t.imdb_checked_at is null)
        or (
          ${WANTED_WITHOUT_RATING}
          and (last_full_read_at is null or last_full_read_at < now() - interval '2 minutes')
        )
      )
    returning
      etag,
      (last_full_read_at is not null and last_full_read_at >= now() - interval '2 minutes')
        as recent_full_read
  `);
  return result.rows[0] ?? null;
}

async function anyWantedWithoutRating(): Promise<boolean> {
  const result = await db().execute<{ missing: boolean }>(sql`select ${WANTED_WITHOUT_RATING} as missing`);
  return result.rows[0]?.missing === true;
}

async function wantedIds(): Promise<Set<string>> {
  const rows = await db()
    .selectDistinct({ imdbId: titles.imdbId })
    .from(titles)
    .where(isNotNull(titles.imdbId));
  return new Set(rows.flatMap((row) => (row.imdbId === null ? [] : [row.imdbId])));
}

async function storeRatings(
  runId: string,
  wanted: ReadonlySet<string>,
  ratings: ReadonlyMap<string, ImdbRating>,
  etag: string | null,
  retryLater: boolean,
): Promise<void> {
  const rows = [...wanted].map((imdbId) => {
    const found = ratings.get(imdbId);
    return { imdbId, ratingTenths: found?.ratingTenths ?? null, votes: found?.votes ?? null };
  });

  // The upserts are safe to repeat, so a run that lost its lease may still write them; only the
  // sync state below is tied to the lease.
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
    await finishRun(tx, runId, { etag, retryLater, fullRead: true });
  });
}

type Executor = Pick<ReturnType<typeof db>, "update">;

const ownedBy = (runId: string) => and(eq(imdbSync.id, 1), eq(imdbSync.runId, runId));

async function finishRun(
  executor: Executor,
  runId: string,
  outcome: { etag?: string | null; retryLater: boolean; fullRead?: boolean },
): Promise<void> {
  await executor
    .update(imdbSync)
    .set({
      ...(outcome.etag === undefined ? {} : { etag: outcome.etag }),
      ...(outcome.fullRead ? { lastFullReadAt: sql`now()` } : {}),
      lastSuccessAt: sql`now()`,
      lockedUntil: sql`now()`,
      // Titles still waiting for an IMDb id would otherwise start a run on every request.
      ...(outcome.retryLater ? { retryAfter: sql`now() + interval '30 minutes'` } : {}),
    })
    .where(ownedBy(runId));
}

// Ends a run that read nothing and proved nothing, so the next request may start again.
async function releaseLease(runId: string, retryLater: boolean): Promise<void> {
  await db()
    .update(imdbSync)
    .set({
      lockedUntil: sql`now()`,
      ...(retryLater ? { retryAfter: sql`now() + interval '30 minutes'` } : {}),
    })
    .where(ownedBy(runId));
}

async function releaseAfterFailure(runId: string): Promise<void> {
  try {
    await releaseLease(runId, true);
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
  const runId = randomUUID();
  let claimed = false;
  try {
    const claim = await claimRun(runId);
    if (claim === null) return;
    claimed = true;

    const { complete } = await backfillImdbIds();
    const wanted = await wantedIds();
    if (wanted.size === 0) {
      await finishRun(db(), runId, { retryLater: !complete });
      return;
    }

    // Decided after the backfill, which is what gives older Titles their ids.
    const missing = await anyWantedWithoutRating();
    if (missing && claim.recent_full_read) {
      await releaseLease(runId, !complete);
      return;
    }

    const result = await readImdbRatings(wanted, { ...options, etag: missing ? null : claim.etag });
    if (result.kind === "unchanged") {
      await finishRun(db(), runId, { retryLater: !complete });
      return;
    }
    await storeRatings(runId, wanted, result.ratings, result.etag, !complete);
  } catch (error) {
    if (claimed) await releaseAfterFailure(runId);
    logFailure(error);
  }
}
