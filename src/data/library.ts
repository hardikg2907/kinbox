import "server-only";
import { and, asc, count, desc, eq, inArray, sql, type SQL } from "drizzle-orm";
import { after } from "next/server";
import { z } from "zod";
import { episodeKey } from "@/domain/series";
import { STATUSES, type Status } from "@/domain/types";
import { db } from "@/db/client";
import { entries, episodeProgress, titles, watches } from "@/db/schema";
import { TmdbUnavailableError } from "@/lib/tmdb/real";
import type { CardProgress, KindFilter, LibraryCard, LibraryView } from "./dto";
import { statusSchema } from "./entries";
import { logUnexpected } from "./errors";
import { cardProgress, loadSeriesEpisodes } from "./series";
import { requireOwner, type Owner } from "./session";
import { refreshStaleTitlesFor } from "./titles";
import { getToday } from "./today";

const libraryInput = z.strictObject({
  tab: statusSchema,
  kind: z.enum(["all", "movie", "series"]),
});

export type LibraryInput = { tab: Status; kind: KindFilter };

function orderFor(tab: Status, latestWatchOn: SQL.Aliased<string | null>): SQL[] {
  switch (tab) {
    case "to_watch":
      return [desc(entries.createdAt), asc(entries.id)];
    case "watching":
      return [
        sql`coalesce(${entries.progressMovedAt}, ${entries.statusChangedAt}) desc`,
        desc(entries.createdAt),
        asc(entries.id),
      ];
    case "watched":
      return [
        sql`${latestWatchOn} desc nulls last`,
        desc(entries.statusChangedAt),
        asc(entries.id),
      ];
    case "dropped":
      return [desc(entries.statusChangedAt), asc(entries.id)];
  }
}

async function loadCounts(ownerId: string, kindFilter: SQL | undefined): Promise<Record<Status, number>> {
  const rows = await db()
    .select({ status: entries.status, n: count() })
    .from(entries)
    .innerJoin(titles, eq(entries.titleId, titles.id))
    .where(and(eq(entries.userId, ownerId), kindFilter))
    .groupBy(entries.status);
  const counts = Object.fromEntries(STATUSES.map((status) => [status, 0])) as Record<Status, number>;
  for (const row of rows) counts[row.status] = row.n;
  return counts;
}

async function loadCards(ownerId: string, tab: Status, kindFilter: SQL | undefined) {
  const latest = db()
    .select({
      entryId: watches.entryId,
      latestWatchOn: sql<string | null>`max(${watches.watchedOn})`.as("latest_watch_on"),
    })
    .from(watches)
    .innerJoin(entries, eq(watches.entryId, entries.id))
    .where(eq(entries.userId, ownerId))
    .groupBy(watches.entryId)
    .as("latest_watch");

  return db()
    .select({
      entryId: entries.id,
      status: entries.status,
      kind: titles.kind,
      tmdbId: titles.tmdbId,
      name: titles.name,
      year: titles.year,
      posterPath: titles.posterPath,
      latestWatchOn: latest.latestWatchOn,
    })
    .from(entries)
    .innerJoin(titles, eq(entries.titleId, titles.id))
    .leftJoin(latest, eq(latest.entryId, entries.id))
    .where(and(eq(entries.userId, ownerId), eq(entries.status, tab), kindFilter))
    .orderBy(...orderFor(tab, latest.latestWatchOn));
}

/** Every tick of the given Entries, in one query, keyed by Entry id. */
async function loadTicksByEntry(ownerId: string, entryIds: string[]): Promise<Map<string, Set<string>>> {
  const byEntry = new Map<string, Set<string>>();
  if (entryIds.length === 0) return byEntry;
  const rows = await db()
    .select({
      entryId: episodeProgress.entryId,
      seasonNumber: episodeProgress.seasonNumber,
      episodeNumber: episodeProgress.episodeNumber,
    })
    .from(episodeProgress)
    .innerJoin(entries, eq(episodeProgress.entryId, entries.id))
    .where(and(eq(entries.userId, ownerId), inArray(episodeProgress.entryId, entryIds)));
  for (const row of rows) {
    const keys = byEntry.get(row.entryId) ?? new Set<string>();
    keys.add(episodeKey(row));
    byEntry.set(row.entryId, keys);
  }
  return byEntry;
}

// One Series that TMDB cannot serve must not take the whole Library down.
async function safeCardProgress(
  tmdbId: number,
  watched: ReadonlySet<string>,
  today: string,
): Promise<CardProgress | null> {
  try {
    const series = await loadSeriesEpisodes(tmdbId);
    return cardProgress(series.episodes, watched, today);
  } catch (error) {
    if (!(error instanceof TmdbUnavailableError)) logUnexpected(error, "getLibrary.progress");
    return null;
  }
}

export async function getLibraryFor(owner: Owner, input: LibraryInput): Promise<LibraryView> {
  const { tab, kind } = libraryInput.parse(input);
  const kindFilter = kind === "all" ? undefined : eq(titles.kind, kind);
  after(() => refreshStaleTitlesFor(owner.id));

  const [counts, rows] = await Promise.all([
    loadCounts(owner.id, kindFilter),
    loadCards(owner.id, tab, kindFilter),
  ]);

  const watchingSeries =
    tab === "watching" ? rows.filter((row) => row.kind === "series") : [];
  const progressById = new Map<string, CardProgress | null>();
  if (watchingSeries.length > 0) {
    const [ticks, today] = await Promise.all([
      loadTicksByEntry(
        owner.id,
        watchingSeries.map((row) => row.entryId),
      ),
      getToday(),
    ]);
    const progress = await Promise.all(
      watchingSeries.map((row) =>
        safeCardProgress(row.tmdbId, ticks.get(row.entryId) ?? new Set(), today),
      ),
    );
    watchingSeries.forEach((row, index) => progressById.set(row.entryId, progress[index] ?? null));
  }

  const cards: LibraryCard[] = rows.map((row) => ({
    entryId: row.entryId,
    kind: row.kind,
    name: row.name,
    year: row.year,
    posterPath: row.posterPath,
    status: row.status,
    progress: progressById.get(row.entryId) ?? null,
    latestWatchOn: tab === "watched" ? row.latestWatchOn : null,
  }));
  return { tab, kind, counts, cards };
}

/** One Library tab with counts per Status; counts honour the kind filter. */
export async function getLibrary(input: LibraryInput): Promise<LibraryView> {
  const owner = await requireOwner();
  return getLibraryFor(owner, input);
}
