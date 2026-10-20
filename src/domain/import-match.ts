import type { ImportLine } from "./import-lines";
import type { TitleKind } from "./types";

/** Below this name score no result is good enough to offer as a Match. */
export const NAME_FLOOR = 0.6;
/**
 * The least a name scores when the shorter name's whole words open or close the longer one
 * (`Shang chi` in `Shang-Chi and the Legend of the Ten Rings`). Below 1, so it never makes a Found.
 */
export const CONTAINED_NAME_SCORE = 0.8;
/** A lone word needs this many letters to count as contained; `Run` opens `Run Lola Run` by chance. */
const MIN_CONTAINED_LETTERS = 6;
const MIN_CONTAINED_WORDS = 2;
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
/**
 * A best result less popular than this is "check", however exact its name. Search splits text
 * into words, so `Old boy` never returns `Oldboy`, only an obscure Title spelled `Old Boy`;
 * real Titles people keep in a list, regional films included, score above it.
 */
export const MIN_FOUND_POPULARITY = 1;
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
  /** Its year is off the line's year hint. */
  yearAgainst: boolean;
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
const NOT_A_LETTER = /\P{L}/gu;
const LEADING_ARTICLE = /^(?:the|a|an) (?=\S)/;
const WHITESPACE = /\s+/g;

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

/**
 * 1 for the same name once normalised; otherwise how many character pairs the two share, from 0 to 1,
 * and at least `CONTAINED_NAME_SCORE` when one name's whole words open or close the other.
 */
export function nameScore(lineText: string, resultName: string): number {
  const lineCompact = compactName(lineText);
  const resultCompact = compactName(resultName);
  // Text that is only punctuation normalises to nothing, and nothing equals nothing.
  if (lineCompact === "" || resultCompact === "") return 0;
  const lineNormal = normaliseName(lineText);
  const resultNormal = normaliseName(resultName);
  if (lineCompact === resultCompact || lineNormal === resultNormal) return 1;

  const pairScore = dice(lineCompact, resultCompact);
  return holdsWholeWords(lineNormal, resultNormal) ? Math.max(pairScore, CONTAINED_NAME_SCORE) : pairScore;
}

// Official names add a franchise or a subtitle around the name people type, always at one end.
function holdsWholeWords(a: string, b: string): boolean {
  const wordsA = a.split(" ");
  const wordsB = b.split(" ");
  const [short, long] = wordsA.length <= wordsB.length ? [wordsA, wordsB] : [wordsB, wordsA];
  if (short.length === long.length) return false;
  if (short.length < MIN_CONTAINED_WORDS && letterCount(short[0]) < MIN_CONTAINED_LETTERS) return false;

  const startsWith = short.every((word, index) => word === long[index]);
  const offset = long.length - short.length;
  return startsWith || short.every((word, index) => word === long[offset + index]);
}

function letterCount(word: string): number {
  return Array.from(word.replace(NOT_A_LETTER, "")).length;
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
    yearAgainst: year < 0,
  };
}

// A kind hint usually comes from the heading above the line, and lists put Titles under the
// wrong heading, so it may order Titles with the same name but never hide one. A year is
// written on the line itself, so a Title it rules out is no rival.
function isRival<T extends MatchCandidate>(candidate: RankedCandidate<T>, best: RankedCandidate<T>): boolean {
  return (
    candidate !== best &&
    candidate.nameScore === 1 &&
    !candidate.yearAgainst &&
    // At equal popularity it still counts, so two Titles nothing tells apart are never decided by order alone.
    candidate.title.popularity >= best.title.popularity * RIVAL_POPULARITY_SHARE
  );
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
  const found =
    best.nameScore === 1 &&
    !best.hintAgainst &&
    !line.several &&
    best.title.popularity >= MIN_FOUND_POPULARITY &&
    !ranked.some((candidate) => isRival(candidate, best));
  return { result: found ? "found" : "check", candidates };
}

/**
 * Searches the line's text and ranks the results. When that does not find a clear Match and the
 * text has two or more words, the text with its spaces removed is searched too and its results
 * join the main ones. When that still finds nothing clear and the line has alternate text, the
 * alternate text is searched as well, and its results win only when they are found. Errors from
 * `search` reach the caller.
 */
export async function matchLine<T extends MatchCandidate>(
  line: MatchableLine,
  search: (text: string) => Promise<T[]>,
): Promise<LineMatch<T>> {
  const results = await search(line.query);
  let main = rankMatches(line, results);
  if (main.result !== "found" && !line.several && hasSeveralWords(line.query)) {
    // Search splits text into words, so it never returns `Westworld` for `West world`.
    const joined = await search(line.query.replace(WHITESPACE, ""));
    main = rankMatches(line, mergeResults(results, joined));
  }
  if (main.result === "found" || line.several || line.altQuery === undefined) {
    return { ...main, fromAltQuery: false };
  }
  const alternate = rankMatches(line, await search(line.altQuery), line.altQuery);
  return alternate.result === "found" ? { ...alternate, fromAltQuery: true } : { ...main, fromAltQuery: false };
}

function hasSeveralWords(text: string): boolean {
  return text.trim().split(WHITESPACE).length >= 2;
}

/** The main results first, then any joined-search result for a Title the main results do not hold. */
function mergeResults<T extends MatchCandidate>(main: readonly T[], extra: readonly T[]): T[] {
  const seen = new Set(main.map((result) => `${result.kind}:${result.tmdbId}`));
  const added = extra.filter((result) => {
    const key = `${result.kind}:${result.tmdbId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return [...main, ...added];
}
