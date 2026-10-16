import { NextBlock } from "@/components/progress/next-block";
import { SeasonsPanel } from "@/components/progress/seasons-panel";
import type { EntryView } from "@/data/dto";
import { ENTRY_GRID, ENTRY_GRID_MOVIE, ENTRY_GRID_SERIES, entryAreas } from "./entry-layout";
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
  const area = entryAreas(isSeries);

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
        <div className={area.header}>
          <EntryHeader entryId={entry.id} title={title} />
        </div>
        {isSeries ? (
          <div className={area.next}>
            <NextBlock />
          </div>
        ) : null}
        <div className={area.rating}>
          <RatingSection />
        </div>
        <div className={area.watches}>
          <WatchesSection />
        </div>
        <div className={area.note}>
          <NoteSection note={entry.note} />
        </div>
        {isSeries && entry.series ? (
          <div className={area.seasons}>
            <SeasonsPanel />
          </div>
        ) : null}
        <div className={area.remove}>
          <RemoveEntry />
        </div>
      </div>
    </EntryProvider>
  );
}
