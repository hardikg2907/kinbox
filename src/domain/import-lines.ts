import type { Status, TitleKind } from "./types";

/** Limits that the browser enforces on one paste; the reader itself never truncates. */
export const MAX_IMPORT_LINES = 500;
export const MAX_PASTE_CHARACTERS = 50_000;
export const MAX_LINE_CHARACTERS = 200;
/** The search cache keys on the query, so it stays short. */
export const MAX_QUERY_CHARACTERS = 100;

export type ImportLine = {
  /** 0 for the first Import line; counts Import lines only. */
  id: number;
  /** 0-based index of the line in the pasted text; counts every line. */
  position: number;
  /** The pasted line, trimmed and otherwise unchanged. */
  original: string;
  query: string;
  altQuery?: string;
  year?: number;
  kind?: TitleKind;
  intent: Status;
  several: boolean;
};

export type SkipReason = "too_long" | "not_a_title";
export type SkippedLine = { position: number; original: string; reason: SkipReason };
export type PastedList = { lines: ImportLine[]; skipped: SkippedLine[] };

const FIRST_YEAR = 1874;
const YEARS_AHEAD = 5;

const HEADING_KINDS: ReadonlyMap<string, TitleKind> = new Map([
  ["tv", "series"],
  ["tv shows", "series"],
  ["tv series", "series"],
  ["shows", "series"],
  ["series", "series"],
  ["web series", "series"],
  ["anime", "series"],
  ["movies", "movie"],
  ["movie", "movie"],
  ["films", "movie"],
  ["film", "movie"],
]);

const HEADING_STATUSES: ReadonlyMap<string, Status> = new Map([
  ["to watch", "to_watch"],
  ["watchlist", "to_watch"],
  ["want to watch", "to_watch"],
  ["watching", "watching"],
  ["currently watching", "watching"],
  ["watched", "watched"],
  ["seen", "watched"],
  ["done", "watched"],
  ["dropped", "dropped"],
]);

const BRACKET_KINDS: ReadonlyMap<string, TitleKind> = new Map([
  ["series", "series"],
  ["tv", "series"],
  ["tv series", "series"],
  ["tv show", "series"],
  ["web series", "series"],
  ["show", "series"],
  ["anime", "series"],
  ["movie", "movie"],
  ["film", "movie"],
]);

// A language name alone could match a Title literally named that, so it is neither a hint nor a search.
const LANGUAGES: ReadonlySet<string> = new Set([
  "hindi",
  "malayalam",
  "tamil",
  "telugu",
  "kannada",
  "bengali",
  "marathi",
  "punjabi",
  "english",
  "korean",
  "japanese",
  "chinese",
  "mandarin",
  "cantonese",
  "spanish",
  "french",
  "german",
  "italian",
  "turkish",
  "thai",
  "portuguese",
  "russian",
]);

// Variation selector and zero-width characters, written out so no regex has to run on a long line.
const INVISIBLE_CHARACTERS = ["\uFE0F", "\u200B", "\u200C", "\u200D", "\u2060", "\uFEFF"];

const BARE_HOST_TLDS: ReadonlySet<string> = new Set(["com", "org", "net", "io", "in", "co", "tv", "app", "dev", "info"]);
const HOST_LABEL = /^[a-z0-9-]+$/;
const HOST_TLD = /^[a-z]{2,}$/;

// The checked glyphs are ✔ ✓ ☑ ✅; the empty one is ☐.
const WATCHED_MARK = /[\u2714\u2713\u2611\u2705]|\[[xX]\]/;
const EMPTY_BOX = /\u2610|\[ \]/;
// An x that ends the word right after a mark is a typo for the mark; one that starts a word (X-Ray) is a Title.
const ANY_MARK = /(?:[\u2714\u2713\u2611\u2705\u2610]|\[[xX ]\])(?:[xX](?=$|[\s,;.()[\]\u2714\u2713\u2611\u2705\u2610]))?/g;
const EMPTY_BRACKETS = /\(\s*\)|\[\s*\]/g;
const LEADING_BULLET = /^[-*\u2022\u2013]\s*/;
const LEADING_NUMBER = /^\d{1,3}[.)](?:\s+|$)/;

const HEADING_TAIL = /[\s:\u2013\u2014-]+$/;
const TRAILING_PUNCTUATION = /[,.;\s]+$/;
const TRAILING_YEAR = /[\s,](\d{4})$/;

const AND_NUMBER = / and \d/i;
const COMMA_BETWEEN_TITLES = /,\s+[\p{L}\p{N}]/u;
const ALL_PARTS = /\(all parts\)/i;
const TRILOGY = /\btrilogy\b/i;
const ALL_OR_MORE_LIST = /^(?:all|more) .*(?:movies|films|parts|series)$/i;

const TRAILING_NUMBER_RUN = /(?:\s*\d+\s*(?:and|&|\/))+\s*\d+$/i;
const TRAILING_TRILOGY = /\s+trilogy$/i;
const ALL_LIST_NAME = /^all\s+(.+?)\s+(?:movies|films|parts|series)$/i;
const MORE_LINE = /^more /i;
const TITLE_SEPARATOR = /\/|,\s+/;
const MIN_FIRST_TITLE_CHARACTERS = 2;

const BRACKET_GROUP = /\(([^()[\]]*)\)|\[([^()[\]]*)\]/g;
const BRACKET_LEFTOVER = /[()[\]]/g;
const YEAR_TEXT = /^\d{4}$/;
const THREE_LETTERS = /\p{L}{3}/u;

type Heading = { kind: TitleKind } | { status: Status };

type TitleParts = {
  query: string;
  altQuery?: string;
  year?: number;
  kind?: TitleKind;
  /** The Status the line asks for with its own mark or empty box. */
  mark?: Status;
  several: boolean;
};

type BracketHints = { year?: number; kind?: TitleKind; altQuery?: string };

export function readPastedList(text: string, options?: { currentYear?: number }): PastedList {
  const lastYear = (options?.currentYear ?? new Date().getFullYear()) + YEARS_AHEAD;
  const lines: ImportLine[] = [];
  const skipped: SkippedLine[] = [];
  let kindHint: TitleKind | undefined;
  let statusHint: Status | undefined;

  const rawLines = text.replaceAll("\r\n", "\n").replaceAll("\r", "\n").split("\n");
  for (let position = 0; position < rawLines.length; position++) {
    const original = rawLines[position].trim();
    const cleaned = clean(rawLines[position]);
    if (cleaned === "") continue;

    if (exceedsCodePoints(cleaned, MAX_LINE_CHARACTERS)) {
      skipped.push({ position, original, reason: "too_long" });
      continue;
    }
    if (isUrlLine(cleaned)) {
      skipped.push({ position, original, reason: "not_a_title" });
      continue;
    }

    const heading = readHeading(cleaned);
    if (heading) {
      if ("kind" in heading) {
        kindHint = heading.kind;
        statusHint = undefined;
      } else {
        statusHint = heading.status;
      }
      continue;
    }
    if (cleaned.endsWith(":")) continue;

    const title = readTitle(cleaned, lastYear);
    if (!title) {
      skipped.push({ position, original, reason: "not_a_title" });
      continue;
    }

    const line: ImportLine = {
      id: lines.length,
      position,
      original,
      query: title.query,
      intent: title.mark ?? statusHint ?? "to_watch",
      several: title.several,
    };
    if (title.altQuery !== undefined) line.altQuery = title.altQuery;
    if (title.year !== undefined) line.year = title.year;
    // A kind written on the line is more specific than the section it sits in.
    const kind = title.kind ?? kindHint;
    if (kind !== undefined) line.kind = kind;
    lines.push(line);
  }

  return { lines, skipped };
}

function clean(line: string): string {
  let text = line;
  for (const character of INVISIBLE_CHARACTERS) text = text.replaceAll(character, "");
  // Normalise after the removals so a hidden character between a letter and its accent cannot stop them joining.
  return text.replaceAll("\u00A0", " ").normalize("NFC").trim();
}

function exceedsCodePoints(text: string, limit: number): boolean {
  // A code point takes one or two UTF-16 units, so the unit count bounds the code point count.
  if (text.length <= limit) return false;
  if (text.length > limit * 2) return true;
  return Array.from(text).length > limit;
}

function isUrlLine(text: string): boolean {
  const lower = text.toLowerCase();
  if (lower.startsWith("http://") || lower.startsWith("https://") || lower.startsWith("www.")) return true;
  if (/\s/.test(text)) return false;
  if (lower.includes("://")) return true;

  const slash = lower.indexOf("/");
  const labels = (slash < 0 ? lower : lower.slice(0, slash)).split(".");
  const topLevel = labels[labels.length - 1];
  if (labels.length < 2 || !labels.every((label) => HOST_LABEL.test(label))) return false;
  return slash < 0 ? BARE_HOST_TLDS.has(topLevel) : HOST_TLD.test(topLevel);
}

function readHeading(text: string): Heading | undefined {
  const word = collapseSpaces(text.replace(HEADING_TAIL, "")).toLowerCase();
  const kind = HEADING_KINDS.get(word);
  if (kind) return { kind };
  const status = HEADING_STATUSES.get(word);
  if (status) return { status };
  return undefined;
}

function readTitle(cleaned: string, lastYear: number): TitleParts | undefined {
  const mark = WATCHED_MARK.test(cleaned) ? "watched" : EMPTY_BOX.test(cleaned) ? "to_watch" : undefined;

  const withoutMarks = cleaned.replace(ANY_MARK, " ").replace(EMPTY_BRACKETS, " ");
  const text = stripLeadingMarkers(collapseSpaces(withoutMarks));
  // A bullet or a mark can hide a URL from the check on the raw line.
  if (isUrlLine(text)) return undefined;

  const several = namesSeveralTitles(text, lastYear);
  const withoutBrackets = readBracketGroups(text, lastYear);
  const withoutYear = takeTrailingYear(tidy(withoutBrackets.text), lastYear);
  const query = capQuery(several ? firstTitle(withoutYear.text) : withoutYear.text);
  if (query === "") return undefined;

  const parts: TitleParts = { query, several };
  if (mark) parts.mark = mark;
  if (withoutBrackets.altQuery !== undefined) parts.altQuery = capQuery(withoutBrackets.altQuery);
  const year = withoutBrackets.year ?? withoutYear.year;
  if (year !== undefined) parts.year = year;
  if (withoutBrackets.kind) parts.kind = withoutBrackets.kind;
  return parts;
}

function stripLeadingMarkers(text: string): string {
  let current = text;
  for (;;) {
    const next = current.replace(LEADING_BULLET, "").replace(LEADING_NUMBER, "").trimStart();
    if (next === current) return next;
    current = next;
  }
}

function namesSeveralTitles(text: string, lastYear: number): boolean {
  const body = tidy(text);
  return (
    AND_NUMBER.test(text) ||
    text.includes("/") ||
    // A year after a comma belongs to one Title, not to a second one.
    COMMA_BETWEEN_TITLES.test(takeTrailingYear(body, lastYear).text) ||
    ALL_PARTS.test(text) ||
    TRILOGY.test(text) ||
    ALL_OR_MORE_LIST.test(body)
  );
}

// Search matches one name, so a line that lists several Titles searches for the first one. The
// line stays flagged, so it is never Found: the Owner still confirms which Titles to add.
function firstTitle(text: string): string {
  // The list is longer than any one name in it, so no single first Title exists.
  if (MORE_LINE.test(text)) return text;

  // The number run goes before the split, or `Name 1/2` would be cut at its slash.
  let name = tidy(text.replace(TRAILING_NUMBER_RUN, ""));
  name = tidy(name.replace(TRAILING_TRILOGY, ""));
  const franchise = ALL_LIST_NAME.exec(name);
  if (franchise) name = franchise[1];
  name = tidy(name.split(TITLE_SEPARATOR)[0]);

  return Array.from(name).length < MIN_FIRST_TITLE_CHARACTERS ? text : name;
}

function readBracketGroups(text: string, lastYear: number): BracketHints & { text: string } {
  const hints: BracketHints = {};
  const rest = text.replace(BRACKET_GROUP, (_group, round: string | undefined, square: string | undefined) => {
    readBracketGroup(collapseSpaces(round ?? square ?? ""), hints, lastYear);
    return " ";
  });
  return { ...hints, text: rest.replace(BRACKET_LEFTOVER, " ") };
}

function readBracketGroup(inner: string, hints: BracketHints, lastYear: number): void {
  if (YEAR_TEXT.test(inner)) {
    const year = Number(inner);
    if (hints.year === undefined && isYear(year, lastYear)) hints.year = year;
    return;
  }

  const lower = inner.toLowerCase();
  const kind = BRACKET_KINDS.get(lower);
  if (kind) {
    hints.kind ??= kind;
    return;
  }
  if (LANGUAGES.has(lower)) return;

  // Wrapped again so the line rules judge it as the bracket group it came from.
  if (hints.altQuery === undefined && THREE_LETTERS.test(inner) && !namesSeveralTitles(`(${inner})`, lastYear)) {
    hints.altQuery = inner;
  }
}

function takeTrailingYear(text: string, lastYear: number): { text: string; year?: number } {
  const match = TRAILING_YEAR.exec(text);
  if (!match) return { text };
  const year = Number(match[1]);
  if (!isYear(year, lastYear)) return { text };
  const rest = tidy(text.slice(0, match.index));
  // A line that is only a year is a Title (1917), not a hint.
  return rest === "" ? { text } : { text: rest, year };
}

function isYear(year: number, lastYear: number): boolean {
  return year >= FIRST_YEAR && year <= lastYear;
}

function collapseSpaces(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function tidy(text: string): string {
  return collapseSpaces(text).replace(TRAILING_PUNCTUATION, "");
}

function capQuery(text: string): string {
  if (text.length <= MAX_QUERY_CHARACTERS) return tidy(text);
  return tidy(Array.from(text).slice(0, MAX_QUERY_CHARACTERS).join(""));
}
