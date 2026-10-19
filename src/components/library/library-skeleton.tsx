import { Search, SlidersHorizontal } from "lucide-react";
import { cn } from "cn";
import { Skeleton } from "@/components/ui/skeleton";
import { STATUS_LABEL } from "@/components/status";
import { STATUSES } from "@/domain/types";
import { GRID, LAYOUTS, LEAD_BOX, WALL_CLASS } from "@/components/library/layout";

const BAR = "inline-block w-3/4 animate-pulse rounded-sm bg-muted align-top";

// Same boxes as a card: the poster, the name line, and on the Watching tab the Next line and its
// button, or on the Watched tab the date line, with the card's own type sizes so each line has the
// card's height.
function SkeletonCard() {
  return (
    <div className="flex min-w-0 flex-col rows:min-h-[86px] rows:flex-row rows:items-center rows:gap-3.5 rows:border-b rows:py-2">
      <Skeleton className='aspect-[2/3] w-full rounded-tile [[data-layout="4"]_&]:rounded-thumb rows:w-[46px] rows:shrink-0 rows:rounded-thumb' />
      <div className="px-0.5 pt-2 rows:min-w-0 rows:flex-1 rows:p-0">
        <p className="text-sm leading-tight font-bold rows:text-base">
          <span className={BAR}>&nbsp;</span>
        </p>
        <div data-skeleton-next className="rows:flex rows:items-center rows:justify-between rows:gap-3">
          <p className="mt-1 min-h-5 text-sm">
            <span className={cn(BAR, "w-1/2")}>&nbsp;</span>
          </p>
          <Skeleton className="mt-2 h-10 w-full rounded-full dense:w-11 rows:hidden" />
        </div>
        <p data-skeleton-date className="mt-1 text-sm">
          <span className={cn(BAR, "w-1/2")}>&nbsp;</span>
        </p>
      </div>
    </div>
  );
}

const COUNT = "inline-block h-[1lh] w-3 animate-pulse rounded-sm bg-current/15 align-top";

// The dock with its words in place; only the counts wait for the data. CSS slides the pill to the
// tab in the URL. Same classes as the dock in library-nav.tsx.
function SkeletonDock() {
  return (
    <div aria-hidden className="dock fixed right-[max(1rem,env(safe-area-inset-right))] bottom-[calc(env(safe-area-inset-bottom)+10px)] left-[max(1rem,env(safe-area-inset-left))] z-40 flex items-center gap-2 lg:hidden">
      <div className="glass-strong grid size-11 shrink-0 place-items-center rounded-full border shadow-[0_18px_44px_-18px_rgb(0_0_0/0.5)] sm:size-12">
        <Search className="size-5" />
      </div>
      <div className="glass-strong min-w-0 flex-1 rounded-full border px-0.5 py-1 shadow-[0_18px_44px_-18px_rgb(0_0_0/0.5)] sm:px-1">
        <div data-skeleton-tabs className="relative grid grid-cols-4">
          <div className="absolute inset-y-0 left-0 w-1/4 translate-x-[calc(var(--i,0)*100%)] rounded-full bg-primary" />
          {STATUSES.map((status) => (
            <div
              key={status}
              data-skeleton-tab={status}
              className="relative flex h-13 flex-col-reverse items-center justify-center text-[11px] leading-4 font-semibold tracking-tight whitespace-nowrap sm:text-xs"
            >
              {STATUS_LABEL[status]}
              <span className="text-[17px] leading-tight font-extrabold">
                <span className={COUNT} />
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="glass-strong grid size-11 shrink-0 place-items-center rounded-full border shadow-[0_18px_44px_-18px_rgb(0_0_0/0.5)] sm:size-12">
        <SlidersHorizontal className="size-5" />
      </div>
    </div>
  );
}

// The sidebar with everything but the counts. CSS marks the tab and the kind in the URL. Same
// classes as the sidebar in library-nav.tsx.
function SkeletonSidebar() {
  return (
    <div
      aria-hidden
      className="glass-strong fixed top-3 bottom-3 left-3 z-40 hidden w-74 flex-col gap-5 overflow-y-auto rounded-sheet border p-5 shadow-[0_22px_54px_-18px_rgb(0_0_0/0.6)] lg:flex"
    >
      <span className="-mx-2 inline-flex min-h-11 items-center self-start px-2 font-display text-3xl">Kinbox</span>
      <span className="flex min-h-12 items-center gap-3 rounded-full bg-secondary px-4 text-base text-muted-foreground">
        <Search className="size-5 shrink-0" />
        Search a movie or series
      </span>
      <div className="flex flex-col gap-1">
        {STATUSES.map((status) => (
          <span key={status} data-skeleton-side-tab={status} className="flex min-h-12 items-center justify-between rounded-full px-4 text-base font-medium">
            {STATUS_LABEL[status]}
            <span className={COUNT} />
          </span>
        ))}
      </div>
      <div>
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-muted-foreground">Show</span>
          <span data-skeleton-clear className="flex min-h-11 items-center px-3 text-sm font-semibold text-muted-foreground">
            Clear filters
          </span>
        </div>
        <div className="mt-1 grid grid-cols-3 gap-2">
          {(
            [
              ["all", "All"],
              ["movie", "Movies"],
              ["series", "Series"],
            ] as const
          ).map(([kind, label]) => (
            <span key={kind} data-skeleton-kind={kind} className="flex min-h-11 items-center justify-center rounded-full bg-secondary text-sm font-semibold">
              {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// The final Library's boxes: one wall per layout, of which CSS shows the one the head script read
// from the cookie, with the lead tile on the Watching tab and a chip when a kind filter is on (see
// the end of globals.css). The dock (or the sidebar on a wide screen) sits where the real one will,
// so nothing moves when the data arrives.
export function LibrarySkeleton() {
  return (
    <div id="library-skeleton" aria-busy="true">
      <p role="status" className="sr-only">
        Loading your library
      </p>
      <div data-skeleton-chip aria-hidden className="flex gap-2 px-2 pb-3 lg:px-3 lg:pt-3">
        <div className="glass-strong h-11 w-28 rounded-full border" />
      </div>
      <div data-skeleton-wall className="lg:pt-3">
        {LAYOUTS.map((layout) => (
          <div key={layout} data-layout={layout} className={cn(WALL_CLASS, GRID[layout])}>
            {layout === "list" ? null : <Skeleton data-skeleton-lead className={LEAD_BOX} />}
            {Array.from({ length: 10 }, (_, index) => (
              <SkeletonCard key={index} />
            ))}
          </div>
        ))}
      </div>
      <SkeletonDock />
      <SkeletonSidebar />
    </div>
  );
}
