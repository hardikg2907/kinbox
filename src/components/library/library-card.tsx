import { CalendarCheck } from "lucide-react";
import Link from "next/link";
import { ViewTransition } from "react";
import { cn } from "cn";
import { Poster } from "@/components/poster";
import { CardNext } from "@/components/library/card-next";
import { formatWatchDate } from "@/components/library/format-date";
import type { LibraryCard as LibraryCardData } from "@/data/dto";

type Props = {
  card: LibraryCardData;
  /** Cards in the first rows load their poster at once. */
  eager: boolean;
  /** The wide first tile of the Watching tab. */
  lead?: boolean;
};

// The name's link stretches over the whole cell (its ::after), so a tap anywhere opens the Entry;
// the "Watched it" button sits above it and stays a separate target.
export function LibraryCard({ card, eager, lead = false }: Props) {
  const { entryId, name, kind, posterPath, status, progress, latestWatchOn } = card;
  const showsNext = status === "watching" && kind === "series";

  const nameLink = (
    <Link
      href={`/entry/${entryId}`}
      className={cn(
        "block rounded-sm outline-none after:absolute after:inset-0 focus-visible:after:rounded-tile focus-visible:after:ring-3 focus-visible:after:ring-ring",
        lead ? "line-clamp-1 font-display text-xl" : "line-clamp-2 text-sm leading-tight font-bold",
      )}
    >
      {name}
    </Link>
  );

  const poster = (
    // Named for the poster on the Entry page hero; default="none" keeps it still unless it has a partner to morph into.
    <ViewTransition name={`poster-${entryId}`} share="auto" default="none">
      <Poster
        path={posterPath}
        name={name}
        size={lead ? "w500" : "w342"}
        eager={eager}
        decorative
        className={cn(
          "transition-transform duration-[450ms] ease-(--spring) group-has-[a:active]:scale-[0.97]",
          lead ? "aspect-video max-h-[40svh] w-full rounded-card [grid-area:1/1] lg:aspect-[3/1]" : "rounded-tile",
        )}
        imageClassName={lead ? "object-top" : undefined}
      />
    </ViewTransition>
  );

  const next =
    showsNext && progress ? (
      <CardNext
        entryId={entryId}
        name={name}
        heading={nameLink}
        lead={lead}
        progress={{
          nextLabel: progress.next?.label ?? null,
          episodeName: progress.next?.name ?? null,
          caughtUp: progress.caughtUp,
          allNumberedWatched: progress.allNumberedWatched,
        }}
      />
    ) : null;

  if (lead) {
    return (
      <li id={`card-${entryId}`} className="group relative col-span-full isolate grid overflow-hidden rounded-card bg-muted">
        {poster}
        <div aria-hidden className="scrim-lead z-[1] h-36 self-end [grid-area:1/1]" />
        {/* Not positioned, so the name's stretched link still covers the whole tile. */}
        <div className="z-[2] self-end px-4 pb-4 [grid-area:1/1]">{next ?? nameLink}</div>
      </li>
    );
  }

  return (
    <li id={`card-${entryId}`} className="group relative flex min-w-0 flex-col">
      {poster}
      <div className="px-0.5 pt-2">
        {next ?? (
          <>
            {nameLink}
            {status === "watched" ? (
              <p className="tabular mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                <CalendarCheck aria-hidden className="size-3.5 shrink-0" />
                <span className="sr-only">Watched: </span>
                {latestWatchOn ? formatWatchDate(latestWatchOn) : "Date unknown"}
              </p>
            ) : showsNext ? (
              <p className="mt-1 text-sm text-muted-foreground">Episodes unavailable right now</p>
            ) : null}
          </>
        )}
      </div>
    </li>
  );
}
