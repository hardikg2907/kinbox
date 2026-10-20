import type { ImportCandidate, ImportLineMatch, ImportMatchResult, ImportRowResult, SearchItem } from "@/data/dto";
import type { ImportMatchInput } from "@/data/import-match";
import { MAX_IMPORT_LINES, type ImportLine, type PastedList, type SkippedLine } from "@/domain/import-lines";
import { STATUSES, type Status, type TitleKind } from "@/domain/types";

// Everything the import screens decide, kept free of React and fetch so every rule has a test.

/** The match route takes at most this many lines per request. */
export const LINES_PER_CHECK = 10;
/** `addToImport` takes at most this many rows per call. */
export const ROWS_PER_ADD = 5;
/** Checking stops after this many requests in a row fail completely. */
export const FAILURES_BEFORE_STOP = 2;

export const TMDB_DOWN_MESSAGE = "Can't reach the movie database right now. Try again in a minute.";
export const SIGN_IN_MESSAGE = "Sign in to continue.";

export type LineCheck = "pending" | ImportMatchResult;

export type LineState = {
  check: LineCheck;
  /** Up to 3, best first, as the match route sent them. */
  candidates: ImportCandidate[];
  /** The current choice: the best guess, a Title picked in the sheet, or none. Kept while skipped. */
  title: ImportCandidate | null;
  /** Lines skipped together share a token, so a skipped row stays one row and never joins another. */
  skippedWith: number | null;
  intent: Status;
};

export type CheckState = {
  lines: readonly ImportLine[];
  /** Lines the reader skipped (too long, not a title). */
  readerSkipped: readonly SkippedLine[];
  /** One per Import line; an Import line's id is its index here. */
  states: readonly LineState[];
  /** Skips made so far. Each skip takes the next count as its token, so no two skips ever share one. */
  skips: number;
};

export type Group = "check" | "not_found" | "error" | "found";

/** Problem groups first; the rows that look right fold away last. */
export const GROUP_ORDER: readonly Group[] = ["check", "not_found", "error", "found"];

export type RowDisplay = "choose" | "in_library" | "skipped" | "not_found" | "error";

export type RowLine = { id: number; original: string };

export type Row = {
  /** The line that places the row in its group. It stays put while the Owner picks or skips. */
  anchorId: number;
  /** In paste order. */
  lines: RowLine[];
  group: Group;
  display: RowDisplay;
  title: ImportCandidate | null;
  /** The Titles offered in the pick sheet: every line's candidates, best first, without repeats. */
  candidates: ImportCandidate[];
  intent: Status;
  /** The status pills: To watch and Watched, plus Watching or Dropped when a line was read that way. */
  intentOptions: Status[];
  /** The anchor line's search text, a starting point when nothing was found. */
  query: string;
};

export type AddRow = {
  key: string;
  kind: TitleKind;
  tmdbId: number;
  intent: Status;
  name: string;
  /** The first pasted line behind the row. */
  position: number;
};

export type AddResults = Readonly<Record<string, ImportRowResult>>;

export type ImportSummary = {
  added: number;
  /** "180 to watch, 50 watched, 6 caught up"; empty when nothing was added. */
  breakdown: string;
  /** In paste order. */
  failed: AddRow[];
};

export function titleKey(title: { kind: TitleKind; tmdbId: number }): string {
  return `${title.kind}:${title.tmdbId}`;
}

// ---- Paste ----------------------------------------------------------------------------------

export type PasteCount = { titles: string; skipped: string | null; overLimit: boolean; canCheck: boolean };

export function pasteCount(list: PastedList): PasteCount {
  const overLimit = list.lines.length > MAX_IMPORT_LINES;
  return {
    titles: plural(list.lines.length, "title", "titles"),
    skipped: list.skipped.length > 0 ? `${plural(list.skipped.length, "line", "lines")} skipped` : null,
    overLimit,
    canCheck: list.lines.length > 0 && !overLimit,
  };
}

// ---- Check ----------------------------------------------------------------------------------

export function startCheck(list: PastedList): CheckState {
  return {
    lines: list.lines,
    readerSkipped: list.skipped,
    states: list.lines.map((line) => ({
      check: "pending",
      candidates: [],
      title: null,
      skippedWith: null,
      intent: line.intent,
    })),
    skips: 0,
  };
}

export function uncheckedIds(state: CheckState): number[] {
  const ids: number[] = [];
  state.states.forEach((line, id) => {
    if (line.check === "pending") ids.push(id);
  });
  return ids;
}

export function checkedCount(state: CheckState): number {
  return state.lines.length - uncheckedIds(state).length;
}

/** The first unchecked lines, at most one request's worth. */
export function nextCheckBatch(state: CheckState): ImportLine[] {
  return uncheckedIds(state)
    .slice(0, LINES_PER_CHECK)
    .map((id) => state.lines[id]);
}

/** The match route's body: only the fields it accepts, so the pasted line itself never leaves the device. */
export function matchRequest(lines: readonly ImportLine[]): ImportMatchInput {
  return {
    lines: lines.map((line) => {
      const sent: ImportMatchInput["lines"][number] = { id: line.id, query: line.query, several: line.several };
      if (line.altQuery !== undefined) sent.altQuery = line.altQuery;
      if (line.year !== undefined) sent.year = line.year;
      if (line.kind !== undefined) sent.kind = line.kind;
      return sent;
    }),
  };
}

/** Null stands for a request that failed as a whole. Every line coming back "error" counts the same. */
export function failedCompletely(reply: readonly ImportLineMatch[] | null): boolean {
  return reply === null || reply.every((line) => line.result === "error");
}

export function nextFailureCount(failuresInARow: number, reply: readonly ImportLineMatch[] | null): number {
  return failedCompletely(reply) ? failuresInARow + 1 : 0;
}

export function shouldStopChecking(failuresInARow: number): boolean {
  return failuresInARow >= FAILURES_BEFORE_STOP;
}

/**
 * Records a reply for the lines that were sent. A complete failure changes nothing, so those lines
 * stay unchecked (or stay "Couldn't check") and the next try sends them again. A line the reply
 * leaves out counts as "Couldn't check", so checking never waits for it. A pick or a skip the Owner
 * made while a "Couldn't check" line was being checked again stays as they left it.
 */
export function applyCheckReply(
  state: CheckState,
  sentIds: readonly number[],
  reply: readonly ImportLineMatch[] | null,
): CheckState {
  if (reply === null || failedCompletely(reply)) return state;
  const byId = new Map(reply.map((line) => [line.id, line]));
  const states = [...state.states];
  for (const id of sentIds) {
    const current = states[id];
    if (!current) continue;
    const match = byId.get(id);
    const check: ImportMatchResult = match?.result ?? "error";
    const candidates = match?.candidates ?? [];
    const guess = check === "found" || check === "check" ? (candidates[0] ?? null) : null;
    // Only lines with no answer yet and "Couldn't check" lines are sent, and neither has a guess,
    // so a Title already here is one the Owner picked.
    states[id] = { ...current, check, candidates, title: current.title ?? guess };
  }
  return { ...state, states };
}

// ---- Choices --------------------------------------------------------------------------------

export function pickTitle(state: CheckState, lineIds: readonly number[], title: ImportCandidate): CheckState {
  return update(state, lineIds, (line) => ({ ...line, title, skippedWith: null }));
}

export function skipLines(state: CheckState, lineIds: readonly number[]): CheckState {
  if (lineIds.length === 0) return state;
  const token = state.skips + 1;
  return { ...update(state, lineIds, (line) => ({ ...line, skippedWith: token })), skips: token };
}

export function includeLines(state: CheckState, lineIds: readonly number[]): CheckState {
  return update(state, lineIds, (line) => ({ ...line, skippedWith: null }));
}

export function setIntent(state: CheckState, lineIds: readonly number[], intent: Status): CheckState {
  return update(state, lineIds, (line) => ({ ...line, intent }));
}

export function candidateFromSearch(item: SearchItem): ImportCandidate {
  return {
    kind: item.kind,
    tmdbId: item.tmdbId,
    name: item.name,
    year: item.year,
    posterPath: item.posterPath,
    inLibrary: item.entry !== null,
  };
}

function update(state: CheckState, lineIds: readonly number[], change: (line: LineState) => LineState): CheckState {
  const states = [...state.states];
  for (const id of lineIds) {
    const current = states[id];
    if (current) states[id] = change(current);
  }
  return { ...state, states };
}

// ---- Rows -----------------------------------------------------------------------------------

const LINE_GROUP: Record<ImportMatchResult, Group> = {
  check: "check",
  not_found: "not_found",
  error: "error",
  found: "found",
};

// Lines merge when their current choice is the same Title. Lines skipped together stay together,
// and a line with no Title is a row of its own.
function mergeKey(line: LineState, id: number): string {
  if (line.skippedWith !== null) return `skipped:${line.skippedWith}`;
  if (line.title) return `title:${titleKey(line.title)}`;
  return `line:${id}`;
}

/**
 * The Check step's rows, merged and in screen order: by group, then by the anchor's place in the
 * paste. A merged row sits in the first of its lines' groups, anchored by its first line there, so
 * a row the Owner picks for keeps its place and the line it joins comes to it.
 */
export function buildRows(state: CheckState): Row[] {
  const buckets = new Map<string, number[]>();
  state.states.forEach((line, id) => {
    if (line.check === "pending") return;
    const key = mergeKey(line, id);
    const ids = buckets.get(key);
    if (ids) ids.push(id);
    else buckets.set(key, [id]);
  });

  const rows = [...buckets.values()].map((ids) => toRow(state, ids));
  return rows.sort(
    (a, b) =>
      GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group) ||
      state.lines[a.anchorId].position - state.lines[b.anchorId].position,
  );
}

export function rowsByGroup(rows: readonly Row[]): Record<Group, Row[]> {
  const groups: Record<Group, Row[]> = { check: [], not_found: [], error: [], found: [] };
  for (const row of rows) groups[row.group].push(row);
  return groups;
}

function toRow(state: CheckState, ids: number[]): Row {
  // Ids count Import lines in paste order, so sorting them sorts by position.
  const sorted = [...ids].sort((a, b) => a - b);
  const lines = sorted.map((id) => state.states[id]);
  const group = GROUP_ORDER.find((candidate) => lines.some((line) => lineGroup(line) === candidate)) ?? "found";
  const anchorId = sorted.find((id) => lineGroup(state.states[id]) === group) ?? sorted[0];
  const first = lines[0];
  const anchor = state.states[anchorId];
  const title = first.title;
  const skipped = first.skippedWith !== null;

  const display: RowDisplay = skipped
    ? "skipped"
    : title?.inLibrary
      ? "in_library"
      : title
        ? "choose"
        : anchor.check === "error"
          ? "error"
          : "not_found";

  const intents = new Set<Status>(["to_watch", "watched"]);
  for (const id of sorted) {
    intents.add(state.lines[id].intent);
    intents.add(state.states[id].intent);
  }

  const seen = new Set<string>();
  const candidates: ImportCandidate[] = [];
  for (const line of lines) {
    for (const candidate of line.candidates) {
      const key = titleKey(candidate);
      if (seen.has(key)) continue;
      seen.add(key);
      candidates.push(candidate);
    }
  }

  return {
    anchorId,
    lines: sorted.map((id) => ({ id, original: state.lines[id].original })),
    group,
    display,
    title,
    candidates,
    intent: lines.some((line) => line.intent === "watched") ? "watched" : first.intent,
    intentOptions: STATUSES.filter((status) => intents.has(status)),
    query: state.lines[anchorId].query,
  };
}

function lineGroup(line: LineState): Group | null {
  return line.check === "pending" ? null : LINE_GROUP[line.check];
}

// ---- Add ------------------------------------------------------------------------------------

/**
 * The rows to add, from the bottom of the paste to the top: the Library shows the newest first,
 * so it then reads in the order of the paste.
 */
export function rowsToAdd(state: CheckState): AddRow[] {
  return buildRows(state)
    .filter((row): row is Row & { title: ImportCandidate } => row.display === "choose" && row.title !== null)
    .map((row) => ({
      key: titleKey(row.title),
      kind: row.title.kind,
      tmdbId: row.title.tmdbId,
      intent: row.intent,
      name: row.title.name,
      position: state.lines[row.lines[0].id].position,
    }))
    .sort((a, b) => b.position - a.position);
}

export function addBatches(rows: readonly AddRow[]): AddRow[][] {
  const batches: AddRow[][] = [];
  for (let start = 0; start < rows.length; start += ROWS_PER_ADD) {
    batches.push(rows.slice(start, start + ROWS_PER_ADD));
  }
  return batches;
}

/** What `addToImport` takes for one batch: kind, id and intent only. */
export function addInput(batch: readonly AddRow[]): { kind: TitleKind; tmdbId: number; intent: Status }[] {
  return batch.map(({ kind, tmdbId, intent }) => ({ kind, tmdbId, intent }));
}

/** Records one batch. A batch whose call failed, and any row the reply leaves out, counts as failed. */
export function recordAddReply(
  results: AddResults,
  batch: readonly AddRow[],
  reply: readonly ImportRowResult[] | null,
): AddResults {
  const byKey = new Map((reply ?? []).map((result) => [titleKey(result), result]));
  const next: Record<string, ImportRowResult> = { ...results };
  for (const row of batch) {
    next[row.key] = byKey.get(row.key) ?? { kind: row.kind, tmdbId: row.tmdbId, result: "failed" };
  }
  return next;
}

/** Rows to send again from the result screen. */
export function failedRows(plan: readonly AddRow[], results: AddResults): AddRow[] {
  return plan.filter((row) => results[row.key]?.result === "failed");
}

export function summarizeImport(plan: readonly AddRow[], results: AddResults): ImportSummary {
  const counts = { to_watch: 0, watched: 0, caught_up: 0, watching: 0, dropped: 0 };
  let added = 0;
  for (const row of plan) {
    const result = results[row.key];
    if (result?.result !== "added") continue;
    added += 1;
    if (result.status === "watching") counts[result.caughtUp ? "caught_up" : "watching"] += 1;
    else counts[result.status] += 1;
  }
  const parts = [
    counts.to_watch > 0 ? `${counts.to_watch} to watch` : null,
    counts.watched > 0 ? `${counts.watched} watched` : null,
    counts.caught_up > 0 ? `${counts.caught_up} caught up` : null,
    counts.watching > 0 ? `${counts.watching} watching` : null,
    counts.dropped > 0 ? `${counts.dropped} dropped` : null,
  ].filter((part): part is string => part !== null);

  return {
    added,
    breakdown: parts.join(", "),
    failed: failedRows(plan, results).sort((a, b) => a.position - b.position),
  };
}

/**
 * Every pasted line that did not end up in the Library through this Import, in paste order, for
 * the Owner to keep elsewhere. A line merged into an added row, and a Title the Library already
 * had, are not in it.
 */
export function linesNotAdded(state: CheckState, results: AddResults): string[] {
  const kept: { position: number; original: string }[] = [];
  const shown = new Set<number>();

  for (const row of buildRows(state)) {
    for (const line of row.lines) shown.add(line.id);
    if (row.display === "in_library") continue;
    if (row.display === "choose" && row.title) {
      const result = results[titleKey(row.title)]?.result;
      if (result === "added" || result === "already") continue;
    }
    for (const line of row.lines) kept.push({ position: state.lines[line.id].position, original: line.original });
  }
  // Lines never checked have no row; they were not added either.
  state.lines.forEach((line) => {
    if (!shown.has(line.id)) kept.push({ position: line.position, original: line.original });
  });
  for (const line of state.readerSkipped) kept.push({ position: line.position, original: line.original });

  return kept.sort((a, b) => a.position - b.position).map((line) => line.original);
}

// ---- Words ----------------------------------------------------------------------------------

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

export function addLabel(count: number): string {
  return `Add ${plural(count, "title", "titles")}`;
}

export function checkingLabel(done: number, total: number): string {
  return `Checking ${done} of ${total}`;
}

export function addingLabel(done: number, total: number): string {
  return `Adding ${done} of ${total}`;
}

export function lookRightLabel(count: number): string {
  return count === 1 ? "1 looks right" : `${count} look right`;
}

export function addedLabel(count: number): string {
  return `Added ${plural(count, "title", "titles")}`;
}

export function couldNotAddLabel(count: number): string {
  return `${count} couldn't be added`;
}

export function copyLabel(count: number): string {
  return `Copy the ${plural(count, "line", "lines")} not added`;
}

export function undoQuestion(count: number): string {
  return `Remove the ${plural(count, "title", "titles")} this import added?`;
}

export function undoDoneMessage(removed: number, kept: number): string {
  const done = `Removed ${plural(removed, "title", "titles")}.`;
  return kept > 0 ? `${done} Kept ${kept} you changed.` : done;
}
