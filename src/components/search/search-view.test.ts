import { describe, expect, it } from "vitest";
import type { SearchItem } from "@/data/dto";
import { deriveSearchView, repliesFromCache, type LibraryReply, type TmdbReply } from "./search-view";

const item = (tmdbId: number, kind: SearchItem["kind"] = "movie", entry: SearchItem["entry"] = null): SearchItem => ({
  kind,
  tmdbId,
  name: `T${tmdbId}`,
  year: null,
  posterPath: null,
  entry,
});
const inLibrary = (tmdbId: number, kind: SearchItem["kind"] = "movie") =>
  item(tmdbId, kind, { id: `e${tmdbId}`, status: "watched" });

const lib = (items: SearchItem[] | null, query = "dune"): LibraryReply => ({ query, items });
const tmdbOk = (items: SearchItem[], query = "dune"): TmdbReply => ({ query, ok: true, items });
const tmdbFail: TmdbReply = { query: "dune", ok: false, message: "down", signedOut: false };

describe("deriveSearchView", () => {
  it("is idle below two characters", () => {
    expect(deriveSearchView(" d ", null, null)).toEqual({ phase: "idle" });
  });

  it("is loading with no rows before any reply", () => {
    expect(deriveSearchView("dune", null, null)).toEqual({ phase: "loading", library: [] });
  });

  it("shows a cache hit at once, as results", () => {
    const replies = repliesFromCache("dune", { library: [inLibrary(1)], tmdb: [item(2)] });
    expect(deriveSearchView(" Dune ".toLowerCase(), replies.library, replies.tmdb)).toEqual({
      phase: "results",
      query: "dune",
      library: [inLibrary(1)],
      items: [item(2)],
    });
  });

  it("shows Library rows while TMDB is still loading", () => {
    expect(deriveSearchView("dune", lib([inLibrary(1)]), null)).toEqual({ phase: "loading", library: [inLibrary(1)] });
  });

  it("stays loading when TMDB is empty and the Library answer is pending", () => {
    expect(deriveSearchView("dune", null, tmdbOk([]))).toEqual({ phase: "loading", library: [] });
  });

  it("shows the Library rows and the error when TMDB fails", () => {
    expect(deriveSearchView("dune", lib([inLibrary(1)]), tmdbFail)).toEqual({
      phase: "error",
      message: "down",
      signedOut: false,
      library: [inLibrary(1)],
    });
  });

  it("shows only TMDB rows when the Library request fails", () => {
    expect(deriveSearchView("dune", lib(null), tmdbOk([item(2)]))).toEqual({
      phase: "results",
      query: "dune",
      library: [],
      items: [item(2)],
    });
  });

  it("is empty only when both lists are empty and both replies are in", () => {
    expect(deriveSearchView("dune", lib([]), tmdbOk([]))).toEqual({ phase: "empty", query: "dune" });
  });

  it("removes TMDB rows already in the Library list, matching on kind and id", () => {
    const view = deriveSearchView("dune", lib([inLibrary(1)]), tmdbOk([item(1), item(1, "series"), item(3)]));
    expect(view).toMatchObject({ phase: "results", items: [item(1, "series"), item(3)] });
  });

  it("is results, not empty, when every TMDB row is also in the Library", () => {
    expect(deriveSearchView("dune", lib([inLibrary(1)]), tmdbOk([item(1)]))).toMatchObject({
      phase: "results",
      library: [inLibrary(1)],
      items: [],
    });
  });

  it("ignores replies for an older query", () => {
    const view = deriveSearchView("dune part", lib([inLibrary(1)], "dune"), tmdbOk([item(2)], "dune"));
    expect(view).toEqual({ phase: "loading", library: [] });
    expect(deriveSearchView("dune part", lib([inLibrary(1)], "dune"), tmdbFail)).toEqual({ phase: "loading", library: [] });
  });
});
