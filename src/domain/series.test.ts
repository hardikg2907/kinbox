import { describe, expect, it } from "vitest";
import {
  airedKeys,
  airedNumberedEpisodes,
  earlierUnwatched,
  episodesBefore,
  episodeKey,
  formatEpisode,
  isEpisodeAired,
  isFinished,
  isSpecial,
  numberedEpisodes,
  seasonEpisodes,
  summarizeProgress,
} from "./series";
import type { Episode, IsoDate, SeriesEpisodes } from "./types";

const TODAY: IsoDate = "2026-10-16";
const PAST: IsoDate = "2020-01-01";
const FUTURE: IsoDate = "2027-01-01";

type SeasonSpec = { n: number; eps: [episodeNumber: number, airDate?: IsoDate | null][] };

// Episodes default to a past air date so tests only spell out what matters.
function series(spec: { finished?: boolean; seasons: SeasonSpec[] }): SeriesEpisodes {
  return {
    finished: spec.finished ?? false,
    seasons: spec.seasons.map((season) => ({
      seasonNumber: season.n,
      episodes: season.eps.map(
        ([episodeNumber, airDate = PAST]): Episode => ({
          seasonNumber: season.n,
          episodeNumber,
          tmdbEpisodeId: season.n * 1000 + episodeNumber,
          name: null,
          airDate,
        }),
      ),
    })),
  };
}

const keys = (episodes: Episode[]) => episodes.map(episodeKey);

describe("episode keys and names", () => {
  it("builds the key watched sets use", () => {
    expect(episodeKey({ seasonNumber: 2, episodeNumber: 4 })).toBe("2:4");
  });

  it("treats only season 0 as a Special", () => {
    expect(isSpecial({ seasonNumber: 0, episodeNumber: 1 })).toBe(true);
    expect(isSpecial({ seasonNumber: 1, episodeNumber: 1 })).toBe(false);
  });

  it("formats numbered Episodes and Specials", () => {
    expect(formatEpisode({ seasonNumber: 2, episodeNumber: 4 })).toBe("S2 E4");
    expect(formatEpisode({ seasonNumber: 0, episodeNumber: 3 })).toBe("Special 3");
  });
});

describe("isFinished", () => {
  it.each(["Ended", "Canceled", "Cancelled"])("is true for %s", (status) => {
    expect(isFinished(status)).toBe(true);
  });

  it.each(["Returning Series", "In Production", "Planned", "Pilot", "ended", ""])(
    "is false for %j",
    (status) => {
      expect(isFinished(status)).toBe(false);
    },
  );

  it("is false when TMDB gave no status", () => {
    expect(isFinished(null)).toBe(false);
  });
});

describe("numberedEpisodes", () => {
  it("leaves out Specials", () => {
    const s = series({
      seasons: [
        { n: 0, eps: [[1]] },
        { n: 1, eps: [[1], [2]] },
      ],
    });
    expect(keys(numberedEpisodes(s))).toEqual(["1:1", "1:2"]);
  });

  it("returns broadcast order whatever the input order", () => {
    const s = series({
      seasons: [
        { n: 2, eps: [[2], [1]] },
        { n: 1, eps: [[3], [1], [2]] },
      ],
    });
    expect(keys(numberedEpisodes(s))).toEqual(["1:1", "1:2", "1:3", "2:1", "2:2"]);
  });

  it("returns nothing for a Series with no Episodes", () => {
    expect(numberedEpisodes(series({ seasons: [] }))).toEqual([]);
    expect(numberedEpisodes(series({ seasons: [{ n: 1, eps: [] }] }))).toEqual([]);
  });

  it("does not change the input", () => {
    const s = series({ seasons: [{ n: 1, eps: [[2], [1]] }] });
    numberedEpisodes(s);
    expect(keys(s.seasons[0].episodes)).toEqual(["1:2", "1:1"]);
  });
});

describe("airedKeys", () => {
  it("counts an Episode aired on or before today", () => {
    const s = series({
      seasons: [{ n: 1, eps: [[1, "2026-10-15"], [2, TODAY], [3, "2026-10-17"]] }],
    });
    expect([...airedKeys(s, TODAY)].sort()).toEqual(["1:1", "1:2"]);
  });

  it("counts an undated Episode as aired when a later numbered Episode has aired", () => {
    const s = series({
      seasons: [
        { n: 1, eps: [[1, null], [2, PAST]] },
        { n: 2, eps: [[1, null], [2, PAST]] },
      ],
    });
    expect([...airedKeys(s, TODAY)].sort()).toEqual(["1:1", "1:2", "2:1", "2:2"]);
  });

  it("looks across Seasons for a later aired Episode", () => {
    const s = series({
      seasons: [
        { n: 1, eps: [[1, null], [2, null]] },
        { n: 2, eps: [[1, PAST]] },
      ],
    });
    expect([...airedKeys(s, TODAY)].sort()).toEqual(["1:1", "1:2", "2:1"]);
  });

  it("counts an undated Episode as unaired when nothing after it has aired", () => {
    const s = series({
      seasons: [{ n: 1, eps: [[1, PAST], [2, null], [3, FUTURE], [4, null]] }],
    });
    expect([...airedKeys(s, TODAY)]).toEqual(["1:1"]);
  });

  it("keeps a dated future Episode unaired even when a later Episode has aired", () => {
    const s = series({ seasons: [{ n: 1, eps: [[1, FUTURE], [2, PAST]] }] });
    expect([...airedKeys(s, TODAY)]).toEqual(["1:2"]);
  });

  it("counts nothing when every Episode is undated", () => {
    const s = series({ seasons: [{ n: 1, eps: [[1, null], [2, null]] }] });
    expect(airedKeys(s, TODAY).size).toBe(0);
  });

  it("counts an undated Special as aired when any numbered Episode has aired", () => {
    const s = series({
      seasons: [
        { n: 0, eps: [[1, null]] },
        { n: 1, eps: [[1, PAST]] },
      ],
    });
    expect([...airedKeys(s, TODAY)].sort()).toEqual(["0:1", "1:1"]);
  });

  it("counts an undated Special as unaired when no numbered Episode has aired", () => {
    const s = series({
      seasons: [
        { n: 0, eps: [[1, null]] },
        { n: 1, eps: [[1, FUTURE], [2, null]] },
      ],
    });
    expect(airedKeys(s, TODAY).size).toBe(0);
  });

  it("judges a dated Special by its own date", () => {
    const s = series({
      seasons: [
        { n: 0, eps: [[1, PAST], [2, FUTURE]] },
        { n: 1, eps: [[1, PAST]] },
      ],
    });
    expect([...airedKeys(s, TODAY)].sort()).toEqual(["0:1", "1:1"]);
  });

  it("is empty for a Series with no Episodes", () => {
    expect(airedKeys(series({ seasons: [] }), TODAY).size).toBe(0);
  });
});

const nextOf = (s: SeriesEpisodes, watched: string[]) => {
  const next = summarizeProgress(s, new Set(watched), TODAY).next;
  return next === null ? null : episodeKey(next);
};

describe("summarizeProgress next", () => {
  const threeSeasons = series({
    seasons: [
      { n: 1, eps: [[1], [2], [3]] },
      { n: 2, eps: [[1], [2], [3]] },
    ],
  });

  it("is the first aired Episode when nothing is watched", () => {
    expect(nextOf(threeSeasons, [])).toBe("1:1");
  });

  it("is the first Episode after the last watched one", () => {
    expect(nextOf(threeSeasons, ["1:1", "1:2"])).toBe("1:3");
  });

  it("crosses into the next Season", () => {
    expect(nextOf(threeSeasons, ["1:1", "1:2", "1:3"])).toBe("2:1");
  });

  it("skips an Episode after the last watched one that is already watched", () => {
    expect(nextOf(threeSeasons, ["1:1", "1:2", "1:3", "2:1"])).toBe("2:2");
  });

  it("follows the last watched Episode, leaving earlier gaps behind", () => {
    expect(nextOf(threeSeasons, ["1:1", "2:1"])).toBe("2:2");
  });

  it("falls back to the earliest gap when nothing aired and unwatched follows the last watched", () => {
    const s = series({ seasons: [{ n: 1, eps: [[1], [2], [3], [4, FUTURE]] }] });
    expect(nextOf(s, ["1:3"])).toBe("1:1");
    expect(nextOf(s, ["1:1", "1:3"])).toBe("1:2");
  });

  it("never picks an unaired Episode, dated in the future or undated", () => {
    const s = series({ seasons: [{ n: 1, eps: [[1], [2, FUTURE], [3, null]] }] });
    expect(nextOf(s, ["1:1"])).toBeNull();
  });

  it("skips an unaired Episode to find a later aired one", () => {
    const s = series({ seasons: [{ n: 1, eps: [[1], [2, FUTURE], [3]] }] });
    expect(nextOf(s, ["1:1"])).toBe("1:3");
  });

  it("is null when every aired Episode is watched", () => {
    const s = series({ seasons: [{ n: 1, eps: [[1], [2], [3, FUTURE]] }] });
    expect(nextOf(s, ["1:1", "1:2"])).toBeNull();
  });

  it("can be an undated Episode that sits before an aired one", () => {
    const s = series({ seasons: [{ n: 1, eps: [[1, null], [2, PAST]] }] });
    expect(nextOf(s, [])).toBe("1:1");
  });

  it("ignores Specials, ticked or not", () => {
    const s = series({
      seasons: [
        { n: 0, eps: [[1], [2]] },
        { n: 1, eps: [[1], [2]] },
      ],
    });
    expect(nextOf(s, [])).toBe("1:1");
    expect(nextOf(s, ["0:1", "0:2"])).toBe("1:1");
    expect(nextOf(s, ["1:1", "0:2"])).toBe("1:2");
  });

  it("works when the Seasons and Episodes arrive out of order", () => {
    const s = series({
      seasons: [
        { n: 2, eps: [[2], [1]] },
        { n: 1, eps: [[2], [1]] },
      ],
    });
    expect(nextOf(s, [])).toBe("1:1");
    expect(nextOf(s, ["1:2"])).toBe("2:1");
  });

  it("is null for a Series with no Episodes", () => {
    expect(nextOf(series({ seasons: [] }), [])).toBeNull();
  });

  it("ignores watched keys the Series does not have", () => {
    expect(nextOf(threeSeasons, ["9:9"])).toBe("1:1");
  });
});

describe("summarizeProgress caught up and counts", () => {
  const summary = (s: SeriesEpisodes, watched: string[]) =>
    summarizeProgress(s, new Set(watched), TODAY);

  it("is caught up when an ongoing Series has every aired Episode watched", () => {
    const s = series({ seasons: [{ n: 1, eps: [[1], [2], [3, FUTURE], [4, null]] }] });
    const result = summary(s, ["1:1", "1:2"]);
    expect(result.caughtUp).toBe(true);
    expect(result.next).toBeNull();
    expect(result.allNumberedWatched).toBe(false);
  });

  it("is not caught up while an aired Episode is unwatched", () => {
    const s = series({ seasons: [{ n: 1, eps: [[1], [2], [3, FUTURE]] }] });
    expect(summary(s, ["1:2"]).caughtUp).toBe(false);
  });

  it("is never caught up when the Series is finished", () => {
    const s = series({ finished: true, seasons: [{ n: 1, eps: [[1], [2]] }] });
    const result = summary(s, ["1:1", "1:2"]);
    expect(result.caughtUp).toBe(false);
    expect(result.allNumberedWatched).toBe(true);
  });

  it("is caught up when nothing has aired yet and the Series is not finished", () => {
    const s = series({ seasons: [{ n: 1, eps: [[1, FUTURE]] }] });
    expect(summary(s, []).caughtUp).toBe(true);
  });

  it("is caught up for an ongoing Series with no Episodes, and not for a finished one", () => {
    expect(summary(series({ seasons: [] }), []).caughtUp).toBe(true);
    expect(summary(series({ finished: true, seasons: [] }), []).caughtUp).toBe(false);
  });

  it("ignores Specials for caught up", () => {
    const s = series({
      seasons: [
        { n: 0, eps: [[1]] },
        { n: 1, eps: [[1]] },
      ],
    });
    expect(summary(s, ["1:1"]).caughtUp).toBe(true);
  });

  it("blocks caught up on an undated old Episode until it is ticked", () => {
    const s = series({ seasons: [{ n: 1, eps: [[1, null], [2, PAST]] }] });
    const before = summary(s, ["1:2"]);
    expect(before.caughtUp).toBe(false);
    expect(before.next?.episodeNumber).toBe(1);
    expect(summary(s, ["1:1", "1:2"]).caughtUp).toBe(true);
  });

  it("does not block caught up on an undated Episode with nothing aired after it", () => {
    const s = series({ seasons: [{ n: 1, eps: [[1, PAST], [2, null]] }] });
    expect(summary(s, ["1:1"]).caughtUp).toBe(true);
  });

  it("counts unaired Episodes in allNumberedWatched but ticking them does not change next", () => {
    const s = series({ seasons: [{ n: 1, eps: [[1], [2, FUTURE]] }] });
    expect(summary(s, ["1:1"]).allNumberedWatched).toBe(false);
    const all = summary(s, ["1:1", "1:2"]);
    expect(all.allNumberedWatched).toBe(true);
    expect(all.next).toBeNull();
  });

  it("does not count Specials toward allNumberedWatched", () => {
    const s = series({
      seasons: [
        { n: 0, eps: [[1]] },
        { n: 1, eps: [[1], [2]] },
      ],
    });
    expect(summary(s, ["0:1", "1:1"]).allNumberedWatched).toBe(false);
    expect(summary(s, ["1:1", "1:2"]).allNumberedWatched).toBe(true);
  });

  it("is not all watched for a Series with no numbered Episodes", () => {
    expect(summary(series({ seasons: [] }), []).allNumberedWatched).toBe(false);
    const specialsOnly = series({ seasons: [{ n: 0, eps: [[1]] }] });
    expect(summary(specialsOnly, ["0:1"]).allNumberedWatched).toBe(false);
  });

  it("counts watched, aired and total numbered Episodes only", () => {
    const s = series({
      seasons: [
        { n: 0, eps: [[1], [2]] },
        { n: 1, eps: [[1], [2], [3, FUTURE], [4, null]] },
      ],
    });
    const result = summary(s, ["0:1", "1:1", "1:3", "9:9"]);
    expect(result.watchedCount).toBe(2);
    expect(result.airedCount).toBe(2);
    expect(result.totalCount).toBe(4);
  });

  it("returns zero counts for a Series with no Episodes", () => {
    expect(summary(series({ seasons: [] }), [])).toEqual({
      next: null,
      caughtUp: true,
      allNumberedWatched: false,
      watchedCount: 0,
      airedCount: 0,
      totalCount: 0,
    });
  });
});

describe("isEpisodeAired", () => {
  const s = series({
    seasons: [
      { n: 0, eps: [[1, null]] },
      { n: 1, eps: [[1, null], [2, PAST], [3, FUTURE]] },
    ],
  });

  it("uses the same rule as airedKeys", () => {
    expect(isEpisodeAired(s, { seasonNumber: 1, episodeNumber: 1 }, TODAY)).toBe(true);
    expect(isEpisodeAired(s, { seasonNumber: 1, episodeNumber: 2 }, TODAY)).toBe(true);
    expect(isEpisodeAired(s, { seasonNumber: 1, episodeNumber: 3 }, TODAY)).toBe(false);
    expect(isEpisodeAired(s, { seasonNumber: 0, episodeNumber: 1 }, TODAY)).toBe(true);
  });

  it("is false for an Episode the Series does not have", () => {
    expect(isEpisodeAired(s, { seasonNumber: 9, episodeNumber: 9 }, TODAY)).toBe(false);
  });
});

describe("airedNumberedEpisodes", () => {
  it("returns aired numbered Episodes in broadcast order and skips Specials", () => {
    const s = series({
      seasons: [
        { n: 2, eps: [[1, PAST], [2, FUTURE]] },
        { n: 0, eps: [[1, PAST]] },
        { n: 1, eps: [[2, null], [1, PAST]] },
      ],
    });
    expect(keys(airedNumberedEpisodes(s, TODAY))).toEqual(["1:1", "1:2", "2:1"]);
  });
});

describe("seasonEpisodes", () => {
  const s = series({
    seasons: [
      { n: 1, eps: [[2], [1]] },
      { n: 0, eps: [[2], [1]] },
      { n: 2, eps: [[1]] },
    ],
  });

  it("returns one Season in episode order", () => {
    expect(keys(seasonEpisodes(s, 1))).toEqual(["1:1", "1:2"]);
  });

  it("allows the Specials season", () => {
    expect(keys(seasonEpisodes(s, 0))).toEqual(["0:1", "0:2"]);
  });

  it("returns nothing for a Season the Series does not have", () => {
    expect(seasonEpisodes(s, 7)).toEqual([]);
  });
});

describe("episodesBefore", () => {
  const s = series({
    seasons: [
      { n: 0, eps: [[1]] },
      { n: 1, eps: [[1], [2]] },
      { n: 2, eps: [[1], [2]] },
    ],
  });

  it("returns the numbered Episodes before the place, across Seasons", () => {
    expect(keys(episodesBefore(s, { seasonNumber: 2, episodeNumber: 2 }))).toEqual([
      "1:1",
      "1:2",
      "2:1",
    ]);
  });

  it("returns nothing before the first Episode", () => {
    expect(episodesBefore(s, { seasonNumber: 1, episodeNumber: 1 })).toEqual([]);
  });

  it("returns nothing for a Special or an unknown place", () => {
    expect(episodesBefore(s, { seasonNumber: 0, episodeNumber: 1 })).toEqual([]);
    expect(episodesBefore(s, { seasonNumber: 9, episodeNumber: 1 })).toEqual([]);
  });

  it("includes unaired Episodes before the place", () => {
    const withUnaired = series({ seasons: [{ n: 1, eps: [[1, FUTURE], [2, FUTURE]] }] });
    expect(keys(episodesBefore(withUnaired, { seasonNumber: 1, episodeNumber: 2 }))).toEqual([
      "1:1",
    ]);
  });
});

describe("earlierUnwatched", () => {
  const s = series({
    seasons: [
      { n: 0, eps: [[1]] },
      { n: 1, eps: [[1], [2], [3]] },
      { n: 2, eps: [[1, FUTURE], [2, FUTURE]] },
    ],
  });

  it("returns the unwatched Episodes before the target", () => {
    const watched = new Set(["1:2"]);
    expect(keys(earlierUnwatched(s, watched, { seasonNumber: 1, episodeNumber: 3 }))).toEqual([
      "1:1",
    ]);
  });

  it("returns nothing when everything before the target is watched", () => {
    const watched = new Set(["1:1", "1:2"]);
    expect(earlierUnwatched(s, watched, { seasonNumber: 1, episodeNumber: 3 })).toEqual([]);
  });

  it("counts unaired Episodes before the target", () => {
    const watched = new Set(["1:1", "1:2", "1:3"]);
    expect(keys(earlierUnwatched(s, watched, { seasonNumber: 2, episodeNumber: 2 }))).toEqual([
      "2:1",
    ]);
  });

  it("ignores Specials, whether ticked or not", () => {
    expect(earlierUnwatched(s, new Set(), { seasonNumber: 0, episodeNumber: 1 })).toEqual([]);
    const watched = new Set(["0:1"]);
    expect(keys(earlierUnwatched(s, watched, { seasonNumber: 1, episodeNumber: 2 }))).toEqual([
      "1:1",
    ]);
  });

  it("returns nothing for an unknown target", () => {
    expect(earlierUnwatched(s, new Set(), { seasonNumber: 5, episodeNumber: 1 })).toEqual([]);
  });
});

describe("Episode 0 of a numbered Season", () => {
  const pilot = series({ finished: true, seasons: [{ n: 1, eps: [[1], [2], [0]] }] });

  it("is a numbered Episode, not a Special, and comes first", () => {
    expect(isSpecial({ seasonNumber: 1, episodeNumber: 0 })).toBe(false);
    expect(formatEpisode({ seasonNumber: 1, episodeNumber: 0 })).toBe("S1 E0");
    expect(keys(numberedEpisodes(pilot))).toEqual(["1:0", "1:1", "1:2"]);
    expect(keys(episodesBefore(pilot, { seasonNumber: 1, episodeNumber: 1 }))).toEqual(["1:0"]);
  });

  it("is Next first, and the Series is not all watched without it", () => {
    expect(summarizeProgress(pilot, new Set(), TODAY).next?.episodeNumber).toBe(0);
    const withoutPilot = summarizeProgress(pilot, new Set(["1:1", "1:2"]), TODAY);
    expect(withoutPilot).toMatchObject({ allNumberedWatched: false, watchedCount: 2, totalCount: 3 });
    expect(withoutPilot.next?.episodeNumber).toBe(0);
    expect(summarizeProgress(pilot, new Set(["1:0", "1:1", "1:2"]), TODAY).allNumberedWatched).toBe(true);
  });
});
