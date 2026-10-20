import "server-only";
import { and, eq, inArray, or } from "drizzle-orm";
import { z } from "zod";
import { MAX_IMPORT_LINES, MAX_QUERY_CHARACTERS } from "@/domain/import-lines";
import { matchLine } from "@/domain/import-match";
import type { TitleKind } from "@/domain/types";
import { db } from "@/db/client";
import { entries, titles } from "@/db/schema";
import { createLimit } from "@/lib/limit";
import { searchTitles } from "@/lib/tmdb/cached";
import { TmdbUnavailableError } from "@/lib/tmdb/real";
import type { SearchResult } from "@/lib/tmdb/types";
import type { ImportLineMatch, ImportMatches, ImportMatchResult } from "./dto";
import { kindSchema } from "./entries";
import type { Owner } from "./session";

export const MAX_LINES_PER_MATCH = 10;
// TMDB allows about 40 requests a second; one request never sends more than this at once.
const MAX_PARALLEL_SEARCHES = 4;
// A cheap bound in UTF-16 units, checked before the code points are counted.
const MAX_SEARCH_TEXT_UNITS = 400;

const searchTextSchema = z
  .string()
  .max(MAX_SEARCH_TEXT_UNITS, { abort: true })
  .trim()
  // Counted by code point, as the browser's reader caps it, so an emoji is one character.
  .refine((text) => {
    const length = Array.from(text).length;
    return length >= 1 && length <= MAX_QUERY_CHARACTERS;
  });

export const importMatchInput = z.strictObject({
  lines: z
    .array(
      z.strictObject({
        id: z.int().min(0).max(MAX_IMPORT_LINES - 1),
        query: searchTextSchema,
        altQuery: searchTextSchema.optional(),
        year: z.int().min(1800).max(2200).optional(),
        kind: kindSchema.optional(),
        several: z.boolean(),
      }),
    )
    .min(1)
    .max(MAX_LINES_PER_MATCH),
});

export type ImportMatchInput = z.infer<typeof importMatchInput>;
type MatchInputLine = ImportMatchInput["lines"][number];

type MatchedLine = { id: number; result: ImportMatchResult; titles: SearchResult[]; status?: number | null };

/**
 * Finds a Match for each Import line, in the order given. A line whose TMDB search fails comes
 * back as "error" and the other lines still return; any other failure fails the whole call.
 */
export async function matchImportLines(owner: Owner, lines: readonly MatchInputLine[]): Promise<ImportMatches> {
  // One limiter per call, so it bounds this request's searches and no one else's.
  const limit = createLimit(MAX_PARALLEL_SEARCHES);
  const search = (text: string) => limit(() => searchTitles(text));

  const matched = await Promise.all(lines.map((line) => matchOne(line, search)));
  const failed = matched.filter((line) => line.result === "error");
  if (failed.length > 0) {
    console.error("[import/match] TMDB unavailable", { lines: failed.length, status: failed[0].status ?? null });
  }

  const inLibrary = await libraryKeys(owner, matched.flatMap((line) => line.titles));
  return {
    lines: matched.map(
      (line): ImportLineMatch => ({
        id: line.id,
        result: line.result,
        candidates: line.titles.map((title) => ({
          kind: title.kind,
          tmdbId: title.tmdbId,
          name: title.name,
          year: title.year,
          posterPath: title.posterPath,
          inLibrary: inLibrary.has(titleKey(title.kind, title.tmdbId)),
        })),
      }),
    ),
  };
}

async function matchOne(
  line: MatchInputLine,
  search: (text: string) => Promise<SearchResult[]>,
): Promise<MatchedLine> {
  try {
    const match = await matchLine(line, search);
    return { id: line.id, result: match.result, titles: match.candidates.map((candidate) => candidate.title) };
  } catch (error) {
    if (error instanceof TmdbUnavailableError) {
      return { id: line.id, result: "error", titles: [], status: error.status };
    }
    throw error;
  }
}

function titleKey(kind: TitleKind, tmdbId: number): string {
  return `${kind}:${tmdbId}`;
}

function idsOf(results: readonly SearchResult[], kind: TitleKind): number[] {
  return [...new Set(results.filter((result) => result.kind === kind).map((result) => result.tmdbId))];
}

/** One read for every candidate in the request: which of them the Owner already has. */
async function libraryKeys(owner: Owner, results: readonly SearchResult[]): Promise<Set<string>> {
  const movieIds = idsOf(results, "movie");
  const seriesIds = idsOf(results, "series");
  if (movieIds.length === 0 && seriesIds.length === 0) return new Set();

  const rows = await db()
    .select({ kind: titles.kind, tmdbId: titles.tmdbId })
    .from(entries)
    .innerJoin(titles, eq(entries.titleId, titles.id))
    .where(
      and(
        eq(entries.userId, owner.id),
        or(
          movieIds.length > 0 ? and(eq(titles.kind, "movie"), inArray(titles.tmdbId, movieIds)) : undefined,
          seriesIds.length > 0 ? and(eq(titles.kind, "series"), inArray(titles.tmdbId, seriesIds)) : undefined,
        ),
      ),
    );
  return new Set(rows.map((row) => titleKey(row.kind, row.tmdbId)));
}
