// Shared by the page and its skeleton so the two never drift apart.
//
// The markup is in reading order: hero header, then the sheet (Next block, overview, Seasons,
// Rating, Watches, Note, Remove). A phone, a keyboard and a screen reader all follow it.
// A phone stacks the hero over the sheet. From `lg` the hero is a tall sticky left column and
// the sheet is a panel in the right column.
export const ENTRY_SHELL = "lg:grid lg:grid-cols-[minmax(24rem,5fr)_minmax(0,7fr)]";

// The sticky piece sits inside the header, so the header can stretch to the sheet's height while the poster stays put.
export const ENTRY_HERO = "relative h-[68svh] min-h-[26rem] w-full overflow-hidden lg:sticky lg:top-0 lg:h-dvh";

export const ENTRY_SHEET =
  "glass relative z-10 -mt-6 flex min-w-0 flex-col gap-8 rounded-t-3xl border border-b-0 px-4 pt-7 pb-[max(2.5rem,env(safe-area-inset-bottom))] sm:px-6 lg:mt-20 lg:mr-6 lg:mb-6 lg:rounded-3xl lg:border-b lg:px-10 lg:pt-10 lg:pb-10";
