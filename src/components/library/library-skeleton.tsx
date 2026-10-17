import { Skeleton } from "@/components/ui/skeleton";
import { GRID_CLASS } from "@/components/library/library-grid";
import { GUTTER } from "@/components/gutter";
import { cn } from "cn";

// Same boxes as the final Library: the tab bar, the kind row, the tonight row, and the wall of 2:3 posters.
export function LibrarySkeleton() {
  return (
    <div id="library-skeleton" aria-busy="true">
      <p role="status" className="sr-only">
        Loading your library
      </p>
      <div className="glass-strong border-y">
        <div className={cn(GUTTER, "flex gap-2 overflow-hidden py-[6px]")}>
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-11 flex-1 rounded-full sm:w-28 sm:flex-none" />
          ))}
        </div>
      </div>
      <div className={cn(GUTTER, "mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between")}>
        <div className="flex gap-2">
          {["w-14", "w-24", "w-24"].map((width, index) => (
            <Skeleton key={index} className={`h-11 rounded-full ${width}`} />
          ))}
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-11 w-28 rounded-full" />
          <Skeleton className="h-11 w-20 rounded-full" />
          <Skeleton className="h-11 w-32 rounded-full" />
        </div>
      </div>
      <div className={`${GRID_CLASS} mt-4`}>
        {Array.from({ length: 10 }, (_, index) => (
          <Skeleton key={index} className="aspect-[2/3] w-full rounded-none" />
        ))}
      </div>
    </div>
  );
}
