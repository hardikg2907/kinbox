"use client";

import { Check, Search, SearchX, TriangleAlert, X } from "lucide-react";
import Link from "next/link";
import { useState, type RefObject } from "react";
import { cn } from "cn";
import { Sheet } from "@/components/library/sheet";
import { Poster } from "@/components/poster";
import { useKeyboardInset } from "@/components/search/library-search";
import { useTitleSearch } from "@/components/search/use-title-search";
import { KindBadge } from "@/components/status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import type { ImportCandidate } from "@/data/dto";
import { FOCUS } from "./import-frame";
import { candidateFromSearch, titleKey } from "./import-model";

export type PickTarget = {
  lineIds: number[];
  /** The pasted lines being picked for, shown so the Owner knows what they are matching. */
  originals: string[];
  candidates: ImportCandidate[];
  /** Filled into the search field when there are no candidates to offer. */
  query: string;
  current: ImportCandidate | null;
};

type Props = {
  open: boolean;
  target: PickTarget | null;
  origin: string;
  openerRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  onPick: (title: ImportCandidate) => void;
  onSkip: () => void;
};

const SEARCH_ID = "pick-search";

/**
 * The search sheet's "pick" variant: one tap on a Title picks it for the line and closes the sheet.
 * There are no save buttons; nothing is saved until the Owner adds the list.
 */
export function PickSheet({ open, target, origin, openerRef, onClose, onPick, onSkip }: Props) {
  const [query, setQuery] = useState("");
  // Counts openings, so a reply to an earlier opening never shows.
  const [opening, setOpening] = useState(0);
  const [seenTarget, setSeenTarget] = useState(target);
  if (target !== seenTarget) {
    setSeenTarget(target);
    setQuery(target && target.candidates.length === 0 ? target.query : "");
    setOpening((count) => count + 1);
  }
  const outcome = useTitleSearch(query, opening);
  const keyboard = useKeyboardInset(open);

  const searching = outcome.phase !== "idle";
  const options: ImportCandidate[] = searching
    ? outcome.phase === "results"
      ? [...outcome.library, ...outcome.items].map(candidateFromSearch)
      : []
    : (target?.candidates ?? []);
  const currentKey = target?.current ? titleKey(target.current) : null;
  const initialFocusId = target && target.candidates.length > 0 ? "pick-option-0" : SEARCH_ID;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      labelledBy="pick-title"
      openerRef={openerRef}
      initialFocusId={initialFocusId}
      origin={origin}
      style={{ bottom: `calc(env(safe-area-inset-bottom) + 10px + ${keyboard}px)` }}
      className="top-[calc(env(safe-area-inset-top)+10px)] right-[max(1rem,env(safe-area-inset-right))] left-[max(1rem,env(safe-area-inset-left))] sm:inset-x-0 sm:mx-auto sm:w-[36rem] lg:top-[8vh]"
    >
      <div className="flex items-start gap-3 pt-3 pr-3 pl-5">
        <div className="min-w-0 flex-1 pt-2">
          <h2 id="pick-title" className="text-xl font-bold">
            Pick the right title
          </h2>
          {target ? (
            <ul className="mt-1 flex flex-col text-sm text-muted-foreground">
              {target.originals.map((original, index) => (
                <li key={index} className="[overflow-wrap:anywhere]">
                  {original}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <button
          id="pick-close"
          type="button"
          onClick={onClose}
          aria-label="Close"
          className={cn(FOCUS, "flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-secondary text-foreground transition-colors hover:bg-accent")}
        >
          <X aria-hidden className="size-5" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pt-2 pb-3">
        <PickStatus outcome={outcome} />
        {outcome.phase === "loading" ? <PickSkeleton /> : null}
        {options.length > 0 ? (
          <ul id="pick-options" className="flex flex-col">
            {options.map((option, index) => (
              <PickOption
                key={titleKey(option)}
                id={`pick-option-${index}`}
                option={option}
                current={titleKey(option) === currentKey}
                onPick={onPick}
              />
            ))}
          </ul>
        ) : null}
        <div className="px-1 pt-3">
          <Button id="pick-skip" type="button" variant="outline" onClick={onSkip}>
            Skip this line
          </Button>
        </div>
      </div>

      <form role="search" onSubmit={(event) => event.preventDefault()} className="relative border-t p-3">
        <Label htmlFor={SEARCH_ID} className="sr-only">
          Search
        </Label>
        <Search aria-hidden className="pointer-events-none absolute top-1/2 left-7.5 size-5 -translate-y-1/2 text-muted-foreground" />
        <Input
          id={SEARCH_ID}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search"
          enterKeyHint="search"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          maxLength={100}
          className="h-12 pr-5 pl-12 text-base [&::-webkit-search-cancel-button]:appearance-none"
        />
      </form>
    </Sheet>
  );
}

function PickOption({
  id,
  option,
  current,
  onPick,
}: {
  id: string;
  option: ImportCandidate;
  current: boolean;
  onPick: (title: ImportCandidate) => void;
}) {
  return (
    <li>
      <button
        id={id}
        type="button"
        aria-current={current ? "true" : undefined}
        onClick={() => onPick(option)}
        className={cn(
          FOCUS,
          "flex w-full cursor-pointer items-center gap-3 rounded-2xl p-2.5 text-left transition-colors hover:bg-secondary",
          current && "bg-secondary",
        )}
      >
        <Poster path={option.posterPath} name={option.name} size="w92" decorative className="w-16 shrink-0" />
        <span className="min-w-0 flex-1 py-0.5">
          <span className="line-clamp-2 text-base leading-snug font-semibold [overflow-wrap:anywhere]">{option.name}</span>
          <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-sm text-muted-foreground">
            {option.year !== null ? <span className="tabular">{option.year}</span> : null}
            <KindBadge kind={option.kind} />
          </span>
          {option.inLibrary ? <span className="mt-1.5 block text-sm text-muted-foreground">Already in your library</span> : null}
        </span>
        {current ? <Check aria-hidden className="size-5 shrink-0" /> : null}
      </button>
    </li>
  );
}

// One polite live region: it announces the count, the empty text or the error as they arrive.
function PickStatus({ outcome }: { outcome: ReturnType<typeof useTitleSearch> }) {
  switch (outcome.phase) {
    case "results": {
      const count = outcome.library.length + outcome.items.length;
      return (
        <p id="pick-status" role="status" className="tabular px-3 pb-1 text-sm text-muted-foreground">
          {count === 1 ? "1 result" : `${count} results`}
        </p>
      );
    }
    case "empty":
      return (
        <p id="pick-status" role="status" className="mx-auto flex max-w-sm flex-col items-center gap-3 px-2 py-8 text-center text-base text-pretty [overflow-wrap:anywhere]">
          <SearchX aria-hidden className="size-6 text-muted-foreground" />
          <span>No matches for “{outcome.query}”. Check the spelling or try the original title.</span>
        </p>
      );
    case "error":
      return (
        <p id="pick-status" role="status" className="mx-auto flex max-w-sm flex-col items-center gap-3 px-2 py-8 text-center text-base text-pretty">
          <TriangleAlert aria-hidden className="size-6 text-muted-foreground" />
          <span>{outcome.message}</span>
          {outcome.signedOut ? (
            <Link href="/sign-in" className="min-h-11 content-center font-medium underline underline-offset-4">
              Sign in
            </Link>
          ) : null}
        </p>
      );
    case "loading":
      return (
        <p id="pick-status" role="status" className="px-3 pb-1 text-sm text-muted-foreground">
          Searching…
        </p>
      );
    default:
      return <p id="pick-status" role="status" className="sr-only" />;
  }
}

function PickSkeleton() {
  return (
    <ul aria-hidden className="flex flex-col">
      {Array.from({ length: 3 }, (_, index) => (
        <li key={index} className="flex gap-3 p-2.5">
          <Skeleton className="aspect-[2/3] w-16 shrink-0" />
          <div className="flex flex-1 flex-col gap-2 py-1">
            <Skeleton className="h-5 w-40 max-w-full" />
            <Skeleton className="h-5 w-24 rounded-full" />
          </div>
        </li>
      ))}
    </ul>
  );
}
