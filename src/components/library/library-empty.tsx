import { cn } from "cn";
import type { KindFilter } from "@/data/dto";
import { GUTTER } from "@/components/gutter";
import type { Status } from "@/domain/types";
import { STATUS_ICON } from "@/components/status";
import { FocusSearchButton } from "@/components/library/focus-search-button";

const NOUN: Record<KindFilter, string> = { all: "movies and series", movie: "movies", series: "series" };

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function message(tab: Status, kind: KindFilter): string {
  switch (tab) {
    case "to_watch":
      return kind === "all"
        ? "Nothing saved yet. Search for a movie or series to save it."
        : `No ${NOUN[kind]} saved yet. Search for a ${kind} to save it.`;
    case "watching":
      return `${capitalise(NOUN[kind])} you're watching show up here.`;
    case "watched":
      return `${capitalise(NOUN[kind])} you've finished show up here.`;
    case "dropped":
      return `${capitalise(NOUN[kind])} you stopped watching show up here.`;
  }
}

const FRAME = "absolute bottom-0 aspect-[2/3] rounded-tile border bg-muted";

// Centred in the space the wall would fill (above the dock on a phone, beside the sidebar on
// desktop), a little above the middle where the eye rests. Three empty poster frames, fanned like a
// corner of the wall, carry the tab's icon, so the space reads as a wall waiting for posters.
export function LibraryEmpty({ tab, kind }: { tab: Status; kind: KindFilter }) {
  const Icon = STATUS_ICON[tab];
  return (
    <div
      id="library-empty"
      className={cn(
        GUTTER,
        "flex min-h-[calc(100dvh-3.5rem-6.5rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] flex-col items-center justify-center gap-6 pb-[6dvh] text-center lg:min-h-[calc(100dvh-8rem)] lg:gap-8",
      )}
    >
      <div aria-hidden className="relative h-24 w-32 lg:h-34 lg:w-44">
        <span className={cn(FRAME, "left-0 w-[46%] origin-bottom-right -rotate-8 opacity-60")} />
        <span className={cn(FRAME, "right-0 w-[46%] origin-bottom-left rotate-8 opacity-60")} />
        <span className={cn(FRAME, "left-1/2 grid w-1/2 -translate-x-1/2 place-items-center text-muted-foreground shadow-[0_14px_30px_-14px_rgb(0_0_0/0.45)]")}>
          <Icon className="size-6 lg:size-8" />
        </span>
      </div>
      <p className="max-w-sm text-lg text-pretty lg:max-w-md lg:text-xl">{message(tab, kind)}</p>
      {tab === "to_watch" ? <FocusSearchButton /> : null}
    </div>
  );
}
