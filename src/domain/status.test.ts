import { describe, expect, it } from "vitest";
import {
  afterEpisodeTicked,
  afterEpisodeUnticked,
  changeStatus,
  entryAfterMove,
  isUnchangedSinceMove,
  markSeriesWatched,
  moveChangedAnything,
  statusAfterUndo,
  statusAfterWatchDeleted,
  statusOnSave,
  watchAgain,
  type MovedEntry,
  type StatusMoveRecord,
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

const BEFORE = "2026-10-01T08:00:00.123456Z";
const PROGRESS_BEFORE = "2026-10-02T09:30:00.654321Z";
const MOVED = "2026-10-16T18:45:12.000001Z";
const LATER = "2026-10-16T18:45:12.000002Z";

function move(fields: Partial<StatusMoveRecord> = {}): StatusMoveRecord {
  return {
    status: "dropped",
    previousStatus: "watching",
    previousStatusChangedAt: BEFORE,
    previousProgressMovedAt: PROGRESS_BEFORE,
    movedAt: MOVED,
    addedWatch: false,
    tickedCount: 0,
    watchCount: 0,
    ...fields,
  };
}

describe("moveChangedAnything", () => {
  it("is false for a move to the Status the Entry already has", () => {
    expect(moveChangedAnything(move({ status: "watched", previousStatus: "watched" }))).toBe(false);
  });

  it("is true when the Status moved, a Watch was added, or Episodes were ticked", () => {
    expect(moveChangedAnything(move())).toBe(true);
    expect(
      moveChangedAnything(move({ status: "watched", previousStatus: "watched", addedWatch: true })),
    ).toBe(true);
    expect(
      moveChangedAnything(move({ status: "watched", previousStatus: "watched", tickedCount: 3 })),
    ).toBe(true);
  });
});

describe("entryAfterMove", () => {
  it("dates the Status change with the move's time when the Status moved", () => {
    expect(entryAfterMove(move()).statusChangedAt).toBe(MOVED);
  });

  it("keeps the old Status time when the Status stayed (Watched again)", () => {
    const again = move({ status: "watched", previousStatus: "watched", addedWatch: true, watchCount: 2 });
    expect(entryAfterMove(again)).toEqual({
      status: "watched",
      statusChangedAt: BEFORE,
      progressMovedAt: PROGRESS_BEFORE,
      watchCount: 2,
    });
  });

  it("dates progress with the move's time only when the move ticked Episodes", () => {
    expect(entryAfterMove(move({ tickedCount: 19 })).progressMovedAt).toBe(MOVED);
    expect(entryAfterMove(move()).progressMovedAt).toBe(PROGRESS_BEFORE);
    expect(entryAfterMove(move({ previousProgressMovedAt: null })).progressMovedAt).toBeNull();
  });
});

describe("isUnchangedSinceMove", () => {
  const seriesWatched = move({
    status: "watched",
    previousStatus: "watching",
    addedWatch: true,
    tickedCount: 19,
    watchCount: 1,
  });
  const rightAfter: MovedEntry = {
    status: "watched",
    statusChangedAt: MOVED,
    progressMovedAt: MOVED,
    watchCount: 1,
  };

  it("is true while the Entry is exactly where the move left it", () => {
    expect(isUnchangedSinceMove(seriesWatched, rightAfter)).toBe(true);
  });

  it.each([
    ["a later move", { status: "dropped", statusChangedAt: LATER }],
    ["a later move back to the same Status", { statusChangedAt: LATER }],
    ["a later tick or untick", { progressMovedAt: LATER }],
    ["a later Watched again", { watchCount: 2 }],
    ["a deleted Watch", { watchCount: 0 }],
    ["stamps one microsecond apart", { statusChangedAt: "2026-10-16T18:45:12.000000Z" }],
  ] as const)("is false after %s", (_, change) => {
    expect(isUnchangedSinceMove(seriesWatched, { ...rightAfter, ...change })).toBe(false);
  });

  it("is false once the move has been undone, so a second Undo is refused", () => {
    const undone: MovedEntry = {
      status: "watching",
      statusChangedAt: BEFORE,
      progressMovedAt: PROGRESS_BEFORE,
      watchCount: 0,
    };
    expect(isUnchangedSinceMove(seriesWatched, undone)).toBe(false);

    const again = move({ status: "watched", previousStatus: "watched", addedWatch: true, watchCount: 2 });
    const againUndone = { ...entryAfterMove(again), watchCount: 1 };
    expect(isUnchangedSinceMove(again, againUndone)).toBe(false);
  });
});

describe("statusAfterUndo", () => {
  it.each(STATUSES)("puts back %s", (previousStatus) => {
    expect(statusAfterUndo(move({ previousStatus, status: "watched", addedWatch: true, watchCount: 2 }))).toBe(
      previousStatus,
    );
  });

  it("never puts back Watched once no Watch is left", () => {
    const forged = move({ previousStatus: "watched", status: "watched", addedWatch: true, watchCount: 1 });
    expect(statusAfterUndo(forged)).toBe("to_watch");
    expect(statusAfterUndo(move({ previousStatus: "watched", watchCount: 0 }))).toBe("to_watch");
  });

  it("keeps Watched when Watches from before the move remain", () => {
    expect(statusAfterUndo(move({ previousStatus: "watched", status: "dropped", watchCount: 3 }))).toBe(
      "watched",
    );
  });
});
