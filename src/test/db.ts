import { asc, eq } from "drizzle-orm";
import type { Status, TitleKind } from "@/domain/types";
import { db } from "@/db/client";
import {
  account,
  entries,
  episodeProgress,
  imports,
  session,
  titles,
  user,
  watches,
} from "@/db/schema";
import type { Owner } from "@/data/session";
import { OWNER_A, OWNER_B } from "./mocks";

/** Database tests wipe tables, so they refuse to run anywhere but the test database. */
export function assertTestDatabase(): void {
  if (!(process.env.DATABASE_URL ?? "").endsWith("/kinbox_test")) {
    throw new Error("Database tests run only against the kinbox_test database.");
  }
}

/** Empties every table the data layer touches and adds Owner A and Owner B. */
export async function resetDatabase(): Promise<void> {
  assertTestDatabase();
  const database = db();
  await database.delete(episodeProgress);
  await database.delete(watches);
  await database.delete(entries);
  await database.delete(imports);
  await database.delete(titles);
  await database.delete(session);
  await database.delete(account);
  await database.delete(user);
  await database.insert(user).values(
    [OWNER_A, OWNER_B].map((owner) => ({
      id: owner.id,
      name: owner.name,
      email: `${owner.id}@example.test`,
    })),
  );
}

let fakeTmdbId = 900_000;

/** Adds a Title and an Entry straight to the database, for order and count tests. */
export async function insertEntry(options: {
  owner: Owner;
  status: Status;
  kind?: TitleKind;
  tmdbId?: number;
  name?: string;
  createdAt?: Date;
  statusChangedAt?: Date;
  progressMovedAt?: Date | null;
}): Promise<{ entryId: string; titleId: string }> {
  const kind = options.kind ?? "movie";
  const tmdbId = options.tmdbId ?? fakeTmdbId++;
  const [title] = await db()
    .insert(titles)
    .values({ kind, tmdbId, name: options.name ?? `Title ${tmdbId}` })
    .onConflictDoUpdate({ target: [titles.kind, titles.tmdbId], set: { kind } })
    .returning({ id: titles.id });
  const now = new Date();
  const [entry] = await db()
    .insert(entries)
    .values({
      userId: options.owner.id,
      titleId: title!.id,
      status: options.status,
      createdAt: options.createdAt ?? now,
      statusChangedAt: options.statusChangedAt ?? now,
      progressMovedAt: options.progressMovedAt ?? null,
    })
    .returning({ id: entries.id });
  return { entryId: entry!.id, titleId: title!.id };
}

export async function entryRow(entryId: string) {
  const [row] = await db().select().from(entries).where(eq(entries.id, entryId));
  return row ?? null;
}

export async function watchRows(entryId: string) {
  return db()
    .select({ id: watches.id, watchedOn: watches.watchedOn })
    .from(watches)
    .where(eq(watches.entryId, entryId))
    .orderBy(asc(watches.createdAt));
}

export async function tickKeys(entryId: string): Promise<string[]> {
  const rows = await db()
    .select({ s: episodeProgress.seasonNumber, e: episodeProgress.episodeNumber })
    .from(episodeProgress)
    .where(eq(episodeProgress.entryId, entryId))
    .orderBy(asc(episodeProgress.seasonNumber), asc(episodeProgress.episodeNumber));
  return rows.map((row) => `${row.s}:${row.e}`);
}

export async function setEntryTimes(
  entryId: string,
  times: { createdAt?: Date; statusChangedAt?: Date; progressMovedAt?: Date | null },
): Promise<void> {
  await db().update(entries).set(times).where(eq(entries.id, entryId));
}
