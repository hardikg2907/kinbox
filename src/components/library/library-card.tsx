import { CalendarCheck } from "lucide-react";
import Link from "next/link";
import { cn } from "cn";
import { TilePosterTransition } from "@/components/entry/tile-poster-transition";
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
// the "Watched it" button sits above it and stays a separate target. Press-and-hold belongs to
// Kinbox here, so the browser's own long-press menu, text selection and dragging are off.
export function LibraryCard({ card, eager, lead = false }: Props) {
  const { entryId, name, kind, posterPath, status, progress, latestWatchOn } = card;
  const showsNext = status === "watching" && kind === "series";

  const nameLink = (
    <Link
      href={`/entry/${entryId}`}
      draggable={false}
      className={cn(
        "block rounded-sm outline-none after:absolute after:inset-0 focus-visible:after:rounded-tile focus-visible:after:ring-3 focus-visible:after:ring-ring",
        lead
          ? "line-clamp-1 font-display text-xl focus-visible:after:ring-inset"
          : "line-clamp-2 text-sm leading-tight font-bold dense:line-clamp-1 rows:line-clamp-1 rows:text-base",
      )}
    >
      {name}
    </Link>
  );

  const poster = (
    <TilePosterTransition entryId={entryId}>
      <Poster
        path={posterPath}
        name={name}
        size={lead ? "w500" : "w342"}
        eager={eager}
        decorative
        className={cn(
          "transition-transform duration-[450ms] ease-(--spring) group-has-[a:active]:scale-[0.97]",
          lead
            ? "aspect-video max-h-[40svh] w-full rounded-card [grid-area:1/1] lg:aspect-[3/1]"
            : 'rounded-tile [[data-layout="4"]_&]:rounded-thumb rows:w-[46px] rows:shrink-0 rows:rounded-thumb',
        )}
        imageClassName={cn("[-webkit-user-drag:none]", lead && "object-top")}
      />
    </TilePosterTransition>
  );

  const next =
    showsNext && progress ? (
      <CardNext
        entryId={entryId}
        name={name}
        heading={nameLink}
        lead={lead}
        posterPath={posterPath}
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
      <li
        id={`card-${entryId}`}
        className="group relative col-span-full isolate grid overflow-hidden rounded-card bg-muted select-none [-webkit-touch-callout:none]"
      >
        {poster}
        <div aria-hidden className="scrim-lead z-[1] h-36 self-end [grid-area:1/1]" />
        {/* Not positioned, so the name's stretched link still covers the whole tile. */}
        <div className="z-[2] self-end px-4 pb-4 [grid-area:1/1]">{next ?? nameLink}</div>
      </li>
    );
  }

  return (
    <li
      id={`card-${entryId}`}
      className="group relative flex min-w-0 flex-col select-none [-webkit-touch-callout:none] rows:min-h-[86px] rows:flex-row rows:items-center rows:gap-3.5 rows:border-b rows:py-2"
    >
      {poster}
      <div className="px-0.5 pt-2 rows:min-w-0 rows:flex-1 rows:p-0">
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
