import { ViewTransition } from "react";
import { NotOutYetMock } from "@/components/not-out-yet-mock";
import { KindBadge } from "@/components/status";
import { Poster } from "@/components/poster";
import type { EntryView } from "@/data/dto";
import { ENTRY_HERO } from "./entry-layout";
import { StatusMenu } from "./status-menu";

function formatRuntime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

// The hero: the Title's own poster, uncropped but for its foot, runs edge to edge from behind the
// app header. Two scrims keep text at AA over any poster: one under the header, and one at the foot
// that turns into the page colour, where the name and the Status sit.
export function EntryHeader({ entryId, title }: { entryId: string; title: EntryView["title"] }) {
  return (
    <header id="entry-header" className="relative lg:self-stretch">
      <div className={ENTRY_HERO}>
        <ViewTransition name={`poster-${entryId}`} share="auto" default="none">
          <Poster
            path={title.posterPath}
            name={title.name}
            size="w500"
            eager
            className="absolute inset-0 aspect-auto rounded-none"
            imageClassName="object-top"
          />
        </ViewTransition>
        <div aria-hidden className="absolute inset-x-0 top-0 h-36 scrim-top" />
        <div className="scrim-hero absolute inset-x-0 bottom-0 flex flex-col gap-3 px-4 pt-28 pb-10 sm:px-6">
          <h1 className="font-display text-4xl wrap-break-word text-foreground sm:text-5xl">{title.name}</h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-base text-muted-foreground">
            {title.year ? <span className="tabular">{title.year}</span> : null}
            <KindBadge kind={title.kind} />
            {title.kind === "movie" && title.runtimeMinutes ? (
              <span className="tabular">{formatRuntime(title.runtimeMinutes)}</span>
            ) : null}
            <NotOutYetMock name={title.name} />
          </div>
          <div className="mt-1 flex">
            <StatusMenu />
          </div>
        </div>
      </div>
    </header>
  );
}
