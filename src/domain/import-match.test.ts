import { describe, expect, it, vi } from "vitest";
import {
  compactName,
  KIND_HINT_WEIGHT,
  matchLine,
  MAX_CANDIDATES,
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

let nextId = 1;

function title(name: string, extra: Partial<Fake> = {}): Fake {
  return {
    kind: "movie",
    tmdbId: nextId++,
    name,
    originalName: null,
    year: null,
    popularity: 0,
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

  it("is 0 when either side has fewer than 2 characters to compare", () => {
    expect(nameScore("M", "Mx")).toBe(0);
    expect(nameScore("Mx", "M")).toBe(0);
  });

  it("is 0 when either side has no letters or digits, so punctuation never matches punctuation", () => {
    expect(nameScore("?!", "...")).toBe(0);
    expect(nameScore("?!", "Up")).toBe(0);
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

  it("asks to check a typo", () => {
    const shawshank = title("The Shawshank Redemption");
    const ranking = rankMatches(line("Shawshank Redemtion"), [shawshank]);
    expect(ranking.result).toBe("check");
    expect(ranking.candidates[0].title).toBe(shawshank);
    expect(ranking.candidates[0].nameScore).toBeGreaterThan(NAME_FLOOR);
    expect(ranking.candidates[0].nameScore).toBeLessThan(1);
  });

  it("finds nothing just under the name floor, and still offers the candidates", () => {
    const reloaded = title("Matrix Reloaded");
    const ranking = rankMatches(line("Matrix"), [reloaded]);
    expect(ranking.candidates[0].nameScore).toBeLessThan(NAME_FLOOR);
    expect(ranking).toEqual({ result: "not_found", candidates: [expect.objectContaining({ title: reloaded })] });
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

  it("asks to check two Titles with the same name when neither has any popularity", () => {
    expect(rankMatches(line("Dark"), [title("Dark"), title("Dark")]).result).toBe("check");
  });

  it("keeps a Title whose kind disagrees with the hint, but asks to check it", () => {
    const movie = title("Inception", { kind: "movie", popularity: 80 });
    const ranking = rankMatches(line("Inception", { kind: "series" }), [movie]);
    expect(ranking.result).toBe("check");
    expect(ranking.candidates[0]).toMatchObject({ title: movie, hintAgainst: true });
  });

  it("lets the kind hint pick between a Movie and a Series with the same name", () => {
    const movie = title("Fargo", { kind: "movie", popularity: 20 });
    const series = title("Fargo", { kind: "series", popularity: 30 });
    const ranking = rankMatches(line("Fargo", { kind: "movie" }), [series, movie]);
    expect(ranking.result).toBe("found");
    expect(ranking.candidates[0].title).toBe(movie);
    expect(ranking.candidates[0].score).toBeCloseTo(1 + KIND_HINT_WEIGHT + popularityBonus(20), 10);
    expect(ranking.candidates[1].score).toBeCloseTo(1 - KIND_HINT_WEIGHT + popularityBonus(30), 10);
  });

  it("adds to the score when the year is within one of the hint", () => {
    const ranking = rankMatches(line("Inception", { year: 2010 }), [title("Inception", { year: 2011 })]);
    expect(ranking.result).toBe("found");
    expect(ranking.candidates[0].score).toBeCloseTo(1 + YEAR_AGREES_BONUS, 10);
  });

  it("asks to check an exact name whose year is 3 off the hint", () => {
    const ranking = rankMatches(line("Inception", { year: 2013 }), [title("Inception", { year: 2010 })]);
    expect(ranking.result).toBe("check");
    expect(ranking.candidates[0].score).toBeCloseTo(1 - YEAR_AGAINST_PENALTY, 10);
    expect(ranking.candidates[0].hintAgainst).toBe(true);
  });

  it("ignores the year hint for a Title without a year", () => {
    const ranking = rankMatches(line("Inception", { year: 2010 }), [title("Inception", { year: null })]);
    expect(ranking.result).toBe("found");
    expect(ranking.candidates[0]).toMatchObject({ score: 1, hintAgainst: false });
  });

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

  it("uses the alternate text's results when they are found", async () => {
    const umDia = title("Um Dia", { originalName: "Um Dia" });
    const search = searchFrom({ "One Day": [title("One Day Later")], "Um Dia": [umDia] });
    const match = await matchLine({ query: "One Day", altQuery: "Um Dia", several: false }, search);
    expect(match).toMatchObject({ result: "found", fromAltQuery: true });
    expect(match.candidates[0].title).toBe(umDia);
    expect(search.mock.calls).toEqual([["One Day"], ["Um Dia"]]);
  });

  it("keeps the main results when the alternate text is not found", async () => {
    const later = title("One Day Later");
    const search = searchFrom({ "One Day": [later], "Um Dia": [title("Um Dia", { kind: "series" })] });
    const match = await matchLine({ query: "One Day", altQuery: "Um Dia", kind: "movie", several: false }, search);
    expect(match).toMatchObject({ result: "check", fromAltQuery: false });
    expect(match.candidates.map((candidate) => candidate.title)).toEqual([later]);
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

  it("searches once for a line without alternate text", async () => {
    const search = searchFrom({});
    expect(await matchLine({ query: "One Day", several: false }, search)).toEqual({
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
});

function popularityBonus(popularity: number): number {
  return Math.min(POPULARITY_CAP, (POPULARITY_CAP * Math.log10(1 + popularity)) / 3);
}
