import "server-only";
import { and, eq, inArray, or } from "drizzle-orm";
import type { TitleKind } from "@/domain/types";
import { db } from "@/db/client";
import { entries, titles } from "@/db/schema";
import { searchTitles as searchTmdb } from "@/lib/tmdb/cached";
import type { EntryRef, SearchItem } from "./dto";
import { requireOwner, type Owner } from "./session";

function idsOf(results: { kind: TitleKind; tmdbId: number }[], kind: TitleKind): number[] {
  return results.filter((result) => result.kind === kind).map((result) => result.tmdbId);
}

export async function searchTitlesFor(owner: Owner, query: string): Promise<SearchItem[]> {
  const results = await searchTmdb(query);
  if (results.length === 0) return [];

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
  return results.map((result) => ({
    kind: result.kind,
    tmdbId: result.tmdbId,
    name: result.name,
    year: result.year,
    posterPath: result.posterPath,
    entry: byTitle.get(`${result.kind}:${result.tmdbId}`) ?? null,
  }));
}

/** Movies and Series matching the text, each with the Owner's Entry when it is in the Library. */
export async function searchTitles(query: string): Promise<SearchItem[]> {
  const owner = await requireOwner();
  return searchTitlesFor(owner, query);
}
