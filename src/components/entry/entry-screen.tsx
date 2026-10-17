import { NextBlock } from "@/components/progress/next-block";
import { SeasonsPanel } from "@/components/progress/seasons-panel";
import type { EntryView } from "@/data/dto";
import { ENTRY_SHEET, ENTRY_SHELL } from "./entry-layout";
import { EntryProvider } from "./entry-state";
import { EntryHeader } from "./entry-header";
import { NoteSection } from "./note-section";
import { Overview } from "./overview";
import { RatingSection } from "./rating-section";
import { RemoveEntry } from "./remove-entry";
import { WatchesSection } from "./watches-section";

export function EntryScreen({ entry }: { entry: EntryView }) {
  const { title } = entry;
  const isSeries = title.kind === "series";
  const overview = title.overview ? <Overview text={title.overview} /> : null;

  return (
    <EntryProvider
      entry={{
        id: entry.id,
        name: title.name,
        kind: title.kind,
        status: entry.status,
        ratingHalfStars: entry.ratingHalfStars,
        watches: entry.watches,
        series: entry.series,
        tmdbUnavailable: entry.tmdbUnavailable,
      }}
    >
      <div id="entry-content" className={ENTRY_SHELL}>
        <EntryHeader entryId={entry.id} title={title} />
        <div className={ENTRY_SHEET}>
          {/* A Series opens with its Next block, the one thing to tap; a Movie opens with its overview. */}
          {isSeries ? <NextBlock /> : overview}
          {isSeries ? overview : null}
          {isSeries && entry.series ? <SeasonsPanel /> : null}
          <RatingSection />
          <WatchesSection />
          <NoteSection note={entry.note} />
          <RemoveEntry />
        </div>
      </div>
    </EntryProvider>
  );
}
