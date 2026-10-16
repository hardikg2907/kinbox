// Shared by the page and its skeleton so the two never drift apart.
//
// On a phone every section is a direct child of one column, ordered with
// `order-*`. From `lg` the two wrappers become real columns, so the same markup
// reads as: header, rating, watches, note on the left; progress and seasons on the right.
export const ENTRY_GRID = "flex flex-col gap-8 lg:items-start lg:gap-x-14 lg:gap-y-8";
export const ENTRY_GRID_SERIES = "lg:grid lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]";
export const ENTRY_GRID_MOVIE = "lg:max-w-xl";
export const ENTRY_COLUMN = "contents lg:flex lg:min-w-0 lg:flex-col lg:gap-8";
