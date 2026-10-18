"use client";

import { KindBadge } from "@/components/status";
import { NextBlock, ProgressLine } from "@/components/progress/next-block";
import { SeasonsPanel } from "@/components/progress/seasons-panel";
import type { TitleKind } from "@/domain/types";
import { TITLE_LAYOUT, type TitleContainer } from "./entry-layout";
import { useEntry } from "./entry-state";
import { NoteSection } from "./note-section";
import { Overview } from "./overview";
import { RatingSection } from "./rating-section";
import { RemoveEntry } from "./remove-entry";
import { StatusPill } from "./status-pill";
import { WatchesSection } from "./watches-section";

export type TitleFacts = {
  name: string;
  year: number | null;
  kind: TitleKind;
  runtimeMinutes: number | null;
  overview: string | null;
};

function formatRuntime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

export function TitleMeta({ facts }: { facts: TitleFacts }) {
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted-foreground">
      {facts.year ? <span className="tabular">{facts.year}</span> : null}
      <KindBadge kind={facts.kind} />
      {facts.kind === "movie" && facts.runtimeMinutes ? (
        <span className="tabular">{formatRuntime(facts.runtimeMinutes)}</span>
      ) : null}
    </p>
  );
}

/** A watching, watched or dropped Series leads with its Next block; anything else with its overview. */
function useLeadsWithNext(): boolean {
  const { kind, model } = useEntry();
  return kind === "series" && model.status !== "to_watch";
}

/**
 * What the drawer's quick view shows, and the top of the full view: the name, the status, the Next
 * block (or the overview and the year, kind and runtime line) and the stars.
 */
export function TitleHead({ facts, container }: { facts: TitleFacts; container: TitleContainer }) {
  const { entryId } = useEntry();
  const leadsWithNext = useLeadsWithNext();
  const Heading = container === "page" ? "h1" : "h2";
  return (
    <div data-title-head className="flex flex-col gap-4">
      <Heading id={`title-name-${entryId}`} data-title-name className={TITLE_LAYOUT[container].name}>
        {facts.name}
      </Heading>
      <div className="flex">
        <StatusPill />
      </div>
      {leadsWithNext ? (
        <NextBlock />
      ) : (
        <div className="flex flex-col gap-2">
          {facts.overview ? <Overview text={facts.overview} lines={2} /> : null}
          <TitleMeta facts={facts} />
        </div>
      )}
      <RatingSection />
    </div>
  );
}

/** Everything below the quick view, in the order the full view reads. */
export function TitleMore({ facts, note }: { facts: TitleFacts; note: string | null }) {
  const { kind, model } = useEntry();
  const leadsWithNext = useLeadsWithNext();
  const isSeries = kind === "series";
  return (
    <div data-title-more className="flex flex-col gap-8 border-t pt-6">
      {isSeries && !leadsWithNext ? <NextBlock /> : null}
      {isSeries ? <ProgressLine /> : null}
      {leadsWithNext ? (
        <div className="flex flex-col gap-2">
          <TitleMeta facts={facts} />
          {facts.overview ? <Overview text={facts.overview} /> : null}
        </div>
      ) : null}
      {isSeries && model.series ? <SeasonsPanel /> : null}
      <WatchesSection />
      <NoteSection note={note} />
      <RemoveEntry />
    </div>
  );
}
