"use client";

import { Check } from "lucide-react";
import { useEffect, useRef, useState, type ComponentProps, type ReactNode } from "react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { inheritedBloomColour, playBloom } from "@/components/poster-colour/bloom";
import { useEntry } from "@/components/entry/entry-state";
import type { TileNext } from "@/components/entry/opened-tile";
import { SlideSwap } from "./slide-swap";

const TMDB_DOWN = "Can't reach the movie database right now. Try again in a minute.";

const DONE = "font-display text-3xl text-foreground";
const BLOCK = "flex flex-wrap items-center justify-between gap-x-4 gap-y-3";
const NAME_LINE = "mt-1 min-h-6 truncate text-base text-muted-foreground";
const CAUGHT_UP_HELPER = "New episodes will show here";
/** Two taps closer than this are one tap, even before the first has shown as pending. */
const DOUBLE_TAP_MS = 500;

// `reserve` keeps the line's height in the Next state, so the layout does not jump when the
// Episode's name arrives. Elsewhere an empty line would only add a gap.
function NextName({ name, helper, reserve }: { name: string | null; helper: string | null; reserve: boolean }) {
  const [first] = useState(name);
  const text = name ?? helper;
  if (!text && !reserve) return null;
  return (
    <p key={text ?? ""} className={cn(NAME_LINE, name !== first && "animate-in fade-in-0 duration-200")}>
      {text}
    </p>
  );
}

function NextLine({ label }: { label: string }) {
  return (
    <p className="flex items-baseline gap-2.5 font-display">
      <span className="text-xl text-muted-foreground">Next:</span>
      <span className="tabular text-[44px] leading-none whitespace-nowrap text-foreground">{label}</span>
    </p>
  );
}

function WatchedItButton(props: Pick<ComponentProps<typeof Button>, "id" | "aria-disabled" | "tabIndex" | "onClick">) {
  return (
    <Button size="lg" {...props} className="h-12 shrink-0 px-5 text-base font-bold">
      <Check aria-hidden />
      Watched it
    </Button>
  );
}

// A tap on "Watched it" in the drawer before its Title has loaded. The real button acts on it once
// it is there, if it still offers the same Episode. A tap is only good for the view it was made
// in: closing the drawer or leaving a Next block forgets it, and so does a load that never comes.
const QUEUED_TAP_MS = 8000;
let queuedTap: { entryId: string; label: string; at: number } | null = null;

function takeQueuedTap(entryId: string): string | null {
  const tap = queuedTap;
  if (tap?.entryId !== entryId) return null;
  queuedTap = null;
  return performance.now() - tap.at < QUEUED_TAP_MS ? tap.label : null;
}

export function forgetQueuedTap(): void {
  queuedTap = null;
}

// The bold element of the Title: the next Episode, and one tap to mark it watched beside it.
export function NextBlock() {
  const { entryId, model, watchNext, watchNextPending } = useEntry();
  const series = model.series;
  const nextLabel = series?.next?.label ?? null;
  const lastTap = useRef(Number.NEGATIVE_INFINITY);

  useEffect(() => {
    const label = takeQueuedTap(entryId);
    if (label !== null && label === nextLabel) watchNext();
    return forgetQueuedTap;
    // Only the first render can owe a tap; later ones never find one queued for this Title.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!series) {
    return (
      <section id="series-progress" aria-labelledby="series-progress-title">
        <h2 id="series-progress-title" className="sr-only">
          Series progress
        </h2>
        <p className="text-base text-muted-foreground">{TMDB_DOWN}</p>
      </section>
    );
  }

  const next = series.next;
  let headId: string;
  let head: ReactNode;
  let name: string | null = null;
  let helper: string | null = null;

  if (model.nextPending) {
    headId = "pending";
    head = <Skeleton className="h-11 w-40" />;
  } else if (next) {
    headId = `next-${next.label}`;
    head = <NextLine label={next.label} />;
    name = next.name;
  } else if (series.finished && series.allNumberedWatched) {
    headId = "all-watched";
    head = <p className={DONE}>All episodes watched</p>;
  } else if (series.caughtUp) {
    headId = "caught-up";
    head = <p className={DONE}>Caught up</p>;
    helper = CAUGHT_UP_HELPER;
  } else {
    headId = "none";
    head = <p className={DONE}>All aired episodes watched</p>;
  }

  const canWatch = next !== null || model.nextPending;
  // While a tap is on its way the button keeps its look, so the screen stays calm; a second tap
  // in that time does nothing.
  const busy = model.nextPending || watchNextPending;

  return (
    <section id="series-progress" aria-labelledby="series-progress-title" className={BLOCK}>
      <h2 id="series-progress-title" className="sr-only">
        Series progress
      </h2>
      <div className="min-w-0 flex-1">
        <SlideSwap id={headId}>{head}</SlideSwap>
        {model.nextPending ? <Skeleton className="mt-1 h-6 w-40" /> : <NextName name={name} helper={helper} reserve={next !== null} />}
      </div>
      {canWatch ? (
        <WatchedItButton
          id="watched-it-button"
          aria-disabled={busy || undefined}
          onClick={(event) => {
            if (busy || event.timeStamp - lastTap.current < DOUBLE_TAP_MS) return;
            lastTap.current = event.timeStamp;
            playBloom(event.currentTarget, inheritedBloomColour(event.currentTarget));
            watchNext();
          }}
        />
      ) : null}
    </section>
  );
}

/**
 * The Next block as the tapped card shows it, while the Title loads: the same lines, and the
 * "Watched it" button looking as it will. A tap on it blooms at once and counts once the Title has
 * loaded. `next` is null when the card has no Next line (a Series that is not Watching); a
 * placeholder then holds one line.
 */
export function NextBlockPreview({ entryId, next }: { entryId: string; next: TileNext | null }) {
  let lines: ReactNode;
  if (next === null) {
    lines = (
      <div className="relative">
        <p className={cn(DONE, "invisible")}>All episodes watched</p>
        <Skeleton className="absolute inset-y-1 left-0 w-56" />
      </div>
    );
  } else if (next.state === "next") {
    lines = (
      <>
        <NextLine label={next.label} />
        <p className={NAME_LINE}>{next.name}</p>
      </>
    );
  } else if (next.state === "caught-up") {
    lines = (
      <>
        <p className={DONE}>Caught up</p>
        <p className={NAME_LINE}>{CAUGHT_UP_HELPER}</p>
      </>
    );
  } else {
    lines = <p className={DONE}>{next.state === "all-watched" ? "All episodes watched" : "All aired episodes watched"}</p>;
  }
  return (
    <div className={BLOCK}>
      <div className="min-w-0 flex-1">{lines}</div>
      {next?.state === "next" ? (
        <WatchedItButton
          // The keyboard reaches the real button a moment later; this copy sits in a part screen readers skip.
          tabIndex={-1}
          onClick={(event) => {
            if (queuedTap?.entryId === entryId) return;
            playBloom(event.currentTarget, inheritedBloomColour(event.currentTarget));
            queuedTap = { entryId, label: next.label, at: performance.now() };
          }}
        />
      ) : null}
    </div>
  );
}

// "10 of 62 watched" and a thin bar, under the rating.
export function ProgressLine() {
  const { model } = useEntry();
  const series = model.series;
  if (!series) return null;

  const ratio = series.totalCount > 0 ? Math.min(1, Math.max(0, series.watchedCount / series.totalCount)) : 0;
  // Without this, "Caught up" beside "461 of 466 watched" reads as a mistake.
  const notOutYet = Math.max(0, series.totalCount - series.airedCount);
  const countLine = `${series.watchedCount} of ${series.totalCount} watched${
    notOutYet > 0 ? `, ${notOutYet} not out yet` : ""
  }`;

  return (
    <div id="entry-progress">
      <p id="series-progress-count" className="tabular text-sm text-muted-foreground">
        {countLine}
      </p>
      <div aria-hidden className="mt-2 h-1 overflow-hidden rounded-full bg-foreground/15">
        <div
          className="h-full origin-left rounded-full bg-primary transition-transform duration-300 ease-out"
          style={{ transform: `scaleX(${ratio})` }}
        />
      </div>
    </div>
  );
}
