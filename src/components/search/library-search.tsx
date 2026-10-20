"use client";

import { Search, SearchX, TriangleAlert, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Sheet } from "@/components/library/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { clearSearchCache } from "@/components/search/search-cache";
import { SearchResultRow } from "@/components/search/search-result-row";
import { SearchSkeleton } from "@/components/search/search-skeleton";
import { SEARCH_INPUT_ID } from "@/components/search/search-ids";
import { SearchSheetContext } from "@/components/search/search-sheet-context";
import type { SearchOutcome } from "@/components/search/search-view";
import { useTitleSearch } from "@/components/search/use-title-search";

/**
 * Owns the search state and the sheet it shows in. The dock and the desktop sidebar open the
 * sheet through context. `children` is the page, which stays mounted under the sheet.
 */
export function LibrarySearch({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const opener = useRef<HTMLElement | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Counts sheet openings: each one starts from a clear cache and ignores answers from before it.
  const [opening, setOpening] = useState(0);
  const outcome = useTitleSearch(query, opening);
  const keyboard = useKeyboardInset(open);

  const openSheet = useCallback((element: HTMLElement) => {
    opener.current = element;
    clearSearchCache();
    setOpening((count) => count + 1);
    setOpen(true);
  }, []);
  const context = useMemo(() => ({ open: openSheet }), [openSheet]);

  function clear() {
    setQuery("");
    inputRef.current?.focus();
  }

  return (
    <SearchSheetContext value={context}>
      {children}
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        label="Search"
        openerRef={opener}
        initialFocusId={SEARCH_INPUT_ID}
        origin="28px calc(100% - 28px)"
        style={{ bottom: `calc(env(safe-area-inset-bottom) + 10px + ${keyboard}px)` }}
        className="top-[calc(env(safe-area-inset-top)+10px)] right-[max(1rem,env(safe-area-inset-right))] left-[max(1rem,env(safe-area-inset-left))] lg:inset-x-auto lg:top-3 lg:left-80 lg:w-[34rem] lg:max-w-[calc(100vw-21rem)]"
      >
        <div className="flex justify-end px-3 pt-3">
          <button
            id="search-close"
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close"
            className="flex size-11 cursor-pointer items-center justify-center rounded-full bg-secondary text-foreground transition-colors hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring focus-visible:outline-none"
          >
            <X aria-hidden className="size-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3">
          {outcome.phase !== "idle" ? (
            <SearchResults outcome={outcome} />
          ) : (
            <p id="search-hint" className="flex h-full items-center justify-center px-6 text-center text-base text-pretty text-muted-foreground">
              Search for a movie or series to save it.
            </p>
          )}
        </div>
        <form id="search-form" role="search" onSubmit={(event) => event.preventDefault()} className="relative p-3">
          <Label htmlFor={SEARCH_INPUT_ID} className="sr-only">
            Search a movie or series
          </Label>
          <Search aria-hidden className="pointer-events-none absolute top-1/2 left-7.5 size-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={inputRef}
            id={SEARCH_INPUT_ID}
            type="search"
            name="q"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search a movie or series"
            enterKeyHint="search"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            maxLength={100}
            className="h-12 pr-12 pl-12 text-base [&::-webkit-search-cancel-button]:appearance-none"
          />
          {query !== "" ? (
            <button
              id="search-clear"
              type="button"
              onClick={clear}
              aria-label="Clear search"
              className="absolute top-1/2 right-3.5 flex size-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring focus-visible:outline-none"
            >
              <X aria-hidden className="size-5" />
            </button>
          ) : null}
        </form>
      </Sheet>
    </SearchSheetContext>
  );
}

// iOS keeps fixed elements where the layout viewport ends, under the keyboard. The sheet lifts by the covered height so the field stays visible.
function useKeyboardInset(active: boolean): number {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!active || !viewport) return;
    const update = () => setInset(Math.max(0, Math.round(window.innerHeight - viewport.height - viewport.offsetTop)));
    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
    };
  }, [active]);
  return active ? inset : 0;
}

function SearchResults({ outcome }: { outcome: SearchOutcome }) {
  const library = outcome.phase === "loading" || outcome.phase === "results" || outcome.phase === "error" ? outcome.library : [];
  const loading = outcome.phase === "loading";
  const hasTmdbRows = outcome.phase === "results" && outcome.items.length > 0;

  // The children keep fixed positions, so the status node is never remounted. After an error it is moved
  // below the Library rows with CSS order, which keeps screen readers and focus undisturbed.
  return (
    <div id="search-results" className="flex flex-col">
      <SearchStatus outcome={outcome} />
      {library.length > 0 ? (
        <section aria-labelledby="search-library-heading">
          <h2 id="search-library-heading" className="px-3 pt-2 pb-1 text-sm font-medium text-muted-foreground">
            In your library
          </h2>
          <ul id="search-library-list" className="flex flex-col">
            {library.map((item) => (
              <SearchResultRow key={`${item.kind}-${item.tmdbId}`} item={item} />
            ))}
          </ul>
        </section>
      ) : null}
      {loading || hasTmdbRows ? (
        <div aria-busy={loading}>
          {loading ? <SearchSkeleton /> : null}
          {outcome.phase === "results" && hasTmdbRows ? (
            <ul id="search-list" className={library.length > 0 ? "flex flex-col border-t" : "flex flex-col"}>
              {outcome.items.map((item) => (
                <SearchResultRow key={`${item.kind}-${item.tmdbId}`} item={item} />
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

// One polite live region: it announces the count, the empty text or the error as they arrive.
function SearchStatus({ outcome }: { outcome: SearchOutcome }) {
  switch (outcome.phase) {
    case "results": {
      const count = outcome.library.length + outcome.items.length;
      return (
        <p id="search-status" role="status" className="tabular px-3 pb-1 text-sm text-muted-foreground">
          {count === 1 ? "1 result" : `${count} results`}
        </p>
      );
    }
    case "empty":
      return (
        <p id="search-status" role="status" className="mx-auto flex max-w-sm flex-col items-center gap-3 px-2 py-12 text-center text-base text-pretty [overflow-wrap:anywhere]">
          <SearchX aria-hidden className="size-6 text-muted-foreground" />
          <span>No matches for “{outcome.query}”. Check the spelling or try the original title.</span>
        </p>
      );
    case "error":
      return (
        <p id="search-status" role="status" className="order-last mx-auto flex max-w-sm flex-col items-center gap-3 px-2 py-12 text-center text-base text-pretty">
          <TriangleAlert aria-hidden className="size-6 text-muted-foreground" />
          <span>{outcome.message}</span>
          {outcome.signedOut ? (
            <Link href="/sign-in" className="min-h-11 content-center font-medium underline underline-offset-4">
              Sign in
            </Link>
          ) : null}
        </p>
      );
    default:
      return (
        <p id="search-status" role="status" className="px-3 text-sm text-muted-foreground">
          Searching…
        </p>
      );
  }
}
