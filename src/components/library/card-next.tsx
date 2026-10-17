"use client";

import { Check } from "lucide-react";
import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import { showActionToast } from "@/components/action-toast";
import { Button } from "@/components/ui/button";
import { undoWatchedNext, watchedNext } from "@/actions/progress";
import type { CardProgress, WatchedNextUndo } from "@/data/dto";
import { formatEpisode } from "@/domain/series";

type Props = {
  entryId: string;
  /** Names the button, so each card's "Watched it" is told apart by a screen reader. */
  name: string;
  /** Narrow on purpose: only what the "Next" line and the button need. */
  progress: Pick<CardProgress, "caughtUp" | "allNumberedWatched"> & { nextLabel: string | null };
};

type Shown = Props["progress"] & {
  /** The Episode a tap is saving, shown at once while the server confirms. */
  marking: string | null;
};

type Change = { type: "mark"; label: string } | { type: "restore"; label: string };

const UNDO_TOAST_ID = "watched-next-undo";

function reduce(current: Shown, change: Change): Shown {
  if (change.type === "mark") return { ...current, marking: change.label };
  return { ...current, nextLabel: change.label, caughtUp: false, allNumberedWatched: false, marking: null };
}

export function CardNext({ entryId, name, progress }: Props) {
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
      <div className="px-0.5">
        {/* Same lines as the Entry page: only a Series that is not finished can be caught up. */}
        {shown.caughtUp ? (
          <>
            <p className="text-sm font-medium">Caught up</p>
            <p className="text-xs text-muted-foreground">New episodes will show here</p>
          </>
        ) : (
          <p className="text-sm font-medium">
            {shown.allNumberedWatched ? "All episodes watched" : "All aired episodes watched"}
          </p>
        )}
      </div>
    );
  }

  const line = shown.marking !== null ? `Marked ${shown.marking}` : `Next: ${shown.nextLabel}`;

  return (
    <div className="flex flex-col gap-2">
      <p className="tabular flex min-h-5 items-center gap-1.5 overflow-hidden px-0.5 text-sm font-semibold" aria-live="polite">
        <span key={line} className="inline-flex animate-in items-center gap-1.5 duration-200 fade-in slide-in-from-bottom-2">
          {shown.marking !== null ? <Check aria-hidden className="size-4 shrink-0 text-primary" /> : null}
          {line}
        </span>
      </p>
      <Button
        id={`watched-it-${entryId}`}
        type="button"
        aria-label={`Watched it: ${name}${shown.nextLabel ? ` ${shown.nextLabel}` : ""}`}
        variant="secondary"
        onClick={markWatched}
        disabled={pending}
        className="w-full"
      >
        <Check aria-hidden />
        Watched it
      </Button>
    </div>
  );
}
