import { Skeleton } from "@/components/ui/skeleton";

// Same shape as a result row: poster, two text lines, a row of three buttons (beside the text from the sm width).
export function SearchSkeleton() {
  return (
    <ul id="search-skeleton" aria-hidden className="mt-3 flex flex-col gap-3">
      {Array.from({ length: 4 }, (_, index) => (
        <li key={index} className="rounded-xl border bg-card p-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-3">
              <Skeleton className="aspect-[2/3] w-16 shrink-0" />
              <div className="flex flex-1 flex-col gap-2 py-1">
                <Skeleton className="h-5 w-40 max-w-full" />
                <Skeleton className="h-5 w-24" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:flex">
              <Skeleton className="h-11 sm:w-24" />
              <Skeleton className="h-11 sm:w-24" />
              <Skeleton className="h-11 sm:w-24" />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
