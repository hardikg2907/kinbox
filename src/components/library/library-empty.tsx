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

export function LibraryEmpty({ tab, kind }: { tab: Status; kind: KindFilter }) {
  const Icon = STATUS_ICON[tab];
  return (
    <div className={cn(GUTTER, "pt-2")}>
      <div
        id="library-empty"
        className="glass mx-auto flex max-w-md flex-col items-center gap-4 rounded-3xl border px-6 py-12 text-center"
      >
        <span className="flex size-14 items-center justify-center rounded-full bg-secondary text-foreground">
          <Icon aria-hidden className="size-6" />
        </span>
        <p className="text-lg text-pretty">{message(tab, kind)}</p>
        {tab === "to_watch" ? <FocusSearchButton /> : null}
      </div>
    </div>
  );
}
