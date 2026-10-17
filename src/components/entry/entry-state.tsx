"use client";

import {
  createContext,
  startTransition,
  use,
  useOptimistic,
  useRef,
  useState,
  useTransition,
  type ReactNode,
  type TransitionStartFunction,
} from "react";
import { toast } from "sonner";
import {
  deleteWatch,
  setRating,
  setStatus,
  setWatchDate,
  watchAgain,
} from "@/actions/entries";
import {
  markEarlier,
  markSeason,
  tickEpisode,
  undoWatchedNext,
  watchedNext,
} from "@/actions/progress";
import type { ActionResult, EntryView, ProgressChange } from "@/data/dto";
import { formatEpisode } from "@/domain/series";
import type { IsoDate, Status, TitleKind } from "@/domain/types";
import { showActionToast } from "@/components/action-toast";
import { fetchSeason, SEASON_ERROR, SeasonLoadError } from "@/components/progress/season-api";
import { useRatingSaveDelay } from "@/components/rating-save-delay";
import { localToday } from "./dates";
import {
  applyPatch,
  guessNext,
  PENDING_WATCH_PREFIX,
  withPendingWatch,
  type EntryModel,
  type Patch,
} from "./entry-model";
import { WatchedStars } from "./watched-stars";

const GENERIC_ERROR = "Couldn't save that. Try again.";

export type EntrySnapshot = Pick<
  EntryView,
  "id" | "status" | "ratingHalfStars" | "watches" | "series" | "tmdbUnavailable"
> & { name: string; kind: TitleKind };

export type SeasonLoad = { state: "loading" } | { state: "error"; message: string };

type EntryContextValue = {
  entryId: string;
  name: string;
  kind: TitleKind;
  tmdbUnavailable: boolean;
  model: EntryModel;
  /** "Watched it" and "Watched again" each add something per tap, so a second tap waits for the first. */
  watchNextPending: boolean;
  addWatchPending: boolean;
  seasonLoad: Record<number, SeasonLoad>;
  changeStatus: (status: Status) => void;
  addWatch: () => void;
  changeWatchDate: (watchId: string, watchedOn: IsoDate | null) => void;
  removeWatch: (watchId: string) => void;
  rate: (halfStars: number | null) => void;
  watchNext: () => void;
  tick: (seasonNumber: number, episodeNumber: number, watched: boolean) => void;
  markWholeSeason: (seasonNumber: number, watched: boolean) => void;
  loadSeason: (seasonNumber: number, force?: boolean) => void;
};

const EntryContext = createContext<EntryContextValue | null>(null);

export function useEntry(): EntryContextValue {
  const value = use(EntryContext);
  if (!value) throw new Error("useEntry needs an EntryProvider above it.");
  return value;
}

function toModel(entry: EntrySnapshot, seasons: EntryModel["seasons"]): EntryModel {
  return {
    status: entry.status,
    ratingHalfStars: entry.ratingHalfStars,
    watches: entry.watches,
    series: entry.series,
    nextPending: false,
    seasons,
  };
}

function withoutKey<T>(record: Record<number, T>, key: number): Record<number, T> {
  return Object.fromEntries(Object.entries(record).filter(([name]) => Number(name) !== key));
}

export function EntryProvider({ entry, children }: { entry: EntrySnapshot; children: ReactNode }) {
  // The server's copy is the base; a fresh render from the server replaces it.
  const [base, setBase] = useState<EntryModel>(() => toModel(entry, {}));
  const [seen, setSeen] = useState(entry);
  if (seen !== entry) {
    setSeen(entry);
    setBase((previous) => toModel(entry, previous.seasons));
  }

  const [model, dispatch] = useOptimistic(base, applyPatch);
  const [watchNextPending, startWatchNext] = useTransition();
  const [addWatchPending, startAddWatch] = useTransition();
  const [seasonLoad, setSeasonLoad] = useState<Record<number, SeasonLoad>>({});
  const loadToken = useRef<Record<number, number>>({});
  const pendingCount = useRef(0);
  const waitToSaveRating = useRatingSaveDelay();

  function newPendingWatchId(): string {
    pendingCount.current += 1;
    return `${PENDING_WATCH_PREFIX}${pendingCount.current}`;
  }

  // Show the change at once, ask the server, then fold the answer into the base.
  // A failed or rejected call just ends the transition: the base never changed,
  // so the screen falls back by itself.
  function run<T>(
    patch: Patch,
    call: () => Promise<ActionResult<T> | null>,
    commit: (previous: EntryModel, data: T) => EntryModel,
    after?: (data: T) => void,
    start: TransitionStartFunction = startTransition,
  ) {
    start(async () => {
      dispatch(patch);
      let result: ActionResult<T> | null;
      try {
        result = await call();
      } catch {
        result = { ok: false, error: GENERIC_ERROR };
      }
      // Null means a newer call took over this one's job.
      if (result === null) return;
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const data = result.data;
      startTransition(() => {
        setBase((previous) => commit(applyPatch(previous, patch), data));
        after?.(data);
      });
    });
  }

  function commitChange(pendingId: string, today: IsoDate) {
    return (previous: EntryModel, change: ProgressChange): EntryModel => ({
      ...previous,
      series: change.progress,
      status: change.status,
      nextPending: false,
      watches: change.addedWatch
        ? withPendingWatch(previous.watches, pendingId, today)
        : previous.watches,
    });
  }

  function rate(halfStars: number | null) {
    run(
      { type: "rating", value: halfStars },
      async () =>
        (await waitToSaveRating())
          ? setRating({ entryId: entry.id, ratingHalfStars: halfStars })
          : null,
      (previous, data) => ({ ...previous, ratingHalfStars: data.ratingHalfStars }),
    );
  }

  function showWatchedToast(message: string) {
    showActionToast("success", message, {
      id: `watched-${entry.id}`,
      description: <WatchedStars initial={null} onRate={rate} />,
    });
  }

  function changeStatus(status: Status) {
    if (status === model.status) return;
    toast.dismiss(`watched-${entry.id}`);
    const pendingWatchId = newPendingWatchId();
    run(
      { type: "status", status, today: localToday(), pendingWatchId },
      () => setStatus({ entryId: entry.id, status }),
      (previous, data) => ({ ...previous, status: data.status }),
      (data) => {
        if (data.addedWatch) showWatchedToast("Marked as watched");
        if (status === "watched") reloadOpenSeasons();
      },
    );
  }

  function addWatch() {
    const pendingWatchId = newPendingWatchId();
    run(
      { type: "watch-again", today: localToday(), pendingWatchId },
      () => watchAgain({ entryId: entry.id }),
      (previous, data) => ({
        ...previous,
        watches: previous.watches.map((watch) =>
          watch.id === pendingWatchId ? data.watch : watch,
        ),
      }),
      undefined,
      startAddWatch,
    );
  }

  function changeWatchDate(watchId: string, watchedOn: IsoDate | null) {
    run(
      { type: "watch-date", watchId, watchedOn },
      () => setWatchDate({ watchId, watchedOn }),
      (previous) => previous,
    );
  }

  function removeWatch(watchId: string) {
    toast.dismiss(`watched-${entry.id}`);
    run(
      { type: "watch-remove", watchId },
      () => deleteWatch({ watchId }),
      (previous, data) => ({ ...previous, status: data.status }),
    );
  }

  function afterProgress(change: ProgressChange) {
    if (change.addedWatch) showWatchedToast("Marked as watched");
  }

  function tick(seasonNumber: number, episodeNumber: number, watched: boolean) {
    const pendingId = newPendingWatchId();
    const today = localToday();
    run(
      { type: "tick", seasonNumber, episodeNumber, watched },
      () => tickEpisode({ entryId: entry.id, seasonNumber, episodeNumber, watched }),
      commitChange(pendingId, today),
      (change) => {
        afterProgress(change);
        if (watched && change.earlierUnwatchedCount > 0) {
          offerEarlier(seasonNumber, episodeNumber, change.earlierUnwatchedCount);
        }
      },
    );
  }

  function offerEarlier(seasonNumber: number, episodeNumber: number, count: number) {
    showActionToast("default", `Also mark the ${count} earlier ${count === 1 ? "episode" : "episodes"}?`, {
      id: `earlier-${entry.id}`,
      action: {
        label: "Mark them",
        onClick: () => markEarlierEpisodes(seasonNumber, episodeNumber),
      },
    });
  }

  function markEarlierEpisodes(seasonNumber: number, episodeNumber: number) {
    const pendingId = newPendingWatchId();
    const today = localToday();
    run(
      { type: "earlier", seasonNumber, episodeNumber },
      () => markEarlier({ entryId: entry.id, seasonNumber, episodeNumber }),
      commitChange(pendingId, today),
      (change) => {
        afterProgress(change);
        reloadOpenSeasons();
      },
    );
  }

  function markWholeSeason(seasonNumber: number, watched: boolean) {
    const pendingId = newPendingWatchId();
    const today = localToday();
    run(
      { type: "season", seasonNumber, watched },
      () => markSeason({ entryId: entry.id, seasonNumber, watched }),
      commitChange(pendingId, today),
      (change) => {
        afterProgress(change);
        reloadOpenSeasons();
      },
    );
  }

  function watchNext() {
    const series = model.series;
    const next = series?.next;
    if (!series || !next || model.nextPending || watchNextPending) return;
    const season = series.seasons.find((candidate) => candidate.seasonNumber === next.seasonNumber);
    const pendingId = newPendingWatchId();
    const today = localToday();
    const before = series;
    run(
      {
        type: "advance",
        seasonNumber: next.seasonNumber,
        episodeNumber: next.episodeNumber,
        seasonWatchedCount: (season?.watchedCount ?? 0) + 1,
        guess: guessNext(series, next),
      },
      () => watchedNext({ entryId: entry.id }),
      commitChange(pendingId, today),
      (change) => {
        const undo = change.undo;
        const onUndo = undo ? () => undoLast(undo, before) : undefined;
        // The server ticks its own Next, which differs from this screen's when another tab moved on.
        const marked = undo ?? next;
        if (marked.seasonNumber !== next.seasonNumber || marked.episodeNumber !== next.episodeNumber) {
          reloadOpenSeasons();
        }
        // A tap that finishes the Series keeps the optional stars in the same toast.
        showActionToast("success", `Marked ${formatEpisode(marked)} watched`, {
          id: `watched-${entry.id}`,
          description: change.addedWatch ? <WatchedStars initial={null} onRate={rate} /> : undefined,
          action: onUndo ? { label: "Undo", onClick: onUndo } : undefined,
        });
      },
      startWatchNext,
    );
  }

  function undoLast(undo: NonNullable<ProgressChange["undo"]>, before: ProgressChange["progress"]) {
    run(
      { type: "undo", ...undo, series: before },
      () => undoWatchedNext({ entryId: entry.id, ...undo }),
      (previous, change) => ({
        ...previous,
        series: change.progress,
        status: change.status,
        nextPending: false,
      }),
      reloadOpenSeasons,
    );
  }

  // After a change that touches many Episodes at once, the server's lists are the
  // truth. The opened lists stay on screen while the fresh ones load.
  function reloadOpenSeasons() {
    for (const key of Object.keys(base.seasons)) loadSeason(Number(key), true);
  }

  function loadSeason(seasonNumber: number, force = false) {
    if (!force && (base.seasons[seasonNumber] || seasonLoad[seasonNumber]?.state === "loading")) {
      return;
    }
    const token = (loadToken.current[seasonNumber] ?? 0) + 1;
    loadToken.current[seasonNumber] = token;
    setSeasonLoad((previous) => ({ ...previous, [seasonNumber]: { state: "loading" } }));
    fetchSeason(entry.id, seasonNumber).then(
      (view) => {
        if (loadToken.current[seasonNumber] !== token) return;
        setBase((previous) => ({ ...previous, seasons: { ...previous.seasons, [seasonNumber]: view } }));
        setSeasonLoad((previous) => withoutKey(previous, seasonNumber));
      },
      (error: unknown) => {
        if (loadToken.current[seasonNumber] !== token) return;
        const message = error instanceof SeasonLoadError ? error.message : SEASON_ERROR;
        setSeasonLoad((previous) => ({ ...previous, [seasonNumber]: { state: "error", message } }));
      },
    );
  }

  const value: EntryContextValue = {
    entryId: entry.id,
    name: entry.name,
    kind: entry.kind,
    tmdbUnavailable: entry.tmdbUnavailable,
    model,
    watchNextPending,
    addWatchPending,
    seasonLoad,
    changeStatus,
    addWatch,
    changeWatchDate,
    removeWatch,
    rate,
    watchNext,
    tick,
    markWholeSeason,
    loadSeason,
  };

  return <EntryContext value={value}>{children}</EntryContext>;
}
