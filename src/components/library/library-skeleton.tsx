import { Skeleton } from "@/components/ui/skeleton";
import { GRID_CLASS } from "@/components/library/library-grid";

// Same boxes as the final Library: the wall of 2:3 posters with their name lines, and an empty dock
// frame (or sidebar frame on a wide screen), so nothing moves when the data arrives.
export function LibrarySkeleton() {
  return (
    <div id="library-skeleton" aria-busy="true" className="lg:pt-3">
      <p role="status" className="sr-only">
        Loading your library
      </p>
      <div className={GRID_CLASS}>
        {Array.from({ length: 10 }, (_, index) => (
          <div key={index}>
            <Skeleton className="aspect-[2/3] w-full rounded-tile" />
            <Skeleton className="mt-2 h-4 w-3/4" />
          </div>
        ))}
      </div>
      <div aria-hidden className="dock fixed right-[max(10px,env(safe-area-inset-right))] bottom-[calc(env(safe-area-inset-bottom)+10px)] left-[max(10px,env(safe-area-inset-left))] z-40 flex items-center gap-1.5 lg:hidden">
        <div className="glass-strong size-12 shrink-0 rounded-full border" />
        <div className="glass-strong h-15 flex-1 rounded-full border" />
        <div className="glass-strong size-12 shrink-0 rounded-full border" />
      </div>
      <div aria-hidden className="glass-strong fixed top-3 bottom-3 left-3 z-40 hidden w-74 rounded-sheet border lg:block" />
    </div>
  );
}
