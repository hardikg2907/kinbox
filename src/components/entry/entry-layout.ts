// Shared by the page and its skeleton so the two never drift apart.
//
// The markup is in reading order: header, progress (Next block, then Seasons), details
// (Rating, Watches, Note), Remove. A phone, a keyboard and a screen reader all follow it.
// From `lg` a Series puts the progress group in its own right column spanning the header and
// details rows, so Seasons sit right under the Next block whatever the header's height. The
// details row is the flexible one, so a long Season list never opens a gap under the header.
export const ENTRY_GRID = "grid grid-cols-1 gap-8 lg:items-start lg:gap-x-14";
export const ENTRY_GRID_SERIES = "lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] lg:grid-rows-[auto_1fr_auto]";
export const ENTRY_GRID_MOVIE = "lg:max-w-xl";

export type EntryArea = "header" | "progress" | "details" | "remove";

const SERIES_AREAS: Record<EntryArea, string> = {
  header: "min-w-0 lg:col-start-1 lg:row-start-1",
  progress: "flex min-w-0 flex-col gap-8 lg:col-start-2 lg:row-span-2 lg:row-start-1",
  details: "flex min-w-0 flex-col gap-8 lg:col-start-1 lg:row-start-2",
  remove: "min-w-0 lg:col-span-2 lg:row-start-3",
};

// A Movie has one column, so its sections just follow each other.
const MOVIE_AREAS: Record<EntryArea, string> = {
  header: "min-w-0",
  progress: "flex min-w-0 flex-col gap-8",
  details: "flex min-w-0 flex-col gap-8",
  remove: "min-w-0",
};

export function entryAreas(isSeries: boolean): Record<EntryArea, string> {
  return isSeries ? SERIES_AREAS : MOVIE_AREAS;
}
