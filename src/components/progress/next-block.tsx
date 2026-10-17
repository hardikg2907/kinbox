"use client";

import { Check } from "lucide-react";
import { useState, type ReactNode } from "react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useEntry } from "@/components/entry/entry-state";
import { SlideSwap } from "./slide-swap";

const TMDB_DOWN = "Can't reach the movie database right now. Try again in a minute.";

// A flat-glass tile inside the sheet: the Next line is the biggest type on the screen after the name.
const CARD = "rounded-3xl border bg-secondary p-5";

function NextName({ name, helper }: { name: string | null; helper: string | null }) {
  const [first] = useState(name);
  const text = name ?? helper;
  return (
    <p
      key={text ?? ""}
      className={cn(
        "mt-2 min-h-6 text-base text-muted-foreground",
        name !== first && "animate-in fade-in-0 duration-200",
      )}
    >
      {text}
    </p>
  );
}

// The bold element of the page: the next Episode and one tap to mark it watched.
export function NextBlock() {
  const { model, watchNext, watchNextPending } = useEntry();
  const series = model.series;

  if (!series) {
    return (
      <section id="series-progress" aria-labelledby="series-progress-title" className={CARD}>
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
    head = <Skeleton className="h-10 w-48 sm:h-12" />;
  } else if (next) {
    headId = `next-${next.label}`;
    head = <p className="font-display text-4xl text-foreground sm:text-5xl">Next: {next.label}</p>;
    name = next.name;
  } else if (series.finished && series.allNumberedWatched) {
    headId = "all-watched";
    head = <p className="font-display text-4xl text-foreground sm:text-5xl">All episodes watched</p>;
  } else if (series.caughtUp) {
    headId = "caught-up";
    head = <p className="font-display text-4xl text-foreground sm:text-5xl">Caught up</p>;
    helper = "New episodes will show here";
  } else {
    headId = "none";
    head = <p className="font-display text-4xl text-foreground sm:text-5xl">All aired episodes watched</p>;
  }

  const canWatch = next !== null || model.nextPending;
  const ratio =
    series.totalCount > 0 ? Math.min(1, Math.max(0, series.watchedCount / series.totalCount)) : 0;
  // Without this, "Caught up" beside "461 of 466 watched" reads as a mistake.
  const notOutYet = Math.max(0, series.totalCount - series.airedCount);
  const countLine = `${series.watchedCount} of ${series.totalCount} watched${
    notOutYet > 0 ? `, ${notOutYet} not out yet` : ""
  }`;

  return (
    <section id="series-progress" aria-labelledby="series-progress-title" className={CARD}>
      <h2 id="series-progress-title" className="sr-only">
        Series progress
      </h2>
      <SlideSwap id={headId}>{head}</SlideSwap>
      {model.nextPending ? (
        <Skeleton className="mt-2 h-5 w-56" />
      ) : (
        <NextName name={name} helper={helper} />
      )}
      {canWatch ? (
        <Button
          id="watched-it-button"
          size="lg"
          disabled={model.nextPending || watchNextPending}
          onClick={watchNext}
          className="mt-5 w-full sm:w-auto sm:min-w-44"
        >
          <Check aria-hidden />
          Watched it
        </Button>
      ) : null}
      <div className={canWatch ? "mt-5" : "mt-4"}>
        <p id="series-progress-count" className="tabular text-sm text-muted-foreground">
          {countLine}
        </p>
        <div aria-hidden className="mt-3 h-1.5 overflow-hidden rounded-full bg-foreground/15">
          <div
            className="h-full origin-left rounded-full bg-primary transition-transform duration-300 ease-out"
            style={{ transform: `scaleX(${ratio})` }}
          />
        </div>
      </div>
    </section>
  );
}
