import { CalendarCheck } from "lucide-react";
import Link from "next/link";
import { ViewTransition } from "react";
import { cn } from "cn";
import { NotOutYetMock } from "@/components/not-out-yet-mock";
import { Poster } from "@/components/poster";
import { KindBadge } from "@/components/status";
import { CardNext } from "@/components/library/card-next";
import { formatWatchDate } from "@/components/library/format-date";
import type { LibraryCard as LibraryCardData } from "@/data/dto";

type Props = {
  card: LibraryCardData;
  /** Cards in the first rows load their poster at once. */
  eager: boolean;
};

// The poster fills the cell and the name sits on it, over a scrim that is nearly the page colour.
// The poster goes behind (-z-10 inside the isolated cell) so the label can stay a plain,
// unpositioned block: the name's link then stretches over the whole cell, and "Watched it" sits above it.
export function LibraryCard({ card, eager }: Props) {
  const { entryId, name, year, kind, posterPath, status, progress, latestWatchOn } = card;
  const showsNext = status === "watching" && kind === "series";

  return (
    <li
      id={`card-${entryId}`}
      className="group relative isolate flex aspect-[2/3] flex-col justify-end overflow-hidden bg-muted"
    >
      {/* Named for the poster on the Entry page hero; default="none" keeps it still unless it has a partner to morph into. */}
      <ViewTransition name={`poster-${entryId}`} share="auto" default="none">
        <Poster
          path={posterPath}
          name={name}
          size="w342"
          eager={eager}
          decorative
          className="absolute inset-0 -z-10 aspect-auto rounded-none transition-transform duration-200 ease-out group-hover:scale-[1.03] group-has-[a:active]:scale-[0.98]"
        />
      </ViewTransition>
      <div className="scrim-label flex flex-col gap-2 px-3 pt-10 pb-3">
        <div>
          <Link
            href={`/entry/${entryId}`}
            className={cn(
              "block rounded-sm text-[0.9375rem] leading-tight font-semibold outline-none after:absolute after:inset-0 focus-visible:after:ring-3 focus-visible:after:ring-ring focus-visible:after:ring-inset",
              showsNext ? "line-clamp-1" : "line-clamp-2",
            )}
          >
            {name}
          </Link>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs text-muted-foreground">
            {year !== null ? <span className="tabular">{year}</span> : null}
            <KindBadge kind={kind} />
            <NotOutYetMock name={name} />
          </div>
          {status === "watched" ? (
            <p className="tabular mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              <CalendarCheck aria-hidden className="size-3.5 shrink-0" />
              <span className="sr-only">Watched: </span>
              {latestWatchOn ? formatWatchDate(latestWatchOn) : "Date unknown"}
            </p>
          ) : null}
        </div>
        {showsNext ? (
          progress ? (
            <CardNext
              entryId={entryId}
              name={name}
              progress={{
                nextLabel: progress.next?.label ?? null,
                caughtUp: progress.caughtUp,
                allNumberedWatched: progress.allNumberedWatched,
              }}
            />
          ) : (
            <p className="text-xs text-muted-foreground">Episodes unavailable right now</p>
          )
        ) : null}
      </div>
    </li>
  );
}
