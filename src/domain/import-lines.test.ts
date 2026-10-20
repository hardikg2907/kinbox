import { describe, expect, it } from "vitest";
import {
  MAX_IMPORT_LINES,
  MAX_LINE_CHARACTERS,
  MAX_PASTE_CHARACTERS,
  MAX_QUERY_CHARACTERS,
  readPastedList,
  type ImportLine,
} from "./import-lines";

const CURRENT_YEAR = 2026;

const read = (text: string) => readPastedList(text, { currentYear: CURRENT_YEAR });

/** Reads a text that must hold exactly one Import line and nothing skipped. */
function readOne(text: string): ImportLine {
  const { lines, skipped } = read(text);
  expect(skipped).toEqual([]);
  expect(lines).toHaveLength(1);
  return lines[0];
}

const codePoints = (text: string) => Array.from(text).length;

describe("limits", () => {
  it("exports the browser limits", () => {
    expect(MAX_IMPORT_LINES).toBe(500);
    expect(MAX_PASTE_CHARACTERS).toBe(50_000);
    expect(MAX_LINE_CHARACTERS).toBe(200);
    expect(MAX_QUERY_CHARACTERS).toBe(100);
  });
});

describe("a plain line", () => {
  it("becomes one Import line that wants to be watched", () => {
    expect(read("Moonlit Harbor")).toStrictEqual({
      lines: [
        {
          id: 0,
          position: 0,
          original: "Moonlit Harbor",
          query: "Moonlit Harbor",
          intent: "to_watch",
          several: false,
        },
      ],
      skipped: [],
    });
  });

  it("returns nothing for an empty paste", () => {
    expect(read("")).toEqual({ lines: [], skipped: [] });
    expect(read("  \n\t\n  ")).toEqual({ lines: [], skipped: [] });
  });

  it("leaves optional fields out instead of setting them to undefined", () => {
    const line = readOne("Moonlit Harbor");
    expect(Object.keys(line).sort()).toEqual(["id", "intent", "original", "position", "query", "several"]);
  });
});

describe("headings", () => {
  it.each(["Tv - ", "Tv -", "tv:", "TV Shows:", "Shows", "Series --", "Web Series -", "ANIME –", "tv series —"])(
    "reads %j as a Series heading",
    (heading) => {
      expect(readOne(`${heading}\nMoonlit Harbor`)).toMatchObject({
        query: "Moonlit Harbor",
        kind: "series",
        intent: "to_watch",
      });
    },
  );

  it.each(["Movies- ", "Movies-", "movie:", "Films", "FILM -"])("reads %j as a Movie heading", (heading) => {
    expect(readOne(`${heading}\nMoonlit Harbor`)).toMatchObject({ query: "Moonlit Harbor", kind: "movie" });
  });

  it.each([
    ["Watched:", "watched"],
    ["Watchlist -", "to_watch"],
    ["To Watch", "to_watch"],
    ["want to watch:", "to_watch"],
    ["Watching", "watching"],
    ["Currently  Watching :", "watching"],
    ["Seen -", "watched"],
    ["Done:", "watched"],
    ["Dropped –", "dropped"],
  ] as const)("reads %j as a Status heading", (heading, intent) => {
    const line = readOne(`${heading}\nMoonlit Harbor`);
    expect(line.intent).toBe(intent);
    expect(line).not.toHaveProperty("kind");
  });

  it("does not list a heading as an Import line or a skipped line", () => {
    expect(read("Tv - \nMovies- \nWatched:")).toEqual({ lines: [], skipped: [] });
  });

  it("starts a new section when a kind heading follows a Status heading", () => {
    const { lines } = read("Watched:\nMoonlit Harbor\nMovies\nPaper Lanterns");
    expect(lines[0]).toMatchObject({ query: "Moonlit Harbor", intent: "watched" });
    expect(lines[1]).toMatchObject({ query: "Paper Lanterns", intent: "to_watch", kind: "movie" });
  });

  it("keeps the kind when a Status heading follows a kind heading", () => {
    const { lines } = read("Tv -\nMoonlit Harbor\nWatched:\nPaper Lanterns\nWatchlist\nGlass Garden");
    expect(lines.map((line) => [line.query, line.kind, line.intent])).toEqual([
      ["Moonlit Harbor", "series", "to_watch"],
      ["Paper Lanterns", "series", "watched"],
      ["Glass Garden", "series", "to_watch"],
    ]);
  });

  it("lets a later kind heading replace an earlier one", () => {
    const { lines } = read("Tv -\nMoonlit Harbor\nMovies-\nPaper Lanterns");
    expect(lines.map((line) => line.kind)).toEqual(["series", "movie"]);
  });

  it("ignores a line that ends in a colon but is not a heading word", () => {
    const { lines, skipped } = read("Something:\nMoonlit Harbor");
    expect(skipped).toEqual([]);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ query: "Moonlit Harbor", position: 1, id: 0 });
  });

  it("keeps the hints through an ignored label", () => {
    const { lines } = read("Tv -\nMy favourites:\nMoonlit Harbor");
    expect(lines[0]).toMatchObject({ kind: "series" });
  });

  it("reads a dash inside a line as part of a Title", () => {
    expect(readOne("Moonlit- the return")).toMatchObject({ query: "Moonlit- the return" });
    expect(readOne("Tv- Moonlit")).toMatchObject({ query: "Tv- Moonlit" });
  });

  it("reads a colon inside a line as part of a Title", () => {
    expect(readOne("2001: A Space Odyssey")).toMatchObject({ query: "2001: A Space Odyssey" });
  });

  it("does not read a heading word with a mark as a heading", () => {
    expect(readOne("Seen ✔")).toMatchObject({ query: "Seen", intent: "watched" });
  });
});

describe("Watched marks and boxes", () => {
  it.each([
    ["with a space before", "Moonlit Harbor ✔"],
    ["with no space before", "Moonlit Harbor✔"],
    ["with the emoji selector", "Moonlit Harbor ✔️"],
    ["with the emoji selector and no space", "Moonlit Harbor✔️"],
    ["as two marks", "Moonlit Harbor ✔✔"],
    ["as two marks apart", "Moonlit Harbor ✔ ✔️"],
    ["inside brackets", "Moonlit Harbor (✔)"],
    ["inside brackets with no space", "Moonlit Harbor(✔️)"],
    ["in square brackets", "Moonlit Harbor [✔]"],
    ["before the name", "✔ Moonlit Harbor"],
    ["with a stray x", "Moonlit Harbor ✔x"],
    ["with a stray capital X", "Moonlit Harbor ✔X"],
    ["as a check mark", "Moonlit Harbor ✓"],
    ["as a keep box", "Moonlit Harbor ☑"],
    ["as a green box", "Moonlit Harbor ✅"],
    ["as [x]", "Moonlit Harbor [x]"],
    ["as [X]", "Moonlit Harbor [X]"],
    ["as [x] before the name", "[x] Moonlit Harbor"],
  ])("reads a mark %s", (_name, text) => {
    expect(readOne(text)).toMatchObject({ query: "Moonlit Harbor", intent: "watched" });
  });

  it("keeps a name that starts with x right after a mark", () => {
    expect(readOne("✔Xylophone Dreams")).toMatchObject({ query: "Xylophone Dreams", intent: "watched" });
    expect(readOne("✔X-Ray Garden")).toMatchObject({ query: "X-Ray Garden", intent: "watched" });
  });

  it.each([
    ["an empty keep box", "☐ Moonlit Harbor"],
    ["an empty box after the name", "Moonlit Harbor ☐"],
    ["[ ]", "[ ] Moonlit Harbor"],
  ])("reads %s as To watch", (_name, text) => {
    expect(readOne(text)).toMatchObject({ query: "Moonlit Harbor", intent: "to_watch" });
  });

  it("lets a Watched mark win over an empty box", () => {
    expect(readOne("☐ Moonlit Harbor ✔")).toMatchObject({ query: "Moonlit Harbor", intent: "watched" });
    expect(readOne("[ ] [x] Moonlit Harbor")).toMatchObject({ query: "Moonlit Harbor", intent: "watched" });
  });

  it("lets the line's own mark or box beat the heading's Status", () => {
    const { lines } = read("Watched:\n☐ Moonlit Harbor\nPaper Lanterns\nWatching\nGlass Garden ✔");
    expect(lines.map((line) => [line.query, line.intent])).toEqual([
      ["Moonlit Harbor", "to_watch"],
      ["Paper Lanterns", "watched"],
      ["Glass Garden", "watched"],
    ]);
  });

  it("uses the heading's Status when the line has no mark", () => {
    const { lines } = read("Dropped -\nMoonlit Harbor");
    expect(lines[0].intent).toBe("dropped");
  });
});

describe("bullets and numbering", () => {
  it.each(["- ", "-", "* ", "• ", "•", "– ", "1. ", "2) ", "12. ", "123) ", "- - ", "1. - ", "- ✔ "])(
    "removes the leading %j",
    (prefix) => {
      expect(readOne(`${prefix}Moonlit Harbor`)).toMatchObject({ query: "Moonlit Harbor" });
    },
  );

  it("keeps numbers that belong to the Title", () => {
    expect(readOne("1917")).toMatchObject({ query: "1917" });
    expect(readOne("2001: A Space Odyssey")).toMatchObject({ query: "2001: A Space Odyssey" });
    expect(readOne("12 Angry Orchards")).toMatchObject({ query: "12 Angry Orchards" });
    expect(readOne("7.5 Lanterns")).toMatchObject({ query: "7.5 Lanterns" });
    expect(readOne("1. 1917")).toMatchObject({ query: "1917" });
  });
});

describe("bracket groups", () => {
  it("reads a year in brackets with or without a space", () => {
    expect(readOne("Moonlit Harbor(2002)")).toMatchObject({ query: "Moonlit Harbor", year: 2002 });
    expect(readOne("Moonlit Harbor (1988)")).toMatchObject({ query: "Moonlit Harbor", year: 1988 });
    expect(readOne("Moonlit Harbor [1988]")).toMatchObject({ query: "Moonlit Harbor", year: 1988 });
  });

  it("takes the first year when there are two", () => {
    expect(readOne("Moonlit Harbor (1990) (2002)")).toMatchObject({ query: "Moonlit Harbor", year: 1990 });
  });

  it("accepts years from 1874 up to the current year plus 5", () => {
    expect(readOne("Moonlit Harbor (1874)")).toMatchObject({ year: 1874 });
    expect(readOne(`Moonlit Harbor (${CURRENT_YEAR + 5})`)).toMatchObject({ year: CURRENT_YEAR + 5 });
    expect(readOne("Moonlit Harbor (1873)")).not.toHaveProperty("year");
    expect(readOne(`Moonlit Harbor (${CURRENT_YEAR + 6})`)).not.toHaveProperty("year");
  });

  it("drops an out-of-range year from the query without making it a hint", () => {
    const line = readOne("Moonlit Harbor (2999)");
    expect(line.query).toBe("Moonlit Harbor");
    expect(line).not.toHaveProperty("year");
    expect(line).not.toHaveProperty("altQuery");
  });

  it("uses the clock year when no current year is given", () => {
    const thisYear = new Date().getFullYear();
    expect(readPastedList(`Moonlit Harbor (${thisYear + 5})`).lines[0]).toMatchObject({ year: thisYear + 5 });
    expect(readPastedList(`Moonlit Harbor (${thisYear + 6})`).lines[0]).not.toHaveProperty("year");
  });

  it.each([
    ["series", "series"],
    ["Series", "series"],
    ["tv", "series"],
    ["TV series", "series"],
    ["tv show", "series"],
    ["web series", "series"],
    ["show", "series"],
    ["anime", "series"],
    ["movie", "movie"],
    ["Film", "movie"],
  ] as const)("reads (%s) as the kind %s", (word, kind) => {
    const line = readOne(`Moonlit Harbor (${word})`);
    expect(line).toMatchObject({ query: "Moonlit Harbor", kind });
    expect(line).not.toHaveProperty("altQuery");
  });

  it("lets a bracket kind win over the heading's kind", () => {
    expect(readOne("Movies\nMoonlit Harbor (series)")).toMatchObject({ kind: "series" });
    expect(readOne("Tv -\nMoonlit Harbor [movie]")).toMatchObject({ kind: "movie" });
  });

  it("drops a language without a hint or an alternate search", () => {
    for (const language of ["malayalam", "Hindi", "KOREAN", "portuguese"]) {
      const line = readOne(`Moonlit Harbor (${language})`);
      expect(line.query).toBe("Moonlit Harbor");
      expect(line).not.toHaveProperty("altQuery");
      expect(line).not.toHaveProperty("kind");
      expect(line).not.toHaveProperty("year");
    }
  });

  it("uses another name in brackets as the alternate search", () => {
    expect(readOne("Um Dia(One Day)")).toMatchObject({ query: "Um Dia", altQuery: "One Day" });
    expect(readOne("Um Dia (One Day)")).toMatchObject({ query: "Um Dia", altQuery: "One Day" });
    expect(readOne("Um Dia [One   Day]")).toMatchObject({ query: "Um Dia", altQuery: "One Day" });
  });

  it("keeps only the first alternate search", () => {
    expect(readOne("Um Dia (One Day) (Another Name)")).toMatchObject({ query: "Um Dia", altQuery: "One Day" });
  });

  it("does not make an alternate search from a language, a short word or several-Titles text", () => {
    for (const text of [
      "Moonlit Harbor (1 and 2)",
      "Moonlit Harbor (all parts)",
      "Moonlit Harbor (Hindi/Tamil)",
      "Moonlit Harbor (HD)",
    ]) {
      const line = readOne(text);
      expect(line.query).toBe("Moonlit Harbor");
      expect(line).not.toHaveProperty("altQuery");
    }
  });

  it("combines a year, a kind and an alternate search", () => {
    expect(readOne("Um Dia (2016) (series) (hindi) (One Day)")).toMatchObject({
      query: "Um Dia",
      year: 2016,
      kind: "series",
      altQuery: "One Day",
    });
  });

  it("turns leftover single brackets into spaces", () => {
    expect(readOne("Moonlit (Harbor").query).toBe("Moonlit Harbor");
    expect(readOne("Moonlit Harbor)").query).toBe("Moonlit Harbor");
    expect(readOne("Moonlit [Harbor").query).toBe("Moonlit Harbor");
    expect(readOne("Moonlit ]Harbor").query).toBe("Moonlit Harbor");
  });

  it("removes empty bracket pairs", () => {
    expect(readOne("Moonlit Harbor ()").query).toBe("Moonlit Harbor");
    expect(readOne("Moonlit Harbor ( )").query).toBe("Moonlit Harbor");
    expect(readOne("Moonlit Harbor []").query).toBe("Moonlit Harbor");
  });

  it("keeps the text around a bracket group", () => {
    expect(readOne("Moonlit (2002) Harbor").query).toBe("Moonlit Harbor");
  });
});

describe("a year without brackets", () => {
  it("reads a year at the end as the year hint", () => {
    expect(readOne("Moonlit Harbor 2010")).toMatchObject({ query: "Moonlit Harbor", year: 2010 });
    expect(readOne("Moonlit Harbor, 2010")).toMatchObject({ query: "Moonlit Harbor", year: 2010 });
    expect(readOne("Moonlit Harbor 2010.")).toMatchObject({ query: "Moonlit Harbor", year: 2010 });
    expect(readOne("Moonlit Harbor 2010 (series)")).toMatchObject({
      query: "Moonlit Harbor",
      year: 2010,
      kind: "series",
    });
  });

  it("keeps a line that is only a year as the query", () => {
    const line = readOne("1917");
    expect(line.query).toBe("1917");
    expect(line).not.toHaveProperty("year");
    expect(readOne("2012 (2009)")).toMatchObject({ query: "2012", year: 2009 });
  });

  it("keeps a number in the query when it is not a valid year", () => {
    const line = readOne("Blade Runner 2049");
    expect(line.query).toBe("Blade Runner 2049");
    expect(line).not.toHaveProperty("year");
    expect(readOne("Moonlit Harbor 1873").query).toBe("Moonlit Harbor 1873");
  });

  it("follows the current year option", () => {
    expect(readPastedList("Blade Runner 2049", { currentYear: 2044 }).lines[0]).toMatchObject({
      query: "Blade Runner",
      year: 2049,
    });
    expect(readPastedList("Blade Runner 2049", { currentYear: 2043 }).lines[0].query).toBe("Blade Runner 2049");
  });

  it("does not read part of a longer number as a year", () => {
    expect(readOne("Moonlit Harbor 12010").query).toBe("Moonlit Harbor 12010");
  });

  it("does not read a year in the middle of the line", () => {
    expect(readOne("Moonlit 2010 Harbor")).toMatchObject({ query: "Moonlit 2010 Harbor" });
    expect(readOne("Moonlit 2010 Harbor")).not.toHaveProperty("year");
  });
});

describe("lines that name several Titles", () => {
  it.each([
    // A trailing number run goes, also when it is glued to the word before it.
    ["Moonlit Harbor 1 and 2", "Moonlit Harbor"],
    ["Moonlit Harbor 1 AND 2", "Moonlit Harbor"],
    ["Moonlit Harbor 1/2", "Moonlit Harbor"],
    ["Moonlit Harbor1 and 2", "Moonlit Harbor"],
    ["Moonlit Harbor1/2", "Moonlit Harbor"],
    ["Moonlit Harbor 1 / 2", "Moonlit Harbor"],
    ["Moonlit Harbor 1/ 2", "Moonlit Harbor"],
    ["Moonlit Harbor 1 & 2 (all parts)", "Moonlit Harbor"],
    ["Moonlit Harbor 1 and 2 and 3", "Moonlit Harbor"],
    ["Moonlit Harbor 1/2/3", "Moonlit Harbor"],
    ["Moonlit Harbor (all parts)", "Moonlit Harbor"],
    ["Moonlit Harbor (1 and 2)", "Moonlit Harbor"],
    // The first part before a slash or a comma and a space is the first Title.
    ["Moonlit Harbor/ Paper lanterns", "Moonlit Harbor"],
    ["Moonlit Harbor/Paper lanterns", "Moonlit Harbor"],
    ["Moonlit Harbor, Paper Lanterns 2", "Moonlit Harbor"],
    ["Moonlit Harbor, 2 and 3", "Moonlit Harbor"],
    ["Moonlit Harbor 1, 2, 3", "Moonlit Harbor 1"],
    ["Moonlit Harbor/ Paper Lanterns, Glass Garden", "Moonlit Harbor"],
    ["Moonlit Harbor, Paper Lanterns, 2010", "Moonlit Harbor"],
    // A line that names a set has no single first Title, so it keeps its whole text and no other rule applies.
    ["Moonlit Harbor trilogy", "Moonlit Harbor trilogy"],
    ["Moonlit Harbor Trilogy.", "Moonlit Harbor Trilogy"],
    ["Moonlit Harbor 1 and 2 trilogy", "Moonlit Harbor 1 and 2 trilogy"],
    ["Moonlit Harbor/ Paper Lanterns trilogy", "Moonlit Harbor/ Paper Lanterns trilogy"],
    ["All Lantern movies", "All Lantern movies"],
    ["all lantern FILMS", "all lantern FILMS"],
    ["All Lantern parts", "All Lantern parts"],
    ["all lantern series", "all lantern series"],
    ["All Moonlit Harbor movies", "All Moonlit Harbor movies"],
    ["All Harbor/ Lantern movies", "All Harbor/ Lantern movies"],
    ["More Harbor movies", "More Harbor movies"],
    ["More Harbor movies,", "More Harbor movies"],
    ["more harbor films", "more harbor films"],
    ["More Harbor/ Lantern movies", "More Harbor/ Lantern movies"],
    // A line that starts with "more" but does not end in a list word is still one name and a rest.
    ["More Than Honey/ Paper Lanterns", "More Than Honey"],
    // Nothing left to search for, or one character: the text stays as it was.
    ["Trilogy", "Trilogy"],
    ["all movies", "all movies"],
    ["1 and 2", "1 and 2"],
    ["/Moonlit Harbor", "/Moonlit Harbor"],
    ["A/ Moonlit Harbor", "A/ Moonlit Harbor"],
  ])("flags %j and searches for %j", (text, query) => {
    const line = readOne(text);
    expect(line.several).toBe(true);
    expect(line.query).toBe(query);
  });

  it("keeps the pasted line and every hint when it picks the first Title", () => {
    expect(readOne("Movies\n- Moonlit Harbor 1 and 2 (2010) ✔")).toStrictEqual({
      id: 0,
      position: 1,
      original: "- Moonlit Harbor 1 and 2 (2010) ✔",
      query: "Moonlit Harbor",
      year: 2010,
      kind: "movie",
      intent: "watched",
      several: true,
    });
    expect(readOne("All Lantern movies").original).toBe("All Lantern movies");
    expect(readOne("  Moonlit Harbor/ Paper Lanterns ").original).toBe("Moonlit Harbor/ Paper Lanterns");
  });

  it("keeps the whole search text of a line that is not flagged", () => {
    for (const text of [
      "Moonlit Harbor 1 & 2",
      "Moonlit Harbor and Paper Lanterns",
      "Moonlit Harbor 2",
      "Moonlit Harbor trilogies",
      "All the Quiet Orchards",
      "More Than Honey",
    ]) {
      const line = readOne(text);
      expect(line.several).toBe(false);
      expect(line.query).toBe(text);
    }
  });

  it.each([
    "All the Quiet Orchards",
    "All Is Quiet",
    "More Than Honey",
    "Moonlit Harbor,",
    "Moonlit Harbor 2",
    "Moonlit Harbor and Paper Lanterns",
    "Moonlit Harbor (2002)",
    "Parts of Harbor",
    "Moonlit,Harbor",
    "Moonlit Harbor trilogies",
  ])("does not flag %j", (text) => {
    expect(readOne(text).several).toBe(false);
  });

  it("does not flag a comma before a trailing year", () => {
    expect(readOne("Moonlit Harbor, 2010")).toMatchObject({ query: "Moonlit Harbor", year: 2010, several: false });
    expect(readOne("Moonlit Harbor, Paper Lanterns, 2010")).toMatchObject({ several: true, year: 2010 });
  });
});

describe("lines that are skipped", () => {
  it.each([
    "https://example.com/watch?v=abc",
    "http://example.com",
    "HTTPS://EXAMPLE.COM/List",
    "www.example.com/my-list",
    "Www.example.com",
    "example.com/my/list",
    "youtu.be/abc123",
    "ftp://example.com/list",
    "- https://example.com/list",
    "1. www.example.com",
    "https://example.com/list ✔",
  ])("skips the URL %j as not a title", (text) => {
    expect(read(text)).toEqual({
      lines: [],
      skipped: [{ position: 0, original: text.trim(), reason: "not_a_title" }],
    });
  });

  it("keeps a Title that has a dot or a web-like word in it", () => {
    expect(readOne("Mr.Quartz")).toMatchObject({ query: "Mr.Quartz" });
    expect(readOne("Dr.Lantern Returns")).toMatchObject({ query: "Dr.Lantern Returns" });
    expect(readOne("Watch www.example.com now")).toMatchObject({ query: "Watch www.example.com now" });
  });

  it("skips a line over 200 characters as too long and keeps one of exactly 200", () => {
    const tooLong = "a".repeat(MAX_LINE_CHARACTERS + 1);
    expect(read(tooLong)).toEqual({
      lines: [],
      skipped: [{ position: 0, original: tooLong, reason: "too_long" }],
    });
    const fits = "a".repeat(MAX_LINE_CHARACTERS);
    expect(readOne(fits).original).toBe(fits);
  });

  it("counts code points, not UTF-16 units, for the line limit", () => {
    expect(readOne("\u{1F600}".repeat(MAX_LINE_CHARACTERS)).original).toBe("\u{1F600}".repeat(MAX_LINE_CHARACTERS));
    expect(read("\u{1F600}".repeat(MAX_LINE_CHARACTERS + 1)).skipped).toHaveLength(1);
  });

  it("counts the line length after cleaning", () => {
    const padded = `${"a".repeat(MAX_LINE_CHARACTERS)}​️‍`;
    expect(read(padded).skipped).toEqual([]);
    expect(read(padded).lines).toHaveLength(1);
  });

  it("checks the length before it looks for a URL", () => {
    const text = `https://example.com/${"a".repeat(MAX_LINE_CHARACTERS)}`;
    expect(read(text).skipped).toEqual([{ position: 0, original: text, reason: "too_long" }]);
  });

  it("skips a line that is only a mark, a bullet or brackets as not a title", () => {
    const { lines, skipped } = read("✔\n✔️ ✔\n-\n• \n1. \n()\n[ ]\n[x]\n(✔)");
    expect(lines).toEqual([]);
    expect(skipped.map((line) => [line.position, line.original, line.reason])).toEqual([
      [0, "✔", "not_a_title"],
      [1, "✔️ ✔", "not_a_title"],
      [2, "-", "not_a_title"],
      [3, "•", "not_a_title"],
      [4, "1.", "not_a_title"],
      [5, "()", "not_a_title"],
      [6, "[ ]", "not_a_title"],
      [7, "[x]", "not_a_title"],
      [8, "(✔)", "not_a_title"],
    ]);
  });

  it("skips a line that holds only an alternate search in brackets", () => {
    expect(read("(One Day)").skipped).toEqual([{ position: 0, original: "(One Day)", reason: "not_a_title" }]);
  });

  it("does not change the hints when it skips a line", () => {
    const { lines } = read("Movies\nhttps://example.com\n✔\nMoonlit Harbor");
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ kind: "movie" });
  });
});

describe("cleaning", () => {
  it("ignores blank lines", () => {
    const { lines, skipped } = read("\n\nMoonlit Harbor\n   \n\t\nPaper Lanterns\n\n");
    expect(skipped).toEqual([]);
    expect(lines.map((line) => line.query)).toEqual(["Moonlit Harbor", "Paper Lanterns"]);
  });

  it("ignores a line made of invisible characters only", () => {
    expect(read("​‌‍⁠﻿️ ")).toEqual({ lines: [], skipped: [] });
  });

  it("turns a no-break space into a space", () => {
    const line = readOne("Moonlit Harbor ✔");
    expect(line).toMatchObject({ query: "Moonlit Harbor", intent: "watched" });
    expect(readOne("  Moonlit    Harbor").query).toBe("Moonlit Harbor");
  });

  it("removes zero-width characters and the emoji selector", () => {
    const line = readOne("Moon​lit‌ Har‍bor⁠️");
    expect(line.query).toBe("Moonlit Harbor");
  });

  it("removes a byte-order mark at the start of the paste", () => {
    expect(readOne("﻿Moonlit Harbor")).toMatchObject({ query: "Moonlit Harbor" });
  });

  it("recognises a heading that holds invisible characters", () => {
    expect(readOne("T​v -\nMoonlit Harbor")).toMatchObject({ kind: "series" });
  });

  it("normalises the text to NFC", () => {
    const line = readOne("Café Noir");
    expect(line.query).toBe("Café Noir");
    expect(line.original).toBe("Café Noir");
  });

  it("joins an accent to its letter when an invisible character sat between them", () => {
    expect(readOne("Cafe​́ Noir").query).toBe("Café Noir");
  });

  it("reads \\r\\n, \\n and \\r as line ends", () => {
    const { lines } = read("Moonlit Harbor\r\nPaper Lanterns\rGlass Garden\nLong Pier");
    expect(lines.map((line) => [line.position, line.query])).toEqual([
      [0, "Moonlit Harbor"],
      [1, "Paper Lanterns"],
      [2, "Glass Garden"],
      [3, "Long Pier"],
    ]);
  });

  it("does not count \\r\\n as two lines", () => {
    const { lines } = read("Tv -\r\n\r\nMoonlit Harbor\r\n");
    expect(lines).toHaveLength(1);
    expect(lines[0].position).toBe(2);
  });

  it("collapses runs of spaces and removes trailing punctuation", () => {
    expect(readOne("Moonlit    Harbor ,  ;. ").query).toBe("Moonlit Harbor");
    expect(readOne("Moonlit Harbor,").query).toBe("Moonlit Harbor");
    expect(readOne("Moonlit Harbor.").query).toBe("Moonlit Harbor");
    expect(readOne("Moonlit Harbor;").query).toBe("Moonlit Harbor");
  });

  it("keeps punctuation inside a Title", () => {
    expect(readOne("Mission: Moonlit - Part 2!").query).toBe("Mission: Moonlit - Part 2!");
    expect(readOne("Tide & Tallow").query).toBe("Tide & Tallow");
  });
});

describe("id, position and original", () => {
  it("counts only Import lines for id and every line for position", () => {
    const text = ["Tv -", "", "Moonlit Harbor", "Something:", "https://example.com", "Paper Lanterns", "✔"].join("\n");
    const { lines, skipped } = read(text);
    expect(lines.map((line) => [line.id, line.position, line.query])).toEqual([
      [0, 2, "Moonlit Harbor"],
      [1, 5, "Paper Lanterns"],
    ]);
    expect(skipped.map((line) => line.position)).toEqual([4, 6]);
  });

  it("keeps the pasted line trimmed but otherwise unchanged as original", () => {
    expect(readOne("  - Moonlit Harbor(2002) ✔️  \t").original).toBe("- Moonlit Harbor(2002) ✔️");
    expect(readOne(" Moonlit Harbor ").original).toBe("Moonlit Harbor");
    expect(readOne("Moon​lit Harbor").original).toBe("Moon​lit Harbor");
  });

  it("keeps repeats as separate Import lines", () => {
    const { lines } = read("Moonlit Harbor ✔\nMoonlit Harbor");
    expect(lines.map((line) => [line.id, line.query, line.intent])).toEqual([
      [0, "Moonlit Harbor", "watched"],
      [1, "Moonlit Harbor", "to_watch"],
    ]);
  });
});

describe("the search text cap", () => {
  it("cuts the query at 100 code points", () => {
    const line = readOne("a".repeat(150));
    expect(line.query).toBe("a".repeat(MAX_QUERY_CHARACTERS));
  });

  it("does not cut an emoji in half at the boundary", () => {
    const text = `${"a".repeat(MAX_QUERY_CHARACTERS - 1)}\u{1F600}bbb`;
    const { query } = readOne(text);
    expect(codePoints(query)).toBe(MAX_QUERY_CHARACTERS);
    expect(query.endsWith("\u{1F600}")).toBe(true);
    expect(query).toBe(`${"a".repeat(MAX_QUERY_CHARACTERS - 1)}\u{1F600}`);
  });

  it("drops a space that the cut leaves at the end", () => {
    const { query } = readOne(`${"a".repeat(MAX_QUERY_CHARACTERS - 1)} bbb`);
    expect(query).toBe("a".repeat(MAX_QUERY_CHARACTERS - 1));
  });

  it("cuts the alternate search at 100 code points too", () => {
    const line = readOne(`Um Dia (${"b".repeat(150)})`);
    expect(line.query).toBe("Um Dia");
    expect(line.altQuery).toBe("b".repeat(MAX_QUERY_CHARACTERS));
  });

  it("keeps a query of exactly 100 code points whole", () => {
    const text = `${"a".repeat(MAX_QUERY_CHARACTERS - 1)}\u{1F600}`;
    expect(readOne(text).query).toBe(text);
  });
});

describe("a whole note", () => {
  it("reads a note with two sections, marks, repeats and a URL", () => {
    const note = [
      "Tv - ",
      "Paper Lanterns ✔",
      "Harbor Lights (2011)",
      "- Quiet Orchard 1 and 2",
      "",
      "Movies- ",
      "Glass Garden(2002)✔️",
      "1. The Long Pier",
      "Um Dia(One Day) ✔ ✔",
      "",
      "https://example.com/my-list",
      "All Lantern movies",
      "Paper Lanterns",
      "Salt Road (series)",
      "Tide Pool (malayalam) ☐",
    ].join("\n");

    expect(read(note)).toStrictEqual({
      lines: [
        {
          id: 0,
          position: 1,
          original: "Paper Lanterns ✔",
          query: "Paper Lanterns",
          kind: "series",
          intent: "watched",
          several: false,
        },
        {
          id: 1,
          position: 2,
          original: "Harbor Lights (2011)",
          query: "Harbor Lights",
          year: 2011,
          kind: "series",
          intent: "to_watch",
          several: false,
        },
        {
          id: 2,
          position: 3,
          original: "- Quiet Orchard 1 and 2",
          query: "Quiet Orchard",
          kind: "series",
          intent: "to_watch",
          several: true,
        },
        {
          id: 3,
          position: 6,
          original: "Glass Garden(2002)✔️",
          query: "Glass Garden",
          year: 2002,
          kind: "movie",
          intent: "watched",
          several: false,
        },
        {
          id: 4,
          position: 7,
          original: "1. The Long Pier",
          query: "The Long Pier",
          kind: "movie",
          intent: "to_watch",
          several: false,
        },
        {
          id: 5,
          position: 8,
          original: "Um Dia(One Day) ✔ ✔",
          query: "Um Dia",
          altQuery: "One Day",
          kind: "movie",
          intent: "watched",
          several: false,
        },
        {
          id: 6,
          position: 11,
          original: "All Lantern movies",
          query: "All Lantern movies",
          kind: "movie",
          intent: "to_watch",
          several: true,
        },
        {
          id: 7,
          position: 12,
          original: "Paper Lanterns",
          query: "Paper Lanterns",
          kind: "movie",
          intent: "to_watch",
          several: false,
        },
        {
          id: 8,
          position: 13,
          original: "Salt Road (series)",
          query: "Salt Road",
          kind: "series",
          intent: "to_watch",
          several: false,
        },
        {
          id: 9,
          position: 14,
          original: "Tide Pool (malayalam) ☐",
          query: "Tide Pool",
          kind: "movie",
          intent: "to_watch",
          several: false,
        },
      ],
      skipped: [{ position: 10, original: "https://example.com/my-list", reason: "not_a_title" }],
    });
  });
});
