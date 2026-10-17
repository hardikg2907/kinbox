"use client";

import { Check, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useOptimistic, useRef, useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import { NotOutYetMock } from "@/components/not-out-yet-mock";
import { Button } from "@/components/ui/button";
import { Poster } from "@/components/poster";
import { KindBadge, STATUS_LABEL, StatusLabel } from "@/components/status";
import { SavedExtras } from "@/components/search/saved-extras";
import { saveTitle } from "@/actions/entries";
import type { SaveResult, SearchItem } from "@/data/dto";
import type { Status } from "@/domain/types";

type Saved = Pick<SaveResult, "entryId" | "status" | "created" | "seasons">;

const SAVE_STATUSES: readonly Status[] = ["to_watch", "watching", "watched"];

export function SearchResultRow({ item }: { item: SearchItem }) {
  const { kind, tmdbId, name, year, posterPath } = item;
  const [saved, setSaved] = useState<Saved | null>(null);
  const [, startTransition] = useTransition();

  // The confirmed Status comes from this row's own save, else from the Library copy the search returned.
  const confirmed: Status | null = saved?.status ?? item.entry?.status ?? null;
  const [status, setOptimisticStatus] = useOptimistic<Status | null, Status>(confirmed, (_current, next) => next);
  const entryId = saved?.entryId ?? item.entry?.id ?? null;
  // Only a save made here offers the extras; a Title that was already in the Library just links to its page.
  const justSaved = saved?.created === true || (saved === null && status !== null && item.entry === null);

  const row = useRef<HTMLLIElement>(null);
  // Set when a keyboard press removes the focused Save button: "extras" waits for the saved row,
  // a Status names the button to bring back if the save fails.
  const returnFocus = useRef<"extras" | Status | null>(null);

  useEffect(() => {
    const want = returnFocus.current;
    if (want === null) return;
    // Focus rests on the page body only while the pressed button is gone; anywhere else means the Owner moved on.
    if (document.activeElement && document.activeElement !== document.body) {
      returnFocus.current = null;
      return;
    }
    if (want === "extras") {
      if (saved === null) return;
      const target =
        row.current?.querySelector<HTMLElement>("[data-saved-extras] :is(input, select, textarea, button)") ??
        row.current?.querySelector<HTMLElement>("a[href]");
      target?.focus();
    } else {
      if (status !== null) return;
      document.getElementById(`save-${kind}-${tmdbId}-${want}`)?.focus();
    }
    returnFocus.current = null;
  }, [saved, status, kind, tmdbId]);

  function save(next: Status, pressed: HTMLElement) {
    if (pressed.matches(":focus-visible")) returnFocus.current = "extras";
    startTransition(async () => {
      setOptimisticStatus(next);
      const result = await saveTitle({ kind, tmdbId, status: next });
      if (!result.ok) {
        if (returnFocus.current === "extras") returnFocus.current = next;
        toast.error(result.error);
        return;
      }
      startTransition(() => setSaved(result.data));
    });
  }

  const statusLine: ReactNode =
    status === null ? null : (
      <div className="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1">
        <StatusLabel status={status} className="h-9 rounded-full bg-primary px-3.5 font-semibold text-primary-foreground" />
        <span role="status" className="inline-flex items-center text-sm text-muted-foreground">
          {justSaved ? (
            <span className="inline-flex animate-in items-center gap-1 duration-200 fade-in slide-in-from-bottom-1">
              <Check aria-hidden className="size-4 text-foreground" />
              Saved
            </span>
          ) : null}
        </span>
        {entryId && !justSaved ? <ChevronRight aria-hidden className="size-4 text-muted-foreground" /> : null}
      </div>
    );

  return (
    <li ref={row} id={`result-${kind}-${tmdbId}`} className="relative p-3 not-last:border-b">
      <div className="grid grid-cols-[4rem_1fr] gap-x-3 gap-y-3 sm:grid-cols-[4rem_1fr_auto] sm:items-center">
        <Poster path={posterPath} name={name} size="w92" className="w-16" />
        <div className="min-w-0 py-0.5">
          {/* A link stretched over the whole row, so the buttons sit above it and stay separate targets. */}
          {entryId ? (
            <Link
              href={`/entry/${entryId}`}
              className="line-clamp-2 rounded-sm text-base leading-snug font-semibold outline-none after:absolute after:inset-0 after:rounded-2xl focus-visible:after:ring-3 focus-visible:after:ring-ring"
            >
              {name}
            </Link>
          ) : (
            <p className="line-clamp-2 text-base leading-snug font-semibold">{name}</p>
          )}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-sm text-muted-foreground">
            {year !== null ? <span className="tabular">{year}</span> : null}
            <KindBadge kind={kind} />
            <NotOutYetMock name={name} />
          </div>
          {statusLine ? <div className="mt-1 sm:hidden">{statusLine}</div> : null}
        </div>

        {status === null ? (
          <div
            role="group"
            aria-label={`Save ${name}`}
            className="relative z-10 col-span-2 grid grid-cols-3 gap-2 sm:col-span-1 sm:flex"
          >
            {SAVE_STATUSES.map((option) => (
              <Button
                key={option}
                id={`save-${kind}-${tmdbId}-${option}`}
                type="button"
                variant="outline"
                onClick={(event) => save(option, event.currentTarget)}
                className="px-2 sm:px-4"
              >
                {STATUS_LABEL[option]}
              </Button>
            ))}
          </div>
        ) : (
          <div className="hidden sm:block">{statusLine}</div>
        )}
      </div>

      {saved?.created === true && status !== null ? (
        <div data-saved-extras className="relative z-10">
          <SavedExtras entryId={saved.entryId} kind={kind} status={saved.status} seasons={saved.seasons} />
        </div>
      ) : null}
    </li>
  );
}
