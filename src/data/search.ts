import "server-only";
import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import type { TitleKind } from "@/domain/types";
import { db } from "@/db/client";
import { entries, titles } from "@/db/schema";
import { searchTitles as searchTmdb } from "@/lib/tmdb/cached";
import type { EntryRef, SearchItem } from "./dto";
import { requireOwner, type Owner } from "./session";

function idsOf(results: { kind: TitleKind; tmdbId: number }[], kind: TitleKind): number[] {
  return results.filter((result) => result.kind === kind).map((result) => result.tmdbId);
}

export type TimedSearch = { items: SearchItem[]; tmdbMs: number; dbMs: number };

export async function searchTitlesFor(owner: Owner, query: string): Promise<SearchItem[]> {
  return (await searchTitlesTimed(owner, query)).items;
}

/** Same answer as `searchTitlesFor`, plus how long TMDB and the database each took. */
export async function searchTitlesTimed(owner: Owner, query: string): Promise<TimedSearch> {
  const tmdbStart = performance.now();
  const results = await searchTmdb(query);
  const tmdbMs = performance.now() - tmdbStart;
  if (results.length === 0) return { items: [], tmdbMs, dbMs: 0 };

  const dbStart = performance.now();

  const movieIds = idsOf(results, "movie");
  const seriesIds = idsOf(results, "series");
  const rows = await db()
    .select({ id: entries.id, status: entries.status, kind: titles.kind, tmdbId: titles.tmdbId })
    .from(entries)
    .innerJoin(titles, eq(entries.titleId, titles.id))
    .where(
      and(
        eq(entries.userId, owner.id),
        or(
          movieIds.length > 0
            ? and(eq(titles.kind, "movie"), inArray(titles.tmdbId, movieIds))
            : undefined,
          seriesIds.length > 0
            ? and(eq(titles.kind, "series"), inArray(titles.tmdbId, seriesIds))
            : undefined,
        ),
      ),
    );

  const byTitle = new Map<string, EntryRef>(
    rows.map((row) => [`${row.kind}:${row.tmdbId}`, { id: row.id, status: row.status }]),
  );
  const dbMs = performance.now() - dbStart;
  const items = results.map((result) => ({
    kind: result.kind,
    tmdbId: result.tmdbId,
    name: result.name,
    year: result.year,
    posterPath: result.posterPath,
    entry: byTitle.get(`${result.kind}:${result.tmdbId}`) ?? null,
  }));
  return { items, tmdbMs, dbMs };
}

export const LIBRARY_MATCH_LIMIT = 5;
const MAX_LIBRARY_QUERY = 100;

// ILIKE treats % and _ as wildcards, so the text is escaped to match literally.
function likeEscape(text: string): string {
  return text.replace(/[\\%_]/g, (character) => `\\${character}`);
}

/** Up to 5 of the Owner's Titles whose name contains the text, names starting with it first. */
export async function searchLibraryFor(owner: Owner, query: string): Promise<SearchItem[]> {
  const text = query.trim().slice(0, MAX_LIBRARY_QUERY);
  if (text === "") return [];
  const escaped = likeEscape(text);
  const rows = await db()
    .select({
      id: entries.id,
      status: entries.status,
      kind: titles.kind,
      tmdbId: titles.tmdbId,
      name: titles.name,
      year: titles.year,
      posterPath: titles.posterPath,
    })
    .from(entries)
    .innerJoin(titles, eq(entries.titleId, titles.id))
    .where(and(eq(entries.userId, owner.id), sql`${titles.name} ILIKE ${`%${escaped}%`} ESCAPE '\\'`))
    .orderBy(
      sql`(${titles.name} ILIKE ${`${escaped}%`} ESCAPE '\\') DESC`,
      desc(sql`greatest(${entries.statusChangedAt}, ${entries.progressMovedAt})`),
      desc(entries.createdAt),
    )
    .limit(LIBRARY_MATCH_LIMIT);

  return rows.map((row) => ({
    kind: row.kind,
    tmdbId: row.tmdbId,
    name: row.name,
    year: row.year,
    posterPath: row.posterPath,
    entry: { id: row.id, status: row.status },
  }));
}

/** Movies and Series matching the text, each with the Owner's Entry when it is in the Library. */
export async function searchTitles(query: string): Promise<SearchItem[]> {
  const owner = await requireOwner();
  return searchTitlesFor(owner, query);
}

/** The Owner's own Titles matching the text. Needs only the database. */
export async function searchLibrary(query: string): Promise<SearchItem[]> {
  const owner = await requireOwner();
  return searchLibraryFor(owner, query);
}
