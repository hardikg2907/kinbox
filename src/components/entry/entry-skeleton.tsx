import { cn } from "cn";
import { Skeleton } from "@/components/ui/skeleton";
import { ENTRY_GRID, ENTRY_GRID_SERIES, entryAreas } from "./entry-layout";

const area = entryAreas(true);

// Same grid and the same box sizes as the loaded page, so nothing moves when it arrives.
export function EntrySkeleton() {
  return (
    <div
      id="entry-skeleton"
      role="status"
      aria-label="Loading"
      className={cn(ENTRY_GRID, ENTRY_GRID_SERIES)}
    >
      <div className={cn(area.header, "flex gap-4")}>
        <Skeleton className="aspect-[2/3] w-28 shrink-0 self-start sm:w-36" />
        <div className="flex min-w-0 flex-1 flex-col gap-3 pt-1">
          <Skeleton className="h-8 w-4/5 sm:h-10" />
          <Skeleton className="h-5 w-32" />
          <Skeleton className="mt-1 h-11 w-40" />
        </div>
      </div>
      <div className={cn(area.next, "rounded-2xl bg-card p-5 ring-1 ring-foreground/10")}>
        <Skeleton className="h-9 w-48 sm:h-12" />
        <Skeleton className="mt-3 h-5 w-56" />
        <Skeleton className="mt-5 h-12 w-full sm:w-44" />
        <Skeleton className="mt-5 h-5 w-32" />
      </div>
      <div className={cn(area.rating, "flex flex-col gap-2")}>
        <Skeleton className="h-6 w-16" />
        <Skeleton className="h-12 w-60" />
      </div>
      <div className={cn(area.watches, "flex flex-col gap-2")}>
        <Skeleton className="h-6 w-20" />
        <Skeleton className="h-12 w-full" />
      </div>
      <div className={cn(area.note, "flex flex-col gap-2")}>
        <Skeleton className="h-6 w-14" />
        <Skeleton className="h-24 w-full" />
      </div>
      <div
        className={cn(
          area.seasons,
          "flex flex-col gap-2 rounded-2xl bg-card px-4 py-2 ring-1 ring-foreground/10",
        )}
      >
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    </div>
  );
}
