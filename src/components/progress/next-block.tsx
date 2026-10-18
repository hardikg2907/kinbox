"use client";

import { Check } from "lucide-react";
import { useState, type ReactNode } from "react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { inheritedBloomColour, playBloom } from "@/components/poster-colour/bloom";
import { useEntry } from "@/components/entry/entry-state";
import { SlideSwap } from "./slide-swap";

const TMDB_DOWN = "Can't reach the movie database right now. Try again in a minute.";

const DONE = "font-display text-3xl text-foreground";

// `reserve` keeps the line's height in the Next state, so the layout does not jump when the
// Episode's name arrives. Elsewhere an empty line would only add a gap.
function NextName({ name, helper, reserve }: { name: string | null; helper: string | null; reserve: boolean }) {
  const [first] = useState(name);
  const text = name ?? helper;
  if (!text && !reserve) return null;
  return (
    <p
      key={text ?? ""}
      className={cn(
        "mt-1 min-h-6 truncate text-base text-muted-foreground",
        name !== first && "animate-in fade-in-0 duration-200",
      )}
    >
      {text}
    </p>
  );
}

// The bold element of the Title: the next Episode, and one tap to mark it watched beside it.
export function NextBlock() {
  const { model, watchNext, watchNextPending } = useEntry();
  const series = model.series;

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
    head = (
      <p className="flex items-baseline gap-2.5 font-display">
        <span className="text-xl text-muted-foreground">Next:</span>
        <span className="tabular text-[44px] leading-none whitespace-nowrap text-foreground">{next.label}</span>
      </p>
    );
    name = next.name;
  } else if (series.finished && series.allNumberedWatched) {
    headId = "all-watched";
    head = <p className={DONE}>All episodes watched</p>;
  } else if (series.caughtUp) {
    headId = "caught-up";
    head = <p className={DONE}>Caught up</p>;
    helper = "New episodes will show here";
  } else {
    headId = "none";
    head = <p className={DONE}>All aired episodes watched</p>;
  }

  const canWatch = next !== null || model.nextPending;

  return (
    <section
      id="series-progress"
      aria-labelledby="series-progress-title"
      className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3"
    >
      <h2 id="series-progress-title" className="sr-only">
        Series progress
      </h2>
      <div className="min-w-0 flex-1">
        <SlideSwap id={headId}>{head}</SlideSwap>
        {model.nextPending ? <Skeleton className="mt-1 h-6 w-40" /> : <NextName name={name} helper={helper} reserve={next !== null} />}
      </div>
      {canWatch ? (
        <Button
          id="watched-it-button"
          size="lg"
          disabled={model.nextPending || watchNextPending}
          onClick={(event) => {
            playBloom(event.currentTarget, inheritedBloomColour(event.currentTarget));
            watchNext();
          }}
          className="h-12 shrink-0 px-5 text-base font-bold"
        >
          <Check aria-hidden />
          Watched it
        </Button>
      ) : null}
    </section>
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
