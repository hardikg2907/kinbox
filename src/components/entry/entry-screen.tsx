import { NextBlock } from "@/components/progress/next-block";
import { SeasonsPanel } from "@/components/progress/seasons-panel";
import type { EntryView } from "@/data/dto";
import { ENTRY_COLUMN, ENTRY_GRID, ENTRY_GRID_MOVIE, ENTRY_GRID_SERIES } from "./entry-layout";
import { EntryProvider } from "./entry-state";
import { EntryHeader, EntryScrim } from "./entry-header";
import { NoteSection } from "./note-section";
import { RatingSection } from "./rating-section";
import { RemoveEntry } from "./remove-entry";
import { WatchesSection } from "./watches-section";
import { cn } from "cn";

export function EntryScreen({ entry }: { entry: EntryView }) {
  const { title } = entry;
  const isSeries = title.kind === "series";

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
      <EntryScrim posterPath={title.posterPath} />
      <div id="entry-content" className={cn(ENTRY_GRID, isSeries ? ENTRY_GRID_SERIES : ENTRY_GRID_MOVIE)}>
        <div className={ENTRY_COLUMN}>
          <div className="order-1">
            <EntryHeader entryId={entry.id} title={title} />
          </div>
          <div className="order-3">
            <RatingSection />
          </div>
          <div className="order-4">
            <WatchesSection />
          </div>
          <div className="order-5">
            <NoteSection note={entry.note} />
          </div>
        </div>
        {isSeries ? (
          <div className={ENTRY_COLUMN}>
            <div className="order-2">
              <NextBlock />
            </div>
            {entry.series ? (
              <div className="order-6">
                <SeasonsPanel />
              </div>
            ) : null}
          </div>
        ) : null}
        <div className="order-7 lg:col-span-2">
          <RemoveEntry />
        </div>
      </div>
    </EntryProvider>
  );
}
