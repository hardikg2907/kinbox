import { Skeleton } from "@/components/ui/skeleton";
import { ENTRY_HERO, ENTRY_SHEET, ENTRY_SHELL } from "./entry-layout";

// Same shell and the same box sizes as the loaded page, so nothing moves when it arrives.
export function EntrySkeleton() {
  return (
    <div id="entry-skeleton" role="status" aria-label="Loading" className={ENTRY_SHELL}>
      <div className="relative lg:self-stretch">
        <div className={ENTRY_HERO}>
          <Skeleton className="absolute inset-0 rounded-none" />
          <div className="scrim-hero absolute inset-x-0 bottom-0 flex flex-col gap-3 px-4 pt-28 pb-10 sm:px-6">
            <Skeleton className="h-10 w-4/5 sm:h-12" />
            <Skeleton className="h-6 w-40 rounded-full" />
            <Skeleton className="mt-1 h-11 w-40 rounded-full" />
          </div>
        </div>
      </div>
      <div className={ENTRY_SHEET}>
        <div className="rounded-3xl bg-secondary p-5">
          <Skeleton className="h-10 w-48 sm:h-12" />
          <Skeleton className="mt-3 h-5 w-56" />
          <Skeleton className="mt-5 h-12 w-full rounded-full sm:w-44" />
          <Skeleton className="mt-5 h-5 w-32" />
        </div>
        <div className="flex flex-col gap-2">
          <Skeleton className="h-14 w-full rounded-2xl" />
          <Skeleton className="h-14 w-full rounded-2xl" />
          <Skeleton className="h-14 w-full rounded-2xl" />
        </div>
        <div className="flex flex-col gap-2">
          <Skeleton className="h-6 w-16" />
          <Skeleton className="h-12 w-60" />
        </div>
        <div className="flex flex-col gap-2">
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-12 w-full rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
