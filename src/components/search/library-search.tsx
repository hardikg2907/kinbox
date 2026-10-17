"use client";

import { Search, SearchX, TriangleAlert, X } from "lucide-react";
import Link from "next/link";
import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { GUTTER } from "@/components/gutter";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchResultRow } from "@/components/search/search-result-row";
import { SearchSkeleton } from "@/components/search/search-skeleton";
import { SEARCH_INPUT_ID } from "@/components/search/search-ids";
import { useTitleSearch, type SearchOutcome } from "@/components/search/use-title-search";

/**
 * The search field and its results. `children` is the server-rendered Library: it stays
 * mounted (only hidden) while results show, so clearing the field brings it back at once.
 */
export function LibrarySearch({ children }: { children: ReactNode }) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const outcome = useTitleSearch(query);
  const searching = outcome.phase !== "idle";

  function clear() {
    setQuery("");
    inputRef.current?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Escape" || query === "") return;
    event.preventDefault();
    setQuery("");
  }

  return (
    <div>
      <div className={GUTTER}>
        <form id="search-form" role="search" onSubmit={(event) => event.preventDefault()} className="relative pb-3 sm:max-w-2xl">
          <Label htmlFor={SEARCH_INPUT_ID} className="sr-only">
            Search a movie or series
          </Label>
          <Search aria-hidden className="pointer-events-none absolute top-6 left-4.5 size-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={inputRef}
            id={SEARCH_INPUT_ID}
            type="search"
            name="q"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onKeyDown}
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
              className="absolute top-6 right-0.5 flex size-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring focus-visible:outline-none"
            >
              <X aria-hidden className="size-5" />
            </button>
          ) : null}
        </form>
      </div>

      {searching ? <SearchResults outcome={outcome} /> : null}
      <div hidden={searching}>{children}</div>
    </div>
  );
}

function SearchResults({ outcome }: { outcome: SearchOutcome }) {
  return (
    <div id="search-results" aria-busy={outcome.phase === "loading"} className={GUTTER}>
      <div className="max-w-2xl">
        <SearchStatus outcome={outcome} />
        {outcome.phase === "loading" ? <SearchSkeleton /> : null}
        {outcome.phase === "results" ? (
          <ul id="search-list" className="glass mt-3 flex flex-col rounded-3xl border p-2">
            {outcome.items.map((item) => (
              <SearchResultRow key={`${item.kind}-${item.tmdbId}`} item={item} />
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

// One polite live region: it announces the count, the empty text or the error as they arrive.
function SearchStatus({ outcome }: { outcome: SearchOutcome }) {
  switch (outcome.phase) {
    case "results":
      return (
        <p id="search-status" role="status" className="tabular px-1 text-sm text-muted-foreground">
          {outcome.items.length === 1 ? "1 result" : `${outcome.items.length} results`}
        </p>
      );
    case "empty":
      return (
        <p id="search-status" role="status" className="mx-auto flex max-w-sm flex-col items-center gap-3 px-2 py-12 text-center text-base text-pretty [overflow-wrap:anywhere]">
          <SearchX aria-hidden className="size-6 text-muted-foreground" />
          <span>No matches for “{outcome.query}”. Check the spelling or try the original title.</span>
        </p>
      );
    case "error":
      return (
        <p id="search-status" role="status" className="mx-auto flex max-w-sm flex-col items-center gap-3 px-2 py-12 text-center text-base text-pretty">
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
        <p id="search-status" role="status" className="px-1 text-sm text-muted-foreground">
          Searching…
        </p>
      );
  }
}
