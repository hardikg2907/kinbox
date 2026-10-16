import { describe, expect, it } from "vitest";
import {
  afterEpisodeTicked,
  afterEpisodeUnticked,
  changeStatus,
  markSeriesWatched,
  statusAfterWatchDeleted,
  statusOnSave,
  watchAgain,
} from "./status";
import { STATUSES, type IsoDate, type Status } from "./types";

const TODAY: IsoDate = "2026-10-16";

const NO_WATCH = null;
const WATCH_TODAY = { watchedOn: TODAY };

describe("statusOnSave", () => {
  it("adds a Watch with an unknown date when a Title is saved as Watched", () => {
    expect(statusOnSave("watched")).toEqual({ status: "watched", addWatch: { watchedOn: null } });
  });

  it.each(["to_watch", "watching", "dropped"] as const)("adds no Watch when saved as %s", (status) => {
    expect(statusOnSave(status)).toEqual({ status, addWatch: NO_WATCH });
  });
});

describe("changeStatus", () => {
  it("dates the Watch today when moving to Watched", () => {
    for (const current of ["to_watch", "watching", "dropped"] as const) {
      expect(changeStatus(current, "watched", TODAY)).toEqual({
        status: "watched",
        addWatch: WATCH_TODAY,
      });
    }
  });

  it("adds no Watch when moving away from Watched", () => {
    for (const target of ["to_watch", "watching", "dropped"] as const) {
      expect(changeStatus("watched", target, TODAY)).toEqual({ status: target, addWatch: NO_WATCH });
    }
  });

  it("changes nothing when the Status stays the same", () => {
    for (const status of STATUSES) {
      expect(changeStatus(status, status, TODAY)).toEqual({ status, addWatch: NO_WATCH });
    }
  });

  it("lets any other Status move to any other without a Watch", () => {
    const others = ["to_watch", "watching", "dropped"] as const;
    for (const current of others) {
      for (const target of others.filter((s) => s !== current)) {
        expect(changeStatus(current, target, TODAY)).toEqual({ status: target, addWatch: NO_WATCH });
      }
    }
  });
});

describe("watchAgain", () => {
  it("sets Watched with a Watch dated today", () => {
    expect(watchAgain(TODAY)).toEqual({ status: "watched", addWatch: WATCH_TODAY });
  });
});

describe("statusAfterWatchDeleted", () => {
  it("goes back to To watch when the last Watch is deleted from a Watched Entry", () => {
    expect(statusAfterWatchDeleted("watched", 0)).toBe("to_watch");
  });

  it("stays Watched while Watches remain", () => {
    expect(statusAfterWatchDeleted("watched", 1)).toBe("watched");
  });

  it.each(["dropped", "watching", "to_watch"] as const)(
    "keeps %s when the last Watch is deleted",
    (status) => {
      expect(statusAfterWatchDeleted(status, 0)).toBe(status);
    },
  );
});

describe("afterEpisodeTicked", () => {
  const ongoing = { finished: false, allNumberedWatched: false, today: TODAY };

  it("moves To watch to Watching", () => {
    expect(afterEpisodeTicked("to_watch", ongoing)).toEqual({
      status: "watching",
      addWatch: NO_WATCH,
    });
  });

  it("moves Dropped back to Watching", () => {
    expect(afterEpisodeTicked("dropped", ongoing)).toEqual({
      status: "watching",
      addWatch: NO_WATCH,
    });
  });

  it("keeps Watching as it is", () => {
    expect(afterEpisodeTicked("watching", ongoing)).toEqual({
      status: "watching",
      addWatch: NO_WATCH,
    });
  });

  it("keeps Watched as it is, with no new Watch", () => {
    expect(afterEpisodeTicked("watched", ongoing)).toEqual({
      status: "watched",
      addWatch: NO_WATCH,
    });
  });

  it("adds a Watch dated today when the last numbered Episode of a finished Series is ticked", () => {
    const finishing = { finished: true, allNumberedWatched: true, today: TODAY };
    for (const current of ["watching", "to_watch", "dropped"] as const) {
      expect(afterEpisodeTicked(current, finishing)).toEqual({
        status: "watched",
        addWatch: WATCH_TODAY,
      });
    }
  });

  it("adds no second Watch when a Watched Entry ticks an Episode of a finished Series", () => {
    const finishing = { finished: true, allNumberedWatched: true, today: TODAY };
    expect(afterEpisodeTicked("watched", finishing)).toEqual({
      status: "watched",
      addWatch: NO_WATCH,
    });
  });

  it("stays Watching when a finished Series still has a gap", () => {
    const gap = { finished: true, allNumberedWatched: false, today: TODAY };
    expect(afterEpisodeTicked("watching", gap)).toEqual({ status: "watching", addWatch: NO_WATCH });
  });

  it("stays Watching when every Episode of an unfinished Series is ticked", () => {
    const unfinished = { finished: false, allNumberedWatched: true, today: TODAY };
    expect(afterEpisodeTicked("watching", unfinished)).toEqual({
      status: "watching",
      addWatch: NO_WATCH,
    });
  });
});

describe("afterEpisodeUnticked", () => {
  it.each(STATUSES)("leaves %s as it is", (status: Status) => {
    expect(afterEpisodeUnticked(status)).toBe(status);
  });
});

describe("markSeriesWatched", () => {
  it("dates the Watch today for an Entry that is not Watched", () => {
    for (const current of ["to_watch", "watching", "dropped"] as const) {
      expect(markSeriesWatched(current, TODAY)).toEqual({ status: "watched", addWatch: WATCH_TODAY });
    }
  });

  it("changes nothing for an Entry that is already Watched", () => {
    expect(markSeriesWatched("watched", TODAY)).toEqual({ status: "watched", addWatch: NO_WATCH });
  });
});
