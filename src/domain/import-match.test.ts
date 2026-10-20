import { describe, expect, it, vi } from "vitest";
import {
  compactName,
  CONTAINED_NAME_SCORE,
  KIND_HINT_WEIGHT,
  matchLine,
  MAX_CANDIDATES,
  MIN_FOUND_POPULARITY,
  NAME_FLOOR,
  nameScore,
  normaliseName,
  POPULARITY_CAP,
  rankMatches,
  YEAR_AGAINST_PENALTY,
  YEAR_AGREES_BONUS,
  type MatchCandidate,
} from "./import-match";

type Fake = MatchCandidate & { posterPath: string | null };

// Well above the floor for Found, so a test only meets the floor when it sets a popularity itself.
const POPULARITY = 10;

let nextId = 1;

function title(name: string, extra: Partial<Fake> = {}): Fake {
  return {
    kind: "movie",
    tmdbId: nextId++,
    name,
    originalName: null,
    year: null,
    popularity: POPULARITY,
    posterPath: null,
    ...extra,
  };
}

function line(query: string, extra: { year?: number; kind?: "movie" | "series"; several?: boolean } = {}) {
  return { query, several: false, ...extra };
}

function names(ranking: { candidates: { title: { name: string } }[] }): string[] {
  return ranking.candidates.map((candidate) => candidate.title.name);
}

describe("normaliseName", () => {
  it.each([
    ["Amélie", "amelie"],
    ["Pokémon: Détective Pikachu", "pokemon detective pikachu"],
    ["Fast & Furious", "fast and furious"],
    ["Schindler’s List", "schindlers list"],
    ["Ocean's Eleven", "oceans eleven"],
    ["Rock‘n’roll", "rocknroll"],
    ["Don`t Look Up", "dont look up"],
    ["Bʼz", "bz"],
    ["Mission: Impossible – Fallout", "mission impossible fallout"],
    ["Spider-Man", "spider man"],
    ["  The   Simpsons  ", "simpsons"],
    ["A Quiet Place", "quiet place"],
    ["An Education", "education"],
    ["The The", "the"],
    ["The", "the"],
    ["Theodore Rex", "theodore rex"],
    ["Ａｍｅｌｉｅ", "amelie"],
    ["İstanbul", "istanbul"],
  ])("normalises %j to %j", (input, expected) => {
    expect(normaliseName(input)).toBe(expected);
  });

  it("removes the spaces in the compact form", () => {
    expect(compactName("West world")).toBe("westworld");
    expect(compactName("Westworld")).toBe("westworld");
    expect(compactName("The Lord of the Rings")).toBe("lordoftherings");
  });
});

describe("nameScore", () => {
  it("is 1 when the normalised forms are equal", () => {
    expect(nameScore("simpsons", "The Simpsons")).toBe(1);
  });

  it("is 1 when only the compact forms are equal", () => {
    expect(nameScore("West world", "Westworld")).toBe(1);
    expect(nameScore("Old boy", "Oldboy")).toBe(1);
  });

  it("is the Dice coefficient of the compact forms' character pairs otherwise", () => {
    // zo di ia ac / zo di ia ak: 3 pairs shared of 5 + 5.
    expect(nameScore("Zodiac", "Zodiak")).toBeCloseTo(0.8, 10);
    // Repeated pairs count as often as they appear in both: aa aa / aa.
    expect(nameScore("aaa", "aa")).toBeCloseTo(2 / 3, 10);
  });

  it("stays below 1 for different names made of the same character pairs", () => {
    // ab ba ac ca against ac ca ab ba: every pair is shared, yet the names differ.
    expect(nameScore("abaca", "acaba")).toBeLessThan(1);
    expect(nameScore("Ananta", "Antana")).toBeLessThan(1);
  });

  it("is 0 when either side has fewer than 2 characters to compare", () => {
    expect(nameScore("M", "Mx")).toBe(0);
    expect(nameScore("Mx", "M")).toBe(0);
  });

  it("is 0 when either side has no letters or digits, so punctuation never matches punctuation", () => {
    expect(nameScore("?!", "...")).toBe(0);
    expect(nameScore("?!", "Up")).toBe(0);
  });

  describe("when one name holds the other's whole words at its start or end", () => {
    it("exports a floor below 1", () => {
      expect(CONTAINED_NAME_SCORE).toBe(0.8);
    });

    it.each([
      ["Hobbs and Shaw", "Fast & Furious Presents: Hobbs & Shaw"],
      ["Shang chi", "Shang-Chi and the Legend of the Ten Rings"],
      ["Manhunt Unabomber", "Manhunt"],
    ])("scores %j against %j at the floor, whichever side is longer", (a, b) => {
      expect(nameScore(a, b)).toBe(CONTAINED_NAME_SCORE);
      expect(nameScore(b, a)).toBe(CONTAINED_NAME_SCORE);
    });

    it("lifts a prefix and a suffix of two words, and a prefix of one word with 6 letters", () => {
      expect(nameScore("Big Fish", "Big Fish and Begonia")).toBe(CONTAINED_NAME_SCORE);
      expect(nameScore("Big Fish", "The Giant Big Fish")).toBe(CONTAINED_NAME_SCORE);
      expect(nameScore("Matrix", "Matrix Reloaded")).toBe(CONTAINED_NAME_SCORE);
    });

    it("ignores a leading article, accents and punctuation when it lines the words up", () => {
      expect(nameScore("The Quiet Orchard", "Quiet Orchard Returns")).toBe(CONTAINED_NAME_SCORE);
      expect(nameScore("Amelie Poulain", "Le Fabuleux Destin: Amélie Poulain")).toBe(CONTAINED_NAME_SCORE);
    });

    it("keeps a higher character-pair score", () => {
      const score = nameScore("Mission Impossible Fallout", "Mission Impossible Fallout 7");
      expect(score).toBeGreaterThan(CONTAINED_NAME_SCORE);
      expect(score).toBeLessThan(1);
    });

    it("does not lift a single short word", () => {
      expect(nameScore("Run", "Run Lola Run")).toBeLessThan(CONTAINED_NAME_SCORE);
      expect(nameScore("Alien", "Alien Nation")).toBeLessThan(NAME_FLOOR);
      expect(nameScore("Heat", "Heat Wave")).toBeLessThanOrEqual(NAME_FLOOR);
    });

    it("does not lift words found only in the middle", () => {
      expect(nameScore("Lantern Garden", "Glass Lantern Garden Keeper")).toBeLessThan(CONTAINED_NAME_SCORE);
      expect(nameScore("Lantern", "Glass Lantern Keeper")).toBeLessThan(CONTAINED_NAME_SCORE);
    });

    it("does not lift words that match only part of a word", () => {
      expect(nameScore("Shang", "Shanghai Blues")).toBeLessThan(CONTAINED_NAME_SCORE);
      expect(nameScore("Moonlit", "Moonlitting Harbor")).toBeLessThan(CONTAINED_NAME_SCORE);
    });

    it("does not lift words in a different order", () => {
      expect(nameScore("Shaw and Hobbs", "Fast & Furious Presents: Hobbs & Shaw")).toBeLessThan(CONTAINED_NAME_SCORE);
    });

    it("still scores 1 for equal names", () => {
      expect(nameScore("Hobbs and Shaw", "Hobbs & Shaw")).toBe(1);
    });
  });
});

describe("rankMatches", () => {
  it("finds an exact name", () => {
    const inception = title("Inception", { popularity: 80 });
    const ranking = rankMatches(line("Inception"), [title("Inception: The Cobol Job"), inception]);
    expect(ranking.result).toBe("found");
    expect(ranking.candidates[0]).toMatchObject({ title: inception, nameScore: 1 });
  });

  it("hands back the caller's own objects", () => {
    const inception = title("Inception", { posterPath: "/p.jpg" });
    const ranking = rankMatches(line("Inception"), [inception]);
    expect(ranking.candidates[0].title).toBe(inception);
  });

  it("finds a name typed with a space in it", () => {
    expect(rankMatches(line("West world"), [title("Westworld", { kind: "series" })]).result).toBe("found");
  });

  it("finds a name typed without its leading article", () => {
    expect(rankMatches(line("Simpsons"), [title("The Simpsons", { kind: "series" })]).result).toBe("found");
  });

  it("finds a name typed without accents or with 'and' for '&'", () => {
    expect(rankMatches(line("Amelie"), [title("Amélie")]).result).toBe("found");
    expect(rankMatches(line("Fast and Furious"), [title("Fast & Furious")]).result).toBe("found");
  });

  it("never finds a different name made of the same character pairs", () => {
    const ranking = rankMatches(line("Ananta"), [title("Antana", { popularity: 80 })]);
    expect(ranking.result).toBe("check");
    expect(ranking.candidates[0].nameScore).toBeLessThan(1);
  });

  it("asks to check a typo", () => {
    const shawshank = title("The Shawshank Redemption");
    const ranking = rankMatches(line("Shawshank Redemtion"), [shawshank]);
    expect(ranking.result).toBe("check");
    expect(ranking.candidates[0].title).toBe(shawshank);
    expect(ranking.candidates[0].nameScore).toBeGreaterThan(NAME_FLOOR);
    expect(ranking.candidates[0].nameScore).toBeLessThan(1);
  });

  it("finds nothing just under the name floor, and still offers the candidates", () => {
    const nation = title("Alien Nation");
    const ranking = rankMatches(line("Alien"), [nation]);
    expect(ranking.candidates[0].nameScore).toBeLessThan(NAME_FLOOR);
    expect(ranking).toEqual({ result: "not_found", candidates: [expect.objectContaining({ title: nation })] });
  });

  it("asks to check a longer official name that holds the line's whole words, never finds it", () => {
    const official = title("Fast & Furious Presents: Hobbs & Shaw", { popularity: 80 });
    const ranking = rankMatches(line("Hobbs and Shaw"), [official]);
    expect(ranking.result).toBe("check");
    expect(ranking.candidates[0]).toMatchObject({ title: official, nameScore: CONTAINED_NAME_SCORE });
  });

  it("keeps a found line found when a longer name holds its words", () => {
    const exact = title("Manhunt", { kind: "series", popularity: 40 });
    const longer = title("Manhunt Unabomber", { kind: "series", popularity: 90 });
    const ranking = rankMatches(line("Manhunt", { kind: "series" }), [longer, exact]);
    expect(ranking.result).toBe("found");
    expect(ranking.candidates[0].title).toBe(exact);
  });

  it("asks to check at the name floor and just over it", () => {
    const atFloor = rankMatches(line("Lost"), [title("Lost Girl", { kind: "series" })]);
    expect(atFloor.candidates[0].nameScore).toBe(NAME_FLOOR);
    expect(atFloor.result).toBe("check");
    expect(rankMatches(line("Frozen"), [title("Frozen Fever")]).result).toBe("check");
  });

  it("finds nothing when the search has no results", () => {
    expect(rankMatches(line("Anything"), [])).toEqual({ result: "not_found", candidates: [] });
  });

  it("asks to check a Movie and a Series with the same name and close popularity", () => {
    const movie = title("Fargo", { kind: "movie", popularity: 20 });
    const series = title("Fargo", { kind: "series", popularity: 30 });
    const ranking = rankMatches(line("Fargo"), [movie, series]);
    expect(ranking.result).toBe("check");
    expect(names(ranking)).toEqual(["Fargo", "Fargo"]);
    expect(ranking.candidates[0].title).toBe(series);
  });

  it("finds the popular one of a Movie and a Series with the same name and far apart popularity", () => {
    const movie = title("Chernobyl", { kind: "movie", popularity: 2 });
    const series = title("Chernobyl", { kind: "series", popularity: 90 });
    const ranking = rankMatches(line("Chernobyl"), [movie, series]);
    expect(ranking.result).toBe("found");
    expect(ranking.candidates[0].title).toBe(series);
  });

  it("asks to check when a rival with the same name has at least a third of the popularity", () => {
    const best = title("Dark", { kind: "series", popularity: 30 });
    const rival = title("Dark", { kind: "movie", popularity: 10 });
    expect(rankMatches(line("Dark"), [best, rival]).result).toBe("check");
    const fainter = title("Dark", { kind: "movie", popularity: 9.9 });
    expect(rankMatches(line("Dark"), [best, fainter]).result).toBe("found");
  });

  it("asks to check two Titles with the same name and the same popularity", () => {
    expect(rankMatches(line("Dark"), [title("Dark"), title("Dark")]).result).toBe("check");
  });

  it("asks to check an exact name too obscure to be sure of", () => {
    const atFloor = title("Old Boy", { popularity: MIN_FOUND_POPULARITY });
    expect(rankMatches(line("Old boy"), [atFloor]).result).toBe("found");
    const obscure = title("Old Boy", { popularity: MIN_FOUND_POPULARITY - 0.01 });
    const ranking = rankMatches(line("Old boy"), [obscure]);
    expect(ranking.result).toBe("check");
    expect(ranking.candidates[0].title).toBe(obscure);
  });

  it("asks to check an exact name when no search result says how popular it is", () => {
    expect(rankMatches(line("Dark"), [title("Dark", { popularity: 0 })]).result).toBe("check");
  });

  it("keeps a Title whose kind disagrees with the hint, but asks to check it", () => {
    const movie = title("Inception", { kind: "movie", popularity: 80 });
    const ranking = rankMatches(line("Inception", { kind: "series" }), [movie]);
    expect(ranking.result).toBe("check");
    expect(ranking.candidates[0]).toMatchObject({ title: movie, hintAgainst: true });
  });

  it("puts the hinted kind first, but asks to check when the other kind with the same name is about as popular", () => {
    const movie = title("Fargo", { kind: "movie", popularity: 20 });
    const series = title("Fargo", { kind: "series", popularity: 30 });
    const ranking = rankMatches(line("Fargo", { kind: "movie" }), [series, movie]);
    expect(ranking.result).toBe("check");
    expect(ranking.candidates[0].title).toBe(movie);
    expect(ranking.candidates[0].score).toBeCloseTo(1 + KIND_HINT_WEIGHT + popularityBonus(20), 10);
    expect(ranking.candidates[1].score).toBeCloseTo(1 - KIND_HINT_WEIGHT + popularityBonus(30), 10);
  });

  it("asks to check when the hinted kind's Title is dwarfed by the other kind with the same name", () => {
    const movie = title("Chernobyl", { kind: "movie", year: 2005, popularity: 3 });
    const series = title("Chernobyl", { kind: "series", year: 2019, popularity: 40 });
    const ranking = rankMatches(line("Chernobyl", { kind: "movie" }), [series, movie]);
    expect(ranking.result).toBe("check");
    expect(ranking.candidates[0].title).toBe(movie);
  });

  it("finds the hinted kind when the other kind with the same name is far less popular", () => {
    const movie = title("Westworld", { kind: "movie", popularity: 9 });
    const series = title("Westworld", { kind: "series", popularity: 96 });
    const ranking = rankMatches(line("Westworld", { kind: "series" }), [movie, series]);
    expect(ranking.result).toBe("found");
    expect(ranking.candidates[0].title).toBe(series);
  });

  it("adds to the score when the year is within one of the hint", () => {
    const ranking = rankMatches(line("Inception", { year: 2010 }), [title("Inception", { year: 2011 })]);
    expect(ranking.result).toBe("found");
    expect(ranking.candidates[0].score).toBeCloseTo(1 + YEAR_AGREES_BONUS + popularityBonus(POPULARITY), 10);
  });

  it("asks to check an exact name whose year is 3 off the hint", () => {
    const ranking = rankMatches(line("Inception", { year: 2013 }), [title("Inception", { year: 2010 })]);
    expect(ranking.result).toBe("check");
    expect(ranking.candidates[0].score).toBeCloseTo(1 - YEAR_AGAINST_PENALTY + popularityBonus(POPULARITY), 10);
    expect(ranking.candidates[0].hintAgainst).toBe(true);
  });

  it("neither adds nor takes off for a Title without a year, but asks to check it when the line gives one", () => {
    const ranking = rankMatches(line("Inception", { year: 2010 }), [title("Inception", { year: null })]);
    expect(ranking.result).toBe("check");
    expect(ranking.candidates[0].score).toBeCloseTo(1 + popularityBonus(POPULARITY), 10);
    expect(ranking.candidates[0].hintAgainst).toBe(false);
  });

  it("asks to check an exact name without a year over a near name in the line's year", () => {
    const yearless = title("Nomad", { year: null });
    const dated = title("Nomads", { year: 2002 });
    const ranking = rankMatches(line("Nomad", { year: 2002 }), [dated, yearless]);
    expect(ranking.candidates.map((candidate) => candidate.title)).toEqual([yearless, dated]);
    expect(ranking.result).toBe("check");
  });

  it("still finds an exact name without a year when the line gives no year", () => {
    expect(rankMatches(line("Nomad"), [title("Nomad", { year: null })]).result).toBe("found");
  });

  // A year is the Owner's own word on the line, so a Title it rules out is not a rival, however popular.
  it("finds the one of two exact names whose year matches the hint", () => {
    const remake = title("Dune", { year: 2021, popularity: 10 });
    const original = title("Dune", { year: 1984, popularity: 40 });
    const ranking = rankMatches(line("Dune", { year: 2021 }), [original, remake]);
    expect(ranking.result).toBe("found");
    expect(ranking.candidates[0].title).toBe(remake);
  });

  it("never finds a line that names several Titles", () => {
    const ranking = rankMatches(line("Dune", { several: true }), [title("Dune", { popularity: 50 })]);
    expect(ranking.result).toBe("check");
  });

  it("matches the original name", () => {
    const umDia = title("One Day", { originalName: "Um Dia" });
    const ranking = rankMatches(line("Um Dia"), [umDia]);
    expect(ranking.result).toBe("found");
    expect(ranking.candidates[0]).toMatchObject({ title: umDia, nameScore: 1 });
  });

  it("caps the popularity bonus and ignores popularity that is not a number of 0 or more", () => {
    const [huge, none, broken] = rankMatches(line("Heat"), [
      title("Heat", { popularity: 1e9 }),
      title("Heat", { popularity: 0 }),
      title("Heat", { popularity: Number.NaN }),
    ]).candidates;
    expect(huge.score).toBeCloseTo(1 + POPULARITY_CAP, 10);
    expect(none.score).toBe(1);
    expect(broken.score).toBe(1);
    expect(rankMatches(line("Heat"), [title("Heat", { popularity: -5 })]).candidates[0].score).toBe(1);
  });

  it("never lets popularity lift a clearly weaker name above an exact one", () => {
    const exact = title("Heat", { popularity: 0 });
    const popular = title("Heats", { popularity: 1e6 });
    expect(rankMatches(line("Heat"), [popular, exact]).candidates[0].title).toBe(exact);
  });

  it("offers the best 3, best first, and keeps the search order for ties", () => {
    const results = [title("Seven Pounds"), title("Seven"), title("Sevens"), title("Seven"), title("Se7en")];
    const ranking = rankMatches(line("Seven"), results);
    expect(ranking.candidates).toHaveLength(MAX_CANDIDATES);
    expect(ranking.candidates.map((candidate) => candidate.title)).toEqual([results[1], results[3], results[2]]);
  });

  it("scores against the text it is given instead of the query", () => {
    const umDia = title("Um Dia");
    expect(rankMatches(line("One Day"), [umDia], "Um Dia").result).toBe("found");
  });
});

describe("matchLine", () => {
  function searchFrom(results: Record<string, Fake[]>) {
    return vi.fn(async (text: string) => results[text] ?? []);
  }

  it("uses the alternate text's results when the main text finds nothing and they are found", async () => {
    const umDia = title("Um Dia", { originalName: "Um Dia" });
    const search = searchFrom({ "One Day": [title("Another Story")], "Um Dia": [umDia] });
    const match = await matchLine({ query: "One Day", altQuery: "Um Dia", several: false }, search);
    expect(match).toMatchObject({ result: "found", fromAltQuery: true });
    expect(match.candidates[0].title).toBe(umDia);
    expect(search.mock.calls).toEqual([["One Day"], ["OneDay"], ["Um Dia"]]);
  });

  it("keeps the main results when the alternate text is not found either", async () => {
    const other = title("Another Story");
    const search = searchFrom({ "One Day": [other], "Um Dia": [title("Um Dia", { kind: "series" })] });
    const match = await matchLine({ query: "One Day", altQuery: "Um Dia", kind: "movie", several: false }, search);
    expect(match).toMatchObject({ result: "not_found", fromAltQuery: false });
    expect(match.candidates.map((candidate) => candidate.title)).toEqual([other]);
    expect(search.mock.calls).toEqual([["One Day"], ["OneDay"], ["Um Dia"]]);
  });

  // A bracket note such as `(Netflix)` is alternate text too, and must never turn a line the
  // Owner has to check into a sure Match with an unrelated Title of that name.
  it("does not search the alternate text when the main results ask to check", async () => {
    const remake = title("Dune", { year: 2021, popularity: 50 });
    const original = title("Dune", { year: 1984, popularity: 40 });
    const search = searchFrom({ Dune: [remake, original], Netflix: [title("Netflix", { popularity: 30 })] });
    const match = await matchLine({ query: "Dune", altQuery: "Netflix", several: false }, search);
    expect(match).toMatchObject({ result: "check", fromAltQuery: false });
    expect(match.candidates.map((candidate) => candidate.title)).toEqual([remake, original]);
    expect(search.mock.calls).toEqual([["Dune"]]);
  });

  it("does not search the alternate text when the main text is found", async () => {
    const search = searchFrom({ "One Day": [title("One Day")] });
    const match = await matchLine({ query: "One Day", altQuery: "Um Dia", several: false }, search);
    expect(match).toMatchObject({ result: "found", fromAltQuery: false });
    expect(search).toHaveBeenCalledTimes(1);
  });

  it("does not search the alternate text for a line that names several Titles", async () => {
    const search = searchFrom({ "One Day": [title("One Day Later")], "Um Dia": [title("Um Dia")] });
    const match = await matchLine({ query: "One Day", altQuery: "Um Dia", several: true }, search);
    expect(match.result).toBe("check");
    expect(search).toHaveBeenCalledTimes(1);
  });

  it("searches once for a one-word line without alternate text", async () => {
    const search = searchFrom({});
    expect(await matchLine({ query: "Dune", several: false }, search)).toEqual({
      result: "not_found",
      candidates: [],
      fromAltQuery: false,
    });
    expect(search).toHaveBeenCalledTimes(1);
  });

  it("passes a failed search on to the caller", async () => {
    const failure = new Error("search failed");
    await expect(
      matchLine({ query: "One Day", several: false }, async () => Promise.reject(failure)),
    ).rejects.toBe(failure);
    const search = vi.fn(async (text: string) => (text === "Um Dia" ? Promise.reject(failure) : []));
    await expect(matchLine({ query: "One Day", altQuery: "Um Dia", several: false }, search)).rejects.toBe(failure);
  });

  describe("the joined-up search", () => {
    it("finds a name typed with a space only through the joined search", async () => {
      const westworld = title("Westworld", { kind: "series", popularity: 96 });
      const search = searchFrom({ "West world": [title("Wild West", { kind: "series" })], Westworld: [westworld] });
      const west = { query: "West world", kind: "series" as const, several: false };
      expect(rankMatches(west, [title("Wild West", { kind: "series" })]).result).toBe("not_found");

      const match = await matchLine(west, search);
      expect(match).toMatchObject({ result: "found", fromAltQuery: false });
      expect(match.candidates[0]).toMatchObject({ title: westworld, nameScore: 1 });
      expect(search.mock.calls).toEqual([["West world"], ["Westworld"]]);
    });

    it("keeps the case and the letters and drops only the spaces", async () => {
      const search = searchFrom({});
      await matchLine({ query: "Old  Boy  Two", several: false }, search);
      expect(search.mock.calls).toEqual([["Old  Boy  Two"], ["OldBoyTwo"]]);
    });

    it("merges the joined results into the main ones without repeating a Title, main results first", async () => {
      const obscure = title("West World", { kind: "movie", popularity: 0.5 });
      const westworld = title("Westworld", { kind: "series", popularity: 96 });
      const other = title("West Side Story", { kind: "movie" });
      const search = searchFrom({ "West world": [obscure, other], Westworld: [westworld, { ...obscure }] });
      const match = await matchLine({ query: "West world", kind: "series", several: false }, search);
      expect(match.result).toBe("found");
      expect(match.candidates.map((candidate) => candidate.title)).toEqual([westworld, obscure, other]);
    });

    it("lets the main results lead when they tie with the joined ones", async () => {
      const first = title("Westworld", { kind: "series", popularity: 0 });
      const second = title("Westworld", { kind: "movie", popularity: 0, tmdbId: first.tmdbId + 1000 });
      const search = searchFrom({ "West world": [first], Westworld: [second] });
      const match = await matchLine({ query: "West world", several: false }, search);
      expect(match.candidates.map((candidate) => candidate.title)).toEqual([first, second]);
    });

    it("asks to check when the joined results hold two same-name rivals", async () => {
      const series = title("Westworld", { kind: "series", popularity: 50 });
      const movie = title("Westworld", { kind: "movie", popularity: 40 });
      const search = searchFrom({ Westworld: [series, movie] });
      const match = await matchLine({ query: "West world", kind: "series", several: false }, search);
      expect(match.result).toBe("check");
      expect(match.candidates.map((candidate) => candidate.title)).toEqual([series, movie]);
    });

    it("asks to check when a main result and a joined result are same-name rivals", async () => {
      const movie = title("West World", { kind: "movie", popularity: 40 });
      const series = title("Westworld", { kind: "series", popularity: 50 });
      const search = searchFrom({ "West world": [movie], Westworld: [series] });
      const west = { query: "West world", kind: "series" as const, several: false };
      expect(rankMatches(west, [movie]).result).toBe("check");

      const match = await matchLine(west, search);
      expect(match.result).toBe("check");
      expect(match.candidates.map((candidate) => candidate.title)).toEqual([series, movie]);
    });

    it("does not search the joined text for a one-word query", async () => {
      const search = searchFrom({});
      await matchLine({ query: "Westworld", several: false }, search);
      expect(search.mock.calls).toEqual([["Westworld"]]);
    });

    it("does not search the joined text when the main results are found", async () => {
      const search = searchFrom({ "Old boy": [title("Old Boy", { popularity: 20 })] });
      const match = await matchLine({ query: "Old boy", several: false }, search);
      expect(match.result).toBe("found");
      expect(search.mock.calls).toEqual([["Old boy"]]);
    });

    it("does not search the joined text for a line that names several Titles", async () => {
      const search = searchFrom({ Westworld: [title("Westworld", { kind: "series" })] });
      const match = await matchLine({ query: "West world", several: true }, search);
      expect(match.result).toBe("not_found");
      expect(search.mock.calls).toEqual([["West world"]]);
    });

    it("searches the alternate text after the joined text finds nothing, and its results win when found", async () => {
      const umDia = title("Um Dia", { popularity: 20 });
      const search = searchFrom({ "Um Dia": [umDia] });
      const match = await matchLine({ query: "One Day", altQuery: "Um Dia", several: false }, search);
      expect(match).toMatchObject({ result: "found", fromAltQuery: true });
      expect(match.candidates[0].title).toBe(umDia);
      expect(search.mock.calls).toEqual([["One Day"], ["OneDay"], ["Um Dia"]]);
    });

    it("does not search the alternate text when the merged results ask to check", async () => {
      const joined = title("Oneday", { popularity: 0 });
      const search = searchFrom({ OneDay: [joined], "Um Dia": [title("Um Dia", { popularity: 20 })] });
      const match = await matchLine({ query: "One Day", altQuery: "Um Dia", several: false }, search);
      expect(match).toMatchObject({ result: "check", fromAltQuery: false });
      expect(match.candidates.map((candidate) => candidate.title)).toEqual([joined]);
      expect(search.mock.calls).toEqual([["One Day"], ["OneDay"]]);
    });

    it("passes a failed joined search on to the caller", async () => {
      const failure = new Error("search failed");
      const search = vi.fn(async (text: string) => (text === "OneDay" ? Promise.reject(failure) : []));
      await expect(matchLine({ query: "One Day", several: false }, search)).rejects.toBe(failure);
    });
  });
});

function popularityBonus(popularity: number): number {
  return Math.min(POPULARITY_CAP, (POPULARITY_CAP * Math.log10(1 + popularity)) / 3);
}
