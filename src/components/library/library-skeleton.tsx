import { Skeleton } from "@/components/ui/skeleton";
import { GRID_CLASS } from "@/components/library/library-grid";

// Same boxes as the final Library: four tab pills, three kind pills, 2:3 posters under a two-line name.
export function LibrarySkeleton() {
  return (
    <div id="library-skeleton" aria-busy="true">
      <p role="status" className="sr-only">
        Loading your library
      </p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="-mx-4 flex gap-2 overflow-hidden px-4 py-2 sm:mx-0 sm:px-0">
          {["w-28", "w-28", "w-28", "w-28"].map((width, index) => (
            <Skeleton key={index} className={`h-11 shrink-0 rounded-full ${width}`} />
          ))}
        </div>
        <div className="flex gap-2">
          {["w-14", "w-24", "w-24"].map((width, index) => (
            <Skeleton key={index} className={`h-11 rounded-lg ${width}`} />
          ))}
        </div>
      </div>
      <div className={`${GRID_CLASS} mt-4`}>
        {Array.from({ length: 10 }, (_, index) => (
          <div key={index} className="flex flex-col gap-2">
            <Skeleton className="aspect-[2/3] w-full rounded-md" />
            <Skeleton className="mx-0.5 h-4 w-4/5" />
            <Skeleton className="mx-0.5 h-3.5 w-1/2" />
          </div>
        ))}
      </div>
    </div>
  );
}
