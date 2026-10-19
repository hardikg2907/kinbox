import { cn } from "cn";
import { Skeleton } from "@/components/ui/skeleton";
import { TITLE_LAYOUT, type TitleContainer } from "./entry-layout";

/**
 * The quick view's boxes: name, status, the Next block and the stars, each as tall as the real one.
 * `nameAndStatus` keeps only the two whose height every Title shares; what follows them differs by
 * kind and Status, so a guessed box there would move when the Title arrives.
 */
export function TitleHeadSkeleton({ container, nameAndStatus = false }: { container: TitleContainer; nameAndStatus?: boolean }) {
  return (
    <div data-title-head className="flex flex-col gap-4">
      {/* One line in the real name's type holds the name's height. */}
      <div className={cn(TITLE_LAYOUT[container].name, "relative")}>
        <span className="invisible">Title</span>
        <Skeleton className="absolute inset-y-0.5 left-0 w-3/5" />
      </div>
      <Skeleton className="h-11 w-36 rounded-full" />
      {nameAndStatus ? null : (
        <>
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col gap-2">
              <Skeleton className="h-11 w-40" />
              <Skeleton className="h-5 w-28" />
            </div>
            <Skeleton className="h-12 w-36 rounded-full" />
          </div>
          <Skeleton className="h-12 w-60" />
        </>
      )}
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

/** The start of the sections below the quick view. */
export function TitleMoreSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-2 border-t pt-6">
      <Skeleton className="h-5 w-40" />
      <Skeleton className="h-1 w-full" />
    </div>
  );
}

/**
 * The Title page before anything about the Title is known (a direct link or a reload): the hero's
 * box, and the name and status at their real heights. The rest fills in below them when the Title
 * arrives, so nothing on screen moves.
 */
export function EntrySkeleton() {
  const layout = TITLE_LAYOUT.page;
  return (
    <>
      <TitleHeroSkeleton container="page" />
      <div id="entry-skeleton" data-title-body role="status" aria-label="Loading" className={layout.body}>
        <div aria-hidden className={layout.fade} />
        <TitleHeadSkeleton container="page" nameAndStatus />
      </div>
    </>
  );
}
