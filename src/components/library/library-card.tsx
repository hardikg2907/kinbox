import { CalendarCheck } from "lucide-react";
import Link from "next/link";
import { ViewTransition } from "react";
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

export function LibraryCard({ card, eager }: Props) {
  const { entryId, name, year, kind, posterPath, status, progress, latestWatchOn } = card;
  const showsNext = status === "watching" && kind === "series";

  return (
    <li id={`card-${entryId}`} className="flex flex-col gap-2">
      <Link
        href={`/entry/${entryId}`}
        className="group flex flex-col gap-2 rounded-lg focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        {/* Named for the poster on the Entry page header; default="none" keeps it still unless it has a partner to morph into. */}
        <ViewTransition name={`poster-${entryId}`} share="auto" default="none">
          <Poster
            path={posterPath}
            name={name}
            size="w342"
            eager={eager}
            className="transition-transform duration-200 ease-out group-hover:scale-[1.02] group-active:scale-[0.98]"
          />
        </ViewTransition>
        <div className="px-0.5">
          <p className="line-clamp-2 text-sm leading-snug font-medium">{name}</p>
          <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
            {year !== null ? <span className="tabular">{year}</span> : null}
            <KindBadge kind={kind} />
          </div>
          {status === "watched" ? (
            <p className="tabular mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              <CalendarCheck aria-hidden className="size-3.5 shrink-0" />
              <span className="sr-only">Watched: </span>
              {latestWatchOn ? formatWatchDate(latestWatchOn) : "Date unknown"}
            </p>
          ) : null}
        </div>
      </Link>
      {showsNext ? (
        progress ? (
          <CardNext
            entryId={entryId}
            progress={{
              nextLabel: progress.next?.label ?? null,
              caughtUp: progress.caughtUp,
              allNumberedWatched: progress.allNumberedWatched,
            }}
          />
        ) : (
          <p className="px-0.5 text-xs text-muted-foreground">Episodes unavailable right now</p>
        )
      ) : null}
    </li>
  );
}
