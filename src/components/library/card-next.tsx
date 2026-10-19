"use client";

import { Check } from "lucide-react";
import { useOptimistic, useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import { cn } from "cn";
import { showActionToast } from "@/components/action-toast";
import { playBloom } from "@/components/poster-colour/bloom";
import { cachedPalette, readPalette } from "@/components/poster-colour/palette";
import { Button } from "@/components/ui/button";
import { undoWatchedNext, watchedNext } from "@/actions/progress";
import type { CardProgress, WatchedNextUndo } from "@/data/dto";
import { formatEpisode } from "@/domain/series";

type Props = {
  entryId: string;
  /** Names the button, so each card's "Watched it" is told apart by a screen reader. */
  name: string;
  /** The Title's name link, shown above the Next line. */
  heading: ReactNode;
  /** The wide tile: text left, button right, on a scrim. */
  lead?: boolean;
  /** Where the bloom gets its colour. */
  posterPath: string | null;
  /** Narrow on purpose: only what the "Next" line and the button need. */
  progress: Pick<CardProgress, "caughtUp" | "allNumberedWatched"> & {
    nextLabel: string | null;
    episodeName: string | null;
  };
};

type Shown = Props["progress"] & {
  /** The Episode a tap is saving, shown at once while the server confirms. */
  marking: string | null;
};

type Change = { type: "mark"; label: string } | { type: "restore"; label: string };

const UNDO_TOAST_ID = "watched-next-undo";

function reduce(current: Shown, change: Change): Shown {
  if (change.type === "mark") return { ...current, marking: change.label };
  return { ...current, nextLabel: change.label, episodeName: null, caughtUp: false, allNumberedWatched: false, marking: null };
}

export function CardNext({ entryId, name, heading, lead = false, posterPath, progress }: Props) {
  const [pending, startTransition] = useTransition();
  const [shown, change] = useOptimistic<Shown, Change>({ ...progress, marking: null }, reduce);

  function undo(data: WatchedNextUndo) {
    startTransition(async () => {
      change({ type: "restore", label: `S${data.seasonNumber} E${data.episodeNumber}` });
      const result = await undoWatchedNext({ entryId, ...data });
      if (!result.ok) toast.error(result.error);
    });
  }

  function markWatched() {
    const label = progress.nextLabel;
    if (label === null) return;
    startTransition(async () => {
      change({ type: "mark", label });
      const result = await watchedNext({ entryId });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const { undo: undoData } = result.data;
      // The server ticks its own Next, which differs from this card's when another tab moved on.
      showActionToast("success", `Marked ${undoData ? formatEpisode(undoData) : label} watched`, {
        id: UNDO_TOAST_ID,
        action: undoData ? { label: "Undo", onClick: () => undo(undoData) } : undefined,
      });
    });
  }

  if (shown.marking === null && shown.nextLabel === null) {
    return (
      <div>
        {heading}
        {/* Same lines as the Entry page: only a Series that is not finished can be caught up. */}
        {shown.caughtUp ? (
          <>
            <p className={cn("mt-1 text-sm font-semibold", lead && "lg:text-base")}>Caught up</p>
            <p className={cn("text-xs text-muted-foreground", lead && "lg:text-sm")}>New episodes will show here</p>
          </>
        ) : (
          <p className={cn("mt-1 text-sm font-semibold", lead && "lg:text-base")}>
            {shown.allNumberedWatched ? "All episodes watched" : "All aired episodes watched"}
          </p>
        )}
      </div>
    );
  }

  const line = shown.marking !== null ? `Marked ${shown.marking}` : `Next: ${shown.nextLabel}`;

  return (
    <div className={lead ? "flex items-end justify-between gap-3" : "flex flex-col gap-2 rows:flex-row rows:items-center rows:justify-between rows:gap-3"}>
      <div className="min-w-0">
        {heading}
        <p
          className={cn("tabular mt-1 flex min-h-5 items-center gap-1.5 overflow-hidden text-sm font-bold", lead && "lg:min-h-6 lg:text-base")}
          aria-live="polite"
        >
          <span key={line} className="inline-flex animate-in items-center gap-1.5 duration-200 fade-in slide-in-from-bottom-2">
            {shown.marking !== null ? <Check aria-hidden className="size-4 shrink-0" /> : null}
            {line}
          </span>
        </p>
        {lead && shown.episodeName && shown.marking === null ? (
          <p className="line-clamp-1 text-sm text-muted-foreground lg:text-base">{shown.episodeName}</p>
        ) : null}
      </div>
      <Button
        id={`watched-it-${entryId}`}
        type="button"
        aria-label={`Watched it: ${name}${shown.nextLabel ? ` ${shown.nextLabel}` : ""}`}
        variant={lead ? "default" : "secondary"}
        onPointerDown={() => void readPalette(posterPath)}
        onClick={(event) => {
          playBloom(event.currentTarget, cachedPalette(posterPath)?.vivid ?? null);
          markWatched();
        }}
        disabled={pending}
        className={cn(
          "relative z-10 font-semibold after:absolute after:-inset-y-1 after:inset-x-0",
          lead ? "h-11 shrink-0 px-5" : "h-10 w-full text-sm dense:w-11 dense:px-0 rows:w-auto rows:shrink-0 rows:px-4",
        )}
      >
        <Check aria-hidden />
        <span className={lead ? undefined : "dense:sr-only"}>Watched it</span>
      </Button>
    </div>
  );
}
