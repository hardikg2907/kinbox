import { ViewTransition } from "react";
import { KindBadge } from "@/components/status";
import { Poster } from "@/components/poster";
import type { EntryView } from "@/data/dto";
import { posterUrl } from "@/lib/tmdb/images";
import { Overview } from "./overview";
import { StatusMenu } from "./status-menu";

function formatRuntime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

// The Title's own poster, blurred and washed toward the page colour. No ancestor is
// positioned, so it measures against the page itself: it runs edge to edge from behind the
// app header and fades out at the bottom. The wash keeps text at AA contrast on any poster.
export function EntryScrim({ posterPath }: { posterPath: string | null }) {
  const src = posterUrl(posterPath, "w342");
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[28rem] overflow-hidden scrim-fade"
    >
      {src ? (
        // TMDB serves sized posters, so next/image optimisation would only spend quota.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          decoding="async"
          className="absolute inset-0 size-full scale-125 object-cover opacity-60 blur-2xl saturate-150"
        />
      ) : null}
      <div className="absolute inset-0 scrim-wash" />
    </div>
  );
}

export function EntryHeader({ entryId, title }: { entryId: string; title: EntryView["title"] }) {
  return (
    <header id="entry-header" className="flex flex-col gap-4">
      <div className="flex gap-4">
        <ViewTransition name={`poster-${entryId}`} share="auto" default="none">
          <Poster
            path={title.posterPath}
            name={title.name}
            size="w500"
            eager
            className="w-28 shrink-0 self-start shadow-lg ring-1 ring-foreground/10 sm:w-36"
          />
        </ViewTransition>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <h1 className="font-display text-3xl wrap-break-word text-foreground sm:text-4xl">
            {title.name}
          </h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            {title.year ? <span className="tabular">{title.year}</span> : null}
            <KindBadge kind={title.kind} />
            {title.kind === "movie" && title.runtimeMinutes ? (
              <span className="tabular">{formatRuntime(title.runtimeMinutes)}</span>
            ) : null}
          </div>
          <div className="mt-1 flex">
            <StatusMenu />
          </div>
        </div>
      </div>
      {title.overview ? <Overview text={title.overview} /> : null}
    </header>
  );
}
