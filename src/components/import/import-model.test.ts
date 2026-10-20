import { describe, expect, it } from "vitest";
import type { ImportCandidate, ImportLineMatch, ImportRowResult, SearchItem } from "@/data/dto";
import type { ImportLine, PastedList, SkippedLine } from "@/domain/import-lines";
import type { Status, TitleKind } from "@/domain/types";
import {
  addBatches,
  addedLabel,
  addInput,
  addingLabel,
  addLabel,
  applyCheckReply,
  buildRows,
  candidateFromSearch,
  checkedCount,
  checkingLabel,
  copyLabel,
  couldNotAddLabel,
  failedCompletely,
  failedRows,
  includeLines,
  linesNotAdded,
  lookRightLabel,
  matchRequest,
  nextCheckBatch,
  nextFailureCount,
  pasteCount,
  pickTitle,
  recordAddReply,
  rowsByGroup,
  rowsToAdd,
  setIntent,
  shouldStopChecking,
  skipLines,
  startCheck,
  summarizeImport,
  titleKey,
  uncheckedIds,
  undoDoneMessage,
  undoQuestion,
  type AddResults,
  type CheckState,
} from "./import-model";

// Made-up Titles only. Positions leave gaps, as headings and blank lines do in a real paste.
function line(id: number, original: string, extra: Partial<ImportLine> = {}): ImportLine {
  return { id, position: id * 2 + 1, original, query: original, intent: "to_watch", several: false, ...extra };
}

function title(tmdbId: number, kind: TitleKind = "movie", inLibrary = false): ImportCandidate {
  return { kind, tmdbId, name: `Title ${tmdbId}`, year: 2000 + (tmdbId % 20), posterPath: null, inLibrary };
}

function list(lines: ImportLine[], skipped: SkippedLine[] = []): PastedList {
  return { lines, skipped };
}

const found = (id: number, ...candidates: ImportCandidate[]): ImportLineMatch => ({ id, result: "found", candidates });
const check = (id: number, ...candidates: ImportCandidate[]): ImportLineMatch => ({ id, result: "check", candidates });
const notFound = (id: number, ...candidates: ImportCandidate[]): ImportLineMatch => ({
  id,
  result: "not_found",
  candidates,
});
const error = (id: number): ImportLineMatch => ({ id, result: "error", candidates: [] });

/** Starts a Check step and answers every line in one reply. */
function checked(lines: ImportLine[], reply: ImportLineMatch[], skipped: SkippedLine[] = []): CheckState {
  return applyCheckReply(
    startCheck(list(lines, skipped)),
    lines.map((each) => each.id),
    reply,
  );
}

const added = (candidate: ImportCandidate, status: Status, caughtUp = false): ImportRowResult => ({
  kind: candidate.kind,
  tmdbId: candidate.tmdbId,
  result: "added",
  status,
  caughtUp,
});

describe("pasteCount", () => {
  it("counts titles and skipped lines, with singular forms", () => {
    expect(pasteCount(list([line(0, "Moonfall Bay")], [{ position: 3, original: "x".repeat(201), reason: "too_long" }]))).toEqual({
      titles: "1 title",
      skipped: "1 line skipped",
      overLimit: false,
      canCheck: true,
    });
    const many = Array.from({ length: 3 }, (_, id) => line(id, `Film ${id}`));
    const skips: SkippedLine[] = [
      { position: 10, original: "https://example.com", reason: "not_a_title" },
      { position: 11, original: "y".repeat(300), reason: "too_long" },
    ];
    expect(pasteCount(list(many, skips))).toMatchObject({ titles: "3 titles", skipped: "2 lines skipped" });
  });

  it("shows no skipped line when the reader skipped nothing", () => {
    expect(pasteCount(list([line(0, "Moonfall Bay"), line(1, "Glass Orchard")])).skipped).toBeNull();
  });

  it("cannot check an empty paste", () => {
    expect(pasteCount(list([]))).toEqual({ titles: "0 titles", skipped: null, overLimit: false, canCheck: false });
  });

  it("stops at 500 Import lines and allows exactly 500", () => {
    const lines = (count: number) => Array.from({ length: count }, (_, id) => line(id, `Film ${id}`));
    expect(pasteCount(list(lines(500)))).toMatchObject({ overLimit: false, canCheck: true });
    expect(pasteCount(list(lines(501)))).toMatchObject({ titles: "501 titles", overLimit: true, canCheck: false });
  });
});

describe("check progress", () => {
  const lines = Array.from({ length: 23 }, (_, id) => line(id, `Film ${id}`));

  it("starts with every line unchecked and each line's own intent", () => {
    const state = startCheck(list([line(0, "A"), line(1, "B", { intent: "watched" })]));
    expect(uncheckedIds(state)).toEqual([0, 1]);
    expect(checkedCount(state)).toBe(0);
    expect(state.states.map((each) => each.intent)).toEqual(["to_watch", "watched"]);
  });

  it("sends at most 10 lines per request, the first unchecked ones", () => {
    let state = startCheck(list(lines));
    expect(nextCheckBatch(state).map((each) => each.id)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    state = applyCheckReply(
      state,
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
      Array.from({ length: 10 }, (_, id) => found(id, title(id))),
    );
    expect(checkedCount(state)).toBe(10);
    expect(nextCheckBatch(state).map((each) => each.id)).toEqual([10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);
    state = applyCheckReply(
      state,
      [10, 11, 12, 13, 14, 15, 16, 17, 18, 19],
      Array.from({ length: 10 }, (_, index) => found(index + 10, title(index + 10))),
    );
    expect(nextCheckBatch(state).map((each) => each.id)).toEqual([20, 21, 22]);
  });

  it("sends only the fields the match route accepts, never the pasted line", () => {
    const body = matchRequest([
      line(0, "Moonfall Bay (2004) ✔", { query: "Moonfall Bay", year: 2004, intent: "watched" }),
      line(1, "Paper Lanterns (series)", { query: "Paper Lanterns", kind: "series" }),
      line(2, "Um Dia(One Day)", { query: "Um Dia", altQuery: "One Day" }),
      line(3, "Glass Orchard 1 and 2", { query: "Glass Orchard 1 and 2", several: true }),
    ]);
    expect(body).toEqual({
      lines: [
        { id: 0, query: "Moonfall Bay", year: 2004, several: false },
        { id: 1, query: "Paper Lanterns", kind: "series", several: false },
        { id: 2, query: "Um Dia", altQuery: "One Day", several: false },
        { id: 3, query: "Glass Orchard 1 and 2", several: true },
      ],
    });
    for (const sent of body.lines) {
      expect(Object.keys(sent).every((key) => ["id", "query", "altQuery", "year", "kind", "several"].includes(key))).toBe(true);
    }
  });

  it("treats a failed request and an all-error reply as complete failures, and nothing else", () => {
    expect(failedCompletely(null)).toBe(true);
    expect(failedCompletely([error(0), error(1)])).toBe(true);
    expect(failedCompletely([error(0), found(1, title(1))])).toBe(false);
    expect(failedCompletely([notFound(0)])).toBe(false);
  });

  it("stops after two complete failures in a row, and a partial success resets the count", () => {
    let failures = nextFailureCount(0, null);
    expect(failures).toBe(1);
    expect(shouldStopChecking(failures)).toBe(false);
    failures = nextFailureCount(failures, [error(0), found(1, title(1))]);
    expect(failures).toBe(0);
    failures = nextFailureCount(failures, [error(0), error(1)]);
    expect(shouldStopChecking(failures)).toBe(false);
    failures = nextFailureCount(failures, null);
    expect(failures).toBe(2);
    expect(shouldStopChecking(failures)).toBe(true);
  });

  it("leaves lines unchecked after a complete failure, so trying again starts from them", () => {
    const state = startCheck(list(lines));
    expect(applyCheckReply(state, [0, 1], null)).toBe(state);
    expect(applyCheckReply(state, [0, 1], [error(0), error(1)])).toBe(state);
    expect(nextCheckBatch(state)[0].id).toBe(0);
  });

  it("marks one failed line as Couldn't check and a line the reply leaves out the same way", () => {
    const state = applyCheckReply(startCheck(list(lines.slice(0, 3))), [0, 1, 2], [found(0, title(1)), error(1)]);
    expect(state.states.map((each) => each.check)).toEqual(["found", "error", "error"]);
    expect(uncheckedIds(state)).toEqual([]);
  });

  it("pre-selects the best guess for Found and Check this, and nothing for Not found", () => {
    const state = checked(
      [line(0, "A"), line(1, "B"), line(2, "C")],
      [found(0, title(1)), check(1, title(2), title(3)), notFound(2, title(4))],
    );
    expect(state.states.map((each) => each.title?.tmdbId ?? null)).toEqual([1, 2, null]);
  });

  it("checks a Couldn't check line again and moves it to its new group", () => {
    let state = checked([line(0, "A"), line(1, "B")], [found(0, title(1)), error(1)]);
    expect(rowsByGroup(buildRows(state)).error.map((row) => row.anchorId)).toEqual([1]);
    expect(applyCheckReply(state, [1], [error(1)])).toBe(state);
    state = applyCheckReply(state, [1], [check(1, title(2))]);
    const groups = rowsByGroup(buildRows(state));
    expect(groups.error).toEqual([]);
    expect(groups.check.map((row) => row.title?.tmdbId)).toEqual([2]);
  });

  it("keeps a pick or a skip made while a Couldn't check line was checked again", () => {
    let state = checked([line(0, "A"), line(1, "B"), line(2, "C")], [found(0, title(1)), error(1), error(2)]);
    state = pickTitle(state, [1], title(5));
    state = skipLines(state, [2]);
    state = applyCheckReply(state, [1, 2], [found(1, title(6)), check(2, title(7))]);

    expect(state.states[1]).toMatchObject({ check: "found", candidates: [title(6)], title: title(5), skippedWith: null });
    expect(state.states[2]).toMatchObject({ check: "check", candidates: [title(7)] });
    expect(buildRows(state).find((row) => row.anchorId === 2)?.display).toBe("skipped");

    // The guess waits behind the skip, so Include brings it back.
    state = includeLines(state, [2]);
    expect(buildRows(state).find((row) => row.anchorId === 2)).toMatchObject({ display: "choose", title: title(7) });
  });
});

describe("rows", () => {
  it("groups rows as Check these, Not found, Couldn't check, then Found, each in paste order", () => {
    const state = checked(
      [line(0, "A"), line(1, "B"), line(2, "C"), line(3, "D"), line(4, "E"), line(5, "F"), line(6, "G")],
      [found(0, title(10)), error(1), notFound(2), check(3, title(13)), found(4, title(14)), check(5, title(15)), notFound(6)],
    );
    const rows = buildRows(state);
    expect(rows.map((row) => [row.group, row.anchorId])).toEqual([
      ["check", 3],
      ["check", 5],
      ["not_found", 2],
      ["not_found", 6],
      ["error", 1],
      ["found", 0],
      ["found", 4],
    ]);
    expect(rows.map((row) => row.display)).toEqual(["choose", "choose", "not_found", "not_found", "error", "choose", "choose"]);
  });

  it("hides lines that are still being checked", () => {
    const state = applyCheckReply(startCheck(list([line(0, "A"), line(1, "B")])), [0], [found(0, title(1))]);
    expect(buildRows(state).map((row) => row.anchorId)).toEqual([0]);
  });

  it("merges lines with the same Match into one row with every line in paste order", () => {
    const state = checked(
      [line(0, "Moonfall Bay"), line(1, "Other"), line(2, "moonfall bay")],
      [found(0, title(7)), found(1, title(8)), found(2, title(7))],
    );
    const rows = buildRows(state);
    expect(rows).toHaveLength(2);
    expect(rows[0].lines).toEqual([
      { id: 0, original: "Moonfall Bay" },
      { id: 2, original: "moonfall bay" },
    ]);
  });

  it("does not merge the same tmdb id across kinds", () => {
    const state = checked([line(0, "A"), line(1, "B")], [found(0, title(7, "movie")), found(1, title(7, "series"))]);
    expect(buildRows(state)).toHaveLength(2);
  });

  it("makes a merged row Watched when any line is Watched, else takes the first line's intent", () => {
    const watchedLater = checked(
      [line(0, "A"), line(1, "A ✔", { intent: "watched" })],
      [found(0, title(7)), found(1, title(7))],
    );
    expect(buildRows(watchedLater)[0].intent).toBe("watched");

    const watchingFirst = checked(
      [line(0, "A", { intent: "watching" }), line(1, "A")],
      [found(0, title(7)), found(1, title(7))],
    );
    expect(buildRows(watchingFirst)[0].intent).toBe("watching");
  });

  it("joins rows when a pick gives a line the same Title, keeping the picked row's place", () => {
    let state = checked(
      [line(0, "Moonfall Bay"), line(1, "Glass Orchard"), line(2, "Moonfal Bey")],
      [found(0, title(7)), check(1, title(8)), notFound(2)],
    );
    state = pickTitle(state, [2], title(7));
    const rows = buildRows(state);
    const joined = rows.find((row) => row.lines.length === 2);
    // The row sits where the Owner picked it, in Not found, and the Found line came to it.
    expect(joined).toMatchObject({ group: "not_found", anchorId: 2, display: "choose" });
    expect(joined?.lines.map((each) => each.id)).toEqual([0, 2]);
    expect(rowsByGroup(rows).found).toEqual([]);
  });

  it("splits a merged row when one of its lines is picked again", () => {
    let state = checked([line(0, "Dune Sea"), line(1, "Dune Sea 1984")], [found(0, title(7)), check(1, title(7))]);
    expect(buildRows(state)).toHaveLength(1);
    expect(buildRows(state)[0]).toMatchObject({ group: "check", anchorId: 1 });

    state = pickTitle(state, [1], title(9));
    const rows = buildRows(state);
    expect(rows.map((row) => [row.group, row.anchorId, row.title?.tmdbId])).toEqual([
      ["check", 1, 9],
      ["found", 0, 7],
    ]);
  });

  it("keeps a row in the group it started in after a pick or a skip", () => {
    let state = checked(
      [line(0, "A"), line(1, "B"), line(2, "C")],
      [check(0, title(10), title(11)), notFound(1), found(2, title(12))],
    );
    state = pickTitle(state, [0], title(11));
    state = pickTitle(state, [1], title(20));
    state = skipLines(state, [2]);
    expect(buildRows(state).map((row) => [row.group, row.anchorId, row.display])).toEqual([
      ["check", 0, "choose"],
      ["not_found", 1, "choose"],
      ["found", 2, "skipped"],
    ]);
  });

  it("keeps a skipped merged row as one row, and Include brings its Title back", () => {
    let state = checked(
      [line(0, "A"), line(1, "A again")],
      [found(0, title(7)), found(1, title(7))],
    );
    state = skipLines(state, [0, 1]);
    let rows = buildRows(state);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ display: "skipped", title: title(7) });

    state = includeLines(state, [0, 1]);
    rows = buildRows(state);
    expect(rows).toHaveLength(1);
    expect(rows[0].display).toBe("choose");
  });

  it("never joins a skipped row with another row of the same Title", () => {
    let state = checked([line(0, "A"), line(1, "B")], [found(0, title(7)), notFound(1)]);
    state = skipLines(state, [0]);
    state = pickTitle(state, [1], title(7));
    expect(buildRows(state).map((row) => row.display)).toEqual(["choose", "skipped"]);
    state = skipLines(state, [1]);
    expect(buildRows(state)).toHaveLength(2);
  });

  it("never joins two separate skips, even when their first lines match", () => {
    let state = checked([line(0, "A"), line(1, "A again")], [found(0, title(7)), found(1, title(7))]);
    state = skipLines(state, [0, 1]);
    state = pickTitle(state, [0], title(8));
    state = skipLines(state, [0]);
    expect(buildRows(state).map((row) => [row.display, row.lines.map((each) => each.id)])).toEqual([
      ["skipped", [0]],
      ["skipped", [1]],
    ]);
  });

  it("skips and includes a Not found line, back to Not found", () => {
    let state = checked([line(0, "A")], [notFound(0)]);
    state = skipLines(state, [0]);
    expect(buildRows(state)[0].display).toBe("skipped");
    state = includeLines(state, [0]);
    expect(buildRows(state)[0].display).toBe("not_found");
  });

  it("shows a chosen Title already in the Library as such, with no pills to choose", () => {
    const state = checked([line(0, "A"), line(1, "B")], [found(0, title(7, "movie", true)), check(1, title(8))]);
    const rows = buildRows(state);
    expect(rows.find((row) => row.anchorId === 0)?.display).toBe("in_library");
  });

  it("offers To watch and Watched, plus Watching or Dropped when a line was read that way", () => {
    const state = checked(
      [line(0, "A"), line(1, "B", { intent: "watching" }), line(2, "C", { intent: "dropped" })],
      [found(0, title(1)), found(1, title(2)), found(2, title(3))],
    );
    const options = buildRows(state).map((row) => row.intentOptions);
    expect(options).toEqual([
      ["to_watch", "watched"],
      ["to_watch", "watching", "watched"],
      ["to_watch", "watched", "dropped"],
    ]);
    // Changing the pill keeps the third pill on offer.
    const changed = setIntent(state, [1], "watched");
    expect(buildRows(changed)[1]).toMatchObject({ intent: "watched", intentOptions: ["to_watch", "watching", "watched"] });
  });

  it("sets the intent of every line in a merged row", () => {
    let state = checked(
      [line(0, "A ✔", { intent: "watched" }), line(1, "A")],
      [found(0, title(7)), found(1, title(7))],
    );
    state = setIntent(state, [0, 1], "to_watch");
    expect(buildRows(state)[0].intent).toBe("to_watch");
  });

  it("offers every line's candidates once, best first", () => {
    const state = checked([line(0, "A"), line(1, "A")], [check(0, title(7), title(8)), check(1, title(7), title(9))]);
    expect(buildRows(state)[0].candidates.map((each) => each.tmdbId)).toEqual([7, 8, 9]);
  });

  it("keeps the anchor line's search text for the pick sheet", () => {
    const state = checked([line(0, "Moonfal Bey ✔", { query: "Moonfal Bey" })], [notFound(0)]);
    expect(buildRows(state)[0].query).toBe("Moonfal Bey");
  });
});

describe("candidateFromSearch", () => {
  it("marks a search result already in the Library", () => {
    const item: SearchItem = {
      kind: "series",
      tmdbId: 5,
      name: "Paper Lanterns",
      year: 2019,
      posterPath: "/p.jpg",
      entry: { id: "e1", status: "watching" },
    };
    expect(candidateFromSearch(item)).toEqual({
      kind: "series",
      tmdbId: 5,
      name: "Paper Lanterns",
      year: 2019,
      posterPath: "/p.jpg",
      inLibrary: true,
    });
    expect(candidateFromSearch({ ...item, entry: null }).inLibrary).toBe(false);
  });
});

describe("adding", () => {
  function sample(): CheckState {
    let state = checked(
      [
        line(0, "A"),
        line(1, "B ✔", { intent: "watched" }),
        line(2, "C"),
        line(3, "D"),
        line(4, "E"),
        line(5, "A again"),
        line(6, "F"),
        line(7, "G"),
      ],
      [
        found(0, title(10)),
        found(1, title(11, "series")),
        notFound(2),
        found(3, title(13, "movie", true)),
        check(4, title(14)),
        found(5, title(10)),
        error(6),
        found(7, title(17)),
      ],
    );
    state = skipLines(state, [7]);
    return state;
  }

  it("adds each chosen Title once, bottom of the paste first, leaving out skipped, Library and unmatched rows", () => {
    expect(rowsToAdd(sample()).map((row) => [row.key, row.intent, row.position])).toEqual([
      ["movie:14", "to_watch", 9],
      ["series:11", "watched", 3],
      ["movie:10", "to_watch", 1],
    ]);
  });

  it("counts a picked Not found line once it has a Title", () => {
    const state = pickTitle(sample(), [2], title(30));
    expect(rowsToAdd(state).map((row) => row.key)).toContain("movie:30");
    expect(rowsToAdd(state)).toHaveLength(4);
  });

  it("sends batches of 5 with kind, id and intent only", () => {
    const lines = Array.from({ length: 12 }, (_, id) => line(id, `Film ${id}`));
    const state = checked(
      lines,
      lines.map((each) => found(each.id, title(100 + each.id))),
    );
    const batches = addBatches(rowsToAdd(state));
    expect(batches.map((batch) => batch.length)).toEqual([5, 5, 2]);
    expect(batches[0][0].tmdbId).toBe(111);
    expect(addInput(batches[2])).toEqual([
      { kind: "movie", tmdbId: 101, intent: "to_watch" },
      { kind: "movie", tmdbId: 100, intent: "to_watch" },
    ]);
  });

  it("records a failed call as failed rows, and a row the reply leaves out as failed", () => {
    const plan = rowsToAdd(sample());
    let results: AddResults = recordAddReply({}, plan.slice(0, 1), null);
    expect(results["movie:14"]).toEqual({ kind: "movie", tmdbId: 14, result: "failed" });
    results = recordAddReply(results, plan.slice(1), [added(title(11, "series"), "watched")]);
    expect(results["movie:10"].result).toBe("failed");
    expect(failedRows(plan, results).map((row) => row.key)).toEqual(["movie:14", "movie:10"]);
  });

  it("lets a later try replace a failure", () => {
    const plan = rowsToAdd(sample());
    let results = recordAddReply({}, plan, null);
    results = recordAddReply(results, failedRows(plan, results).slice(0, 1), [added(title(14), "to_watch")]);
    expect(summarizeImport(plan, results).added).toBe(1);
  });
});

describe("summarizeImport", () => {
  it("breaks the added Titles down in a fixed order, each part only when it has any", () => {
    const titles = [title(1), title(2, "series"), title(3, "series"), title(4, "series"), title(5), title(6)];
    const plan = titles.map((each, index) => ({
      key: titleKey(each),
      kind: each.kind,
      tmdbId: each.tmdbId,
      intent: "to_watch" as Status,
      name: each.name,
      position: index,
    }));
    const results: AddResults = {
      "movie:1": added(title(1), "to_watch"),
      "series:2": added(title(2, "series"), "watching", true),
      "series:3": added(title(3, "series"), "watching", false),
      "series:4": added(title(4, "series"), "watched"),
      "movie:5": added(title(5), "dropped"),
      "movie:6": { kind: "movie", tmdbId: 6, result: "already" },
    };
    expect(summarizeImport(plan, results)).toEqual({
      added: 5,
      breakdown: "1 to watch, 1 watched, 1 caught up, 1 watching, 1 dropped",
      failed: [],
    });
  });

  it("leaves out empty parts and lists failures in paste order", () => {
    const a = title(1);
    const b = title(2);
    const c = title(3);
    const plan = [
      { key: titleKey(c), kind: c.kind, tmdbId: 3, intent: "to_watch" as Status, name: c.name, position: 9 },
      { key: titleKey(b), kind: b.kind, tmdbId: 2, intent: "to_watch" as Status, name: b.name, position: 5 },
      { key: titleKey(a), kind: a.kind, tmdbId: 1, intent: "watched" as Status, name: a.name, position: 1 },
    ];
    const results = recordAddReply(recordAddReply({}, plan.slice(0, 2), null), plan.slice(2), [added(a, "watched")]);
    const summary = summarizeImport(plan, results);
    expect(summary.added).toBe(1);
    expect(summary.breakdown).toBe("1 watched");
    expect(summary.failed.map((row) => row.name)).toEqual(["Title 2", "Title 3"]);
  });

  it("has no breakdown when nothing was added", () => {
    expect(summarizeImport([], {})).toEqual({ added: 0, breakdown: "", failed: [] });
  });
});

describe("linesNotAdded", () => {
  it("lists every line that was not added, in paste order", () => {
    const readerSkipped: SkippedLine[] = [
      { position: 0, original: "https://example.com/list", reason: "not_a_title" },
      { position: 18, original: "z".repeat(201), reason: "too_long" },
    ];
    let state = checked(
      [
        line(0, "Added one"),
        line(1, "Not found one"),
        line(2, "Skipped one"),
        line(3, "Failed one"),
        line(4, "Couldn't check one"),
        line(5, "In library one"),
        line(6, "Added one again"),
        line(7, "Already one"),
        line(8, "Picked one"),
      ],
      [
        found(0, title(10)),
        notFound(1),
        found(2, title(12)),
        found(3, title(13)),
        error(4),
        found(5, title(15, "movie", true)),
        found(6, title(10)),
        found(7, title(17)),
        notFound(8),
      ],
      readerSkipped,
    );
    state = skipLines(state, [2]);
    state = pickTitle(state, [8], title(18));
    const plan = rowsToAdd(state);
    const results = recordAddReply({}, plan, [
      added(title(10), "to_watch"),
      { kind: "movie", tmdbId: 13, result: "failed" },
      { kind: "movie", tmdbId: 17, result: "already" },
      added(title(18), "to_watch"),
    ]);

    expect(linesNotAdded(state, results)).toEqual([
      "https://example.com/list",
      "Not found one",
      "Skipped one",
      "Failed one",
      "Couldn't check one",
      "z".repeat(201),
    ]);
  });

  it("includes lines that were never checked", () => {
    const state = applyCheckReply(startCheck(list([line(0, "A"), line(1, "B")])), [0], [found(0, title(1))]);
    expect(linesNotAdded(state, recordAddReply({}, rowsToAdd(state), [added(title(1), "to_watch")]))).toEqual(["B"]);
  });
});

describe("words", () => {
  it("uses singular forms for one", () => {
    expect([addLabel(1), addLabel(238)]).toEqual(["Add 1 title", "Add 238 titles"]);
    expect([addedLabel(1), addedLabel(236)]).toEqual(["Added 1 title", "Added 236 titles"]);
    expect([lookRightLabel(1), lookRightLabel(198)]).toEqual(["1 looks right", "198 look right"]);
    expect([copyLabel(1), copyLabel(14)]).toEqual(["Copy the 1 line not added", "Copy the 14 lines not added"]);
    expect([undoQuestion(1), undoQuestion(236)]).toEqual([
      "Remove the 1 title this import added?",
      "Remove the 236 titles this import added?",
    ]);
    expect(couldNotAddLabel(2)).toBe("2 couldn't be added");
  });

  it("shows progress as done of total", () => {
    expect(checkingLabel(120, 248)).toBe("Checking 120 of 248");
    expect(addingLabel(120, 238)).toBe("Adding 120 of 238");
  });

  it("says what Undo removed and kept", () => {
    expect(undoDoneMessage(234, 2)).toBe("Removed 234 titles. Kept 2 you changed.");
    expect(undoDoneMessage(236, 0)).toBe("Removed 236 titles.");
    expect(undoDoneMessage(1, 0)).toBe("Removed 1 title.");
    expect(undoDoneMessage(0, 1)).toBe("Removed 0 titles. Kept 1 you changed.");
  });
});
