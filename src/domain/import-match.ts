import type { ImportLine } from "./import-lines";
import type { TitleKind } from "./types";

/** Below this name score no result is good enough to offer as a Match. */
export const NAME_FLOOR = 0.6;
/** Added when a result's kind agrees with the line's kind hint, taken off when it does not. */
export const KIND_HINT_WEIGHT = 0.15;
/** Added when a result's year is within `YEAR_TOLERANCE` of the line's year hint. */
export const YEAR_AGREES_BONUS = 0.1;
/** Taken off when a result's year is further from the line's year hint. */
export const YEAR_AGAINST_PENALTY = 0.3;
export const YEAR_TOLERANCE = 1;
/** The most popularity can add to a score. */
export const POPULARITY_CAP = 0.05;
/** Popularity reaches the cap at 10 to the power of this, minus 1. */
export const POPULARITY_LOG_RANGE = 3;
/** A rival with the same name and at least this share of the best one's popularity makes the line "check". */
export const RIVAL_POPULARITY_SHARE = 1 / 3;
export const MAX_CANDIDATES = 3;

export type MatchResult = "found" | "check" | "not_found";

/** What ranking reads from a search result. Any other fields the caller has ride along untouched. */
export type MatchCandidate = {
  kind: TitleKind;
  tmdbId: number;
  name: string;
  originalName: string | null;
  year: number | null;
  popularity: number;
};

export type RankableLine = Pick<ImportLine, "query" | "year" | "kind" | "several">;
export type MatchableLine = RankableLine & Pick<ImportLine, "altQuery">;

export type RankedCandidate<T> = {
  /** The caller's own search result, as it was passed in. */
  title: T;
  /** 0 to 1: how close the better of its name and original name is to the line's text. */
  nameScore: number;
  /** The name score plus the kind, year and popularity adjustments; candidates are sorted by it. */
  score: number;
  /** Its kind disagrees with the line's kind hint, or its year is off the year hint. */
  hintAgainst: boolean;
};

export type Ranking<T> = {
  result: MatchResult;
  /** The best `MAX_CANDIDATES` results, best first. Offered even when nothing is found. */
  candidates: RankedCandidate<T>[];
};

export type LineMatch<T> = Ranking<T> & {
  /** The candidates came from searching the line's alternate text. */
  fromAltQuery: boolean;
};

const COMBINING_MARKS = /\p{M}/gu;
const APOSTROPHES = /['’‘ʼ`]/g;
const NOT_LETTER_OR_DIGIT = /[^\p{L}\p{N}]+/gu;
const LEADING_ARTICLE = /^(?:the|a|an) (?=\S)/;

/** A name reduced to what people keep when they type it from memory: no accents, case, punctuation or leading article. */
export function normaliseName(text: string): string {
  return text
    .normalize("NFKD")
    .replace(COMBINING_MARKS, "")
    .toLowerCase()
    .replaceAll("&", " and ")
    .replace(APOSTROPHES, "")
    .replace(NOT_LETTER_OR_DIGIT, " ")
    .trim()
    .replace(LEADING_ARTICLE, "");
}

/** `normaliseName` without spaces, so `West world` and `Westworld` compare equal. */
export function compactName(text: string): string {
  return normaliseName(text).replaceAll(" ", "");
}

/** 1 for the same name once normalised; otherwise how many character pairs the two share, from 0 to 1. */
export function nameScore(lineText: string, resultName: string): number {
  const lineCompact = compactName(lineText);
  const resultCompact = compactName(resultName);
  // Text that is only punctuation normalises to nothing, and nothing equals nothing.
  if (lineCompact === "" || resultCompact === "") return 0;
  if (lineCompact === resultCompact || normaliseName(lineText) === normaliseName(resultName)) return 1;
  return dice(lineCompact, resultCompact);
}

function dice(a: string, b: string): number {
  const pairsA = characterPairs(a);
  const pairsB = characterPairs(b);
  if (pairsA.total === 0 || pairsB.total === 0) return 0;
  let shared = 0;
  for (const [pair, count] of pairsA.counts) {
    shared += Math.min(count, pairsB.counts.get(pair) ?? 0);
  }
  return (2 * shared) / (pairsA.total + pairsB.total);
}

function characterPairs(text: string): { counts: Map<string, number>; total: number } {
  // By code point, so a character outside the Basic Multilingual Plane is one character, not two halves.
  const characters = Array.from(text);
  const counts = new Map<string, number>();
  for (let index = 0; index < characters.length - 1; index++) {
    const pair = characters[index] + characters[index + 1];
    counts.set(pair, (counts.get(pair) ?? 0) + 1);
  }
  return { counts, total: Math.max(0, characters.length - 1) };
}

// A hint only moves a result down, never out: a Movie listed under a TV heading still has to
// be found, and the Owner sees it among the candidates to confirm.
function kindAdjustment(hint: TitleKind | undefined, kind: TitleKind): number {
  if (hint === undefined) return 0;
  return hint === kind ? KIND_HINT_WEIGHT : -KIND_HINT_WEIGHT;
}

function yearAdjustment(hint: number | undefined, year: number | null): number {
  if (hint === undefined || year === null) return 0;
  return Math.abs(hint - year) <= YEAR_TOLERANCE ? YEAR_AGREES_BONUS : -YEAR_AGAINST_PENALTY;
}

// Capped well below a typical gap between two different names, so popularity orders Titles
// with the same name and only rarely lifts a near name over an exact one. When it does, the
// best result's name score is under 1, so the line becomes "check", never a wrong "found".
function popularityBonus(popularity: number): number {
  if (!Number.isFinite(popularity) || popularity <= 0) return 0;
  return Math.min(POPULARITY_CAP, (POPULARITY_CAP * Math.log10(1 + popularity)) / POPULARITY_LOG_RANGE);
}

function rank<T extends MatchCandidate>(line: RankableLine, title: T, text: string): RankedCandidate<T> {
  const score = Math.max(
    nameScore(text, title.name),
    title.originalName === null ? 0 : nameScore(text, title.originalName),
  );
  const kind = kindAdjustment(line.kind, title.kind);
  const year = yearAdjustment(line.year, title.year);
  return {
    title,
    nameScore: score,
    score: score + kind + year + popularityBonus(title.popularity),
    hintAgainst: kind < 0 || year < 0,
  };
}

function isClear<T extends MatchCandidate>(candidate: RankedCandidate<T>): boolean {
  return candidate.nameScore === 1 && !candidate.hintAgainst;
}

/** Scores every search result against the line's text and decides how sure the best one is. */
export function rankMatches<T extends MatchCandidate>(
  line: RankableLine,
  results: readonly T[],
  text: string = line.query,
): Ranking<T> {
  // Array sort is stable, so equal scores keep TMDB's own order.
  const ranked = results.map((title) => rank(line, title, text)).sort((a, b) => b.score - a.score);
  const candidates = ranked.slice(0, MAX_CANDIDATES);
  if (!ranked.some((candidate) => candidate.nameScore >= NAME_FLOOR)) {
    return { result: "not_found", candidates };
  }

  const [best] = ranked;
  // A rival at the same popularity counts too, so two equal Titles with no popularity are never told apart by order alone.
  const rivalled = ranked.some(
    (candidate) =>
      candidate !== best &&
      isClear(candidate) &&
      candidate.title.popularity >= best.title.popularity * RIVAL_POPULARITY_SHARE,
  );
  const found = isClear(best) && !line.several && !rivalled;
  return { result: found ? "found" : "check", candidates };
}

/**
 * Searches the line's text and ranks the results. When that finds nothing clear and the line
 * has alternate text, the alternate text is searched too, and its results win only when they
 * are found. Errors from `search` reach the caller.
 */
export async function matchLine<T extends MatchCandidate>(
  line: MatchableLine,
  search: (text: string) => Promise<T[]>,
): Promise<LineMatch<T>> {
  const main = rankMatches(line, await search(line.query));
  if (main.result === "found" || line.several || line.altQuery === undefined) {
    return { ...main, fromAltQuery: false };
  }
  const alternate = rankMatches(line, await search(line.altQuery), line.altQuery);
  return alternate.result === "found" ? { ...alternate, fromAltQuery: true } : { ...main, fromAltQuery: false };
}
