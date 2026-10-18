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

// Centred in the screen above the dock, so the words sit where the eye rests.
export function LibraryEmpty({ tab, kind }: { tab: Status; kind: KindFilter }) {
  const Icon = STATUS_ICON[tab];
  return (
    <div
      id="library-empty"
      className={cn(
        GUTTER,
        "flex min-h-[calc(100dvh-3.5rem-6.5rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] flex-col items-center justify-center gap-4 text-center lg:min-h-[calc(100dvh-4rem)]",
      )}
    >
      <span className="flex size-14 items-center justify-center rounded-full bg-secondary text-foreground">
        <Icon aria-hidden className="size-6" />
      </span>
      <p className="max-w-sm text-lg text-pretty">{message(tab, kind)}</p>
      {tab === "to_watch" ? <FocusSearchButton /> : null}
    </div>
  );
}
