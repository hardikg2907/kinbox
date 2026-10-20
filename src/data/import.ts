import "server-only";
import { and, eq, isNotNull, isNull, ne, notExists, or, sql } from "drizzle-orm";
import { z } from "zod";
import { airedNumberedEpisodes, isFinished } from "@/domain/series";
import { importNeedsAiredEpisodes, statusOnImport, type ImportChange } from "@/domain/status";
import type { Episode, IsoDate } from "@/domain/types";
import { db } from "@/db/client";
import { entries, imports, user, watches } from "@/db/schema";
import { createLimit } from "@/lib/limit";
import { TmdbUnavailableError } from "@/lib/tmdb/real";
import type { ImportRowResult } from "./dto";
import { idSchema, insertNewEntry, kindSchema, statusSchema, tmdbIdSchema } from "./entries";
import { logUnexpected, MESSAGES, UserError } from "./errors";
import { loadSeriesEpisodes, type Tx } from "./series";
import type { Owner } from "./session";
import { ensureTitle } from "./titles";
import { getToday } from "./today";

// Keeps one request's burst of TMDB calls small; repeats come from the cache.
const LOADS_AT_ONCE = 4;

export const startImportInput = z.strictObject({});
export const addImportRowsInput = z.strictObject({
  importId: idSchema,
  rows: z
    .array(z.strictObject({ kind: kindSchema, tmdbId: tmdbIdSchema, intent: statusSchema }))
    .min(1)
    .max(5),
});
export const importIdInput = z.strictObject({ importId: idSchema });

export type AddImportRowsInput = z.infer<typeof addImportRowsInput>;
export type ImportIdInput = z.infer<typeof importIdInput>;
type ImportRow = AddImportRowsInput["rows"][number];

/** Opens a new Import for the Owner and closes the one still open, if any. */
export async function startImport(owner: Owner): Promise<{ importId: string }> {
  return db().transaction(async (tx) => {
    // Two quick starts then run one after the other, so the second closes the first instead of
    // failing on the one-open-Import index. "no key update" still lets inserts that reference
    // the Owner go ahead.
    await tx.select({ id: user.id }).from(user).where(eq(user.id, owner.id)).for("no key update");
    await tx
      .update(imports)
      .set({ finishedAt: sql`now()` })
      .where(and(eq(imports.userId, owner.id), isNull(imports.finishedAt)));
    const [created] = await tx
      .insert(imports)
      .values({ userId: owner.id })
      .returning({ id: imports.id });
    if (!created) throw new Error("Import insert returned no row");
    return { importId: created.id };
  });
}

async function requireOpenImport(owner: Owner, importId: string): Promise<void> {
  const [open] = await db()
    .select({ id: imports.id })
    .from(imports)
    .where(and(eq(imports.id, importId), eq(imports.userId, owner.id), isNull(imports.finishedAt)));
  // Another Owner's Import gets the same answer as a closed one, so an id never shows it exists.
  if (!open) throw new UserError(MESSAGES.importFinished);
}

type LoadedRow = { titleId: string; change: ImportChange; ticks: Episode[] };

async function loadRow(row: ImportRow, today: IsoDate): Promise<LoadedRow> {
  const { titleId, details } = await ensureTitle(row.kind, row.tmdbId);
  let aired: Episode[] | null = null;
  if (importNeedsAiredEpisodes(row.intent, details, today)) {
    const series = await loadSeriesEpisodes(details.tmdbId);
    aired = airedNumberedEpisodes(series.episodes, today);
  }
  const change = statusOnImport(
    row.intent,
    details.kind === "movie"
      ? { kind: "movie", releaseDate: details.releaseDate }
      : {
          kind: "series",
          releaseDate: details.releaseDate,
          finished: isFinished(details.status),
          airedEpisodeCount: aired?.length ?? null,
        },
    today,
  );
  return { titleId, change, ticks: change.tickAired ? (aired ?? []) : [] };
}

// Only the kind of failure is logged: a row's Title or id would show what the Owner pasted.
function logRowFailure(error: unknown): void {
  if (error instanceof TmdbUnavailableError) {
    console.error("[addImportRows] TMDB unavailable", { status: error.status });
  } else {
    logUnexpected(error, "addImportRows");
  }
}

// The check in addImportRows ran before the slow loads, so each row checks again in its own
// transaction. The share lock waits for an Undo, finish or newer start that is closing the
// Import, then sees it closed. The entries foreign key alone would not wait: closing leaves the
// Import's key alone.
async function importStillOpen(tx: Tx, owner: Owner, importId: string): Promise<boolean> {
  const [open] = await tx
    .select({ id: imports.id })
    .from(imports)
    .where(and(eq(imports.id, importId), eq(imports.userId, owner.id), isNull(imports.finishedAt)))
    .for("share");
  return open !== undefined;
}

async function writeRow(
  owner: Owner,
  importId: string,
  row: ImportRow,
  loaded: LoadedRow,
): Promise<ImportRowResult> {
  const { kind, tmdbId } = row;
  try {
    const saved = await db().transaction(async (tx) =>
      (await importStillOpen(tx, owner, importId))
        ? insertNewEntry(tx, owner.id, { ...loaded, importId })
        : null,
    );
    if (saved === null) return { kind, tmdbId, result: "failed" };
    if (!saved.created) return { kind, tmdbId, result: "already" };
    return { kind, tmdbId, result: "added", status: saved.status, caughtUp: loaded.change.caughtUp };
  } catch (error) {
    logRowFailure(error);
    return { kind, tmdbId, result: "failed" };
  }
}

/**
 * Adds each row's Title to the Library under the Owner's open Import. Each row stands alone:
 * one that fails is reported and the rest still go in. A row whose turn comes after the Import
 * closed fails too. A Title already in the Library is left as it was, so undoing the Import can
 * never remove or change it.
 */
export async function addImportRows(
  owner: Owner,
  input: AddImportRowsInput,
): Promise<ImportRowResult[]> {
  const [, today] = await Promise.all([requireOpenImport(owner, input.importId), getToday()]);

  const limit = createLimit(LOADS_AT_ONCE);
  const loaded = await Promise.all(
    input.rows.map((row) =>
      limit(() => loadRow(row, today)).then(
        (prepared) => ({ row, prepared }),
        (error: unknown) => {
          logRowFailure(error);
          return { row, prepared: null };
        },
      ),
    ),
  );

  // One row after another, in the order given: the Library lists the newest first, and the
  // browser sends the paste from the bottom up, so the Library then reads like the paste.
  const results: ImportRowResult[] = [];
  for (const { row, prepared } of loaded) {
    results.push(
      prepared === null
        ? { kind: row.kind, tmdbId: row.tmdbId, result: "failed" }
        : await writeRow(owner, input.importId, row, prepared),
    );
  }
  return results;
}

/**
 * Closes the Import and removes the Entries it added that the Owner has not changed since,
 * with their Watches and ticks. Title snapshots stay. An unknown id, or another Owner's, changes
 * nothing and reports nothing, so an id never shows it exists. A second Undo removes nothing.
 */
export async function undoImport(
  owner: Owner,
  input: ImportIdInput,
): Promise<{ removed: number; kept: number }> {
  return db().transaction(async (tx) => {
    // Rows being added hold a share lock on the Import, so this waits for them, and every row
    // that comes after it sees the Import closed.
    const [locked] = await tx
      .select({ id: imports.id })
      .from(imports)
      .where(and(eq(imports.id, input.importId), eq(imports.userId, owner.id)))
      .for("update");
    if (!locked) return { removed: 0, kept: 0 };

    await tx
      .update(imports)
      .set({ finishedAt: sql`now()` })
      .where(and(eq(imports.id, locked.id), isNull(imports.finishedAt)));

    const fromThisImport = and(eq(entries.userId, owner.id), eq(entries.importId, locked.id));
    // An import writes an Entry, its Watch and its ticks under one now(), and every later change
    // moves a stamp, adds a Watch, dates a Watch, or sets a Rating or Note. The stamps are compared
    // in Postgres: a JS Date drops the microseconds, so two different times could look equal.
    const changedWatch = tx
      .select({ id: watches.id })
      .from(watches)
      .where(
        and(
          eq(watches.entryId, entries.id),
          or(ne(watches.createdAt, entries.createdAt), isNotNull(watches.watchedOn)),
        ),
      );
    const removed = await tx
      .delete(entries)
      .where(
        and(
          fromThisImport,
          eq(entries.statusChangedAt, entries.createdAt),
          or(isNull(entries.progressMovedAt), eq(entries.progressMovedAt, entries.createdAt)),
          isNull(entries.ratingHalfStars),
          isNull(entries.note),
          notExists(changedWatch),
        ),
      )
      .returning({ id: entries.id });
    const kept = await tx.$count(entries, fromThisImport);
    return { removed: removed.length, kept };
  });
}

/** Closes the Owner's open Import. A closed or unknown id changes nothing, so a retry is safe. */
export async function finishImport(owner: Owner, input: ImportIdInput): Promise<null> {
  await db()
    .update(imports)
    .set({ finishedAt: sql`now()` })
    .where(
      and(eq(imports.id, input.importId), eq(imports.userId, owner.id), isNull(imports.finishedAt)),
    );
  return null;
}
