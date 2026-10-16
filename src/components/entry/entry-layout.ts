// Shared by the page and its skeleton so the two never drift apart.
//
// The markup is in reading order: header, Next block, Rating, Watches, Note, Seasons, Remove.
// A phone, a keyboard and a screen reader all follow it. From `lg` the Series layout puts each
// section in its own grid cell, so the Next block and the Seasons form a right column without
// any change to that order.
export const ENTRY_GRID = "grid grid-cols-1 gap-8 lg:items-start lg:gap-x-14";
// The Note row takes the spare height, so a long Season list never stretches the gaps above it.
export const ENTRY_GRID_SERIES =
  "lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] lg:grid-rows-[auto_auto_auto_1fr_auto]";
export const ENTRY_GRID_MOVIE = "lg:max-w-xl";

export type EntryArea = "header" | "next" | "rating" | "watches" | "note" | "seasons" | "remove";

const SERIES_AREAS: Record<EntryArea, string> = {
  header: "min-w-0 lg:col-start-1 lg:row-start-1",
  next: "min-w-0 lg:col-start-2 lg:row-start-1 lg:self-stretch",
  rating: "min-w-0 lg:col-start-1 lg:row-start-2",
  watches: "min-w-0 lg:col-start-1 lg:row-start-3",
  note: "min-w-0 lg:col-start-1 lg:row-start-4",
  seasons: "min-w-0 lg:col-start-2 lg:row-start-2 lg:row-span-3",
  remove: "min-w-0 lg:col-span-2 lg:row-start-5",
};

// A Movie has one column, so its sections just follow each other.
const MOVIE_AREAS: Record<EntryArea, string> = {
  header: "min-w-0",
  next: "min-w-0",
  rating: "min-w-0",
  watches: "min-w-0",
  note: "min-w-0",
  seasons: "min-w-0",
  remove: "min-w-0",
};

export function entryAreas(isSeries: boolean): Record<EntryArea, string> {
  return isSeries ? SERIES_AREAS : MOVIE_AREAS;
}
