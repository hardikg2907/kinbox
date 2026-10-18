import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { TITLE_LAYOUT, type TitleContainer } from "./entry-layout";

/** The quick view's boxes: name, status, the Next block and the stars. */
export function TitleHeadSkeleton({ container }: { container: TitleContainer }) {
  return (
    <div data-title-head className="flex flex-col gap-4">
      <Skeleton className={container === "page" ? "h-11 w-4/5" : "h-8 w-3/5"} />
      <Skeleton className="h-12 w-36 rounded-full" />
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-11 w-40" />
          <Skeleton className="h-5 w-28" />
        </div>
        <Skeleton className="h-12 w-36 rounded-full" />
      </div>
      <Skeleton className="h-12 w-60" />
    </div>
  );
}

export function TitleHeroSkeleton({ container }: { container: TitleContainer }) {
  return (
    <div aria-hidden data-title-hero className={TITLE_LAYOUT[container].hero}>
      <Skeleton className="absolute inset-0 rounded-none" />
    </div>
  );
}

/** The same boxes as the loaded Title, so nothing moves when it arrives. `hero` replaces the plain poster box. */
export function TitleSkeleton({ container, hero }: { container: TitleContainer; hero?: ReactNode }) {
  const layout = TITLE_LAYOUT[container];
  return (
    <>
      {hero ?? <TitleHeroSkeleton container={container} />}
      <div id="entry-skeleton" data-title-body role="status" aria-label="Loading" className={layout.body}>
        <div aria-hidden className={layout.fade} />
        <TitleHeadSkeleton container={container} />
        <div aria-hidden className="flex flex-col gap-2 border-t pt-6">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-1 w-full" />
        </div>
      </div>
    </>
  );
}

export function EntrySkeleton() {
  return <TitleSkeleton container="page" />;
}
