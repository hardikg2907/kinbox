"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useOptimistic, useTransition, type MouseEvent } from "react";
import { cn } from "cn";
import type { KindFilter } from "@/data/dto";
import { STATUSES, type Status } from "@/domain/types";
import { STATUS_LABEL } from "@/components/status";
import { libraryHref } from "@/components/library/params";

type Props = {
  tab: Status;
  kind: KindFilter;
  /** Counts already honour the kind filter. */
  counts: Record<Status, number>;
};

type Shown = { tab: Status; kind: KindFilter };

const KINDS: { value: KindFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "movie", label: "Movies" },
  { value: "series", label: "Series" },
];

// The velvet glow marks the active tab; the fill and the bold weight carry it too, so it never rests on colour alone.
const ACTIVE_TAB =
  "bg-primary font-semibold text-primary-foreground shadow-[0_6px_16px_-6px_color-mix(in_oklab,var(--primary)_60%,transparent)] hover:text-primary-foreground";

export function LibraryFilters({ tab, kind, counts }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [shown, setShown] = useOptimistic<Shown, Shown>({ tab, kind }, (_current, next) => next);

  // Plain clicks run inside a transition, so the pressed tab lights up at once and the
  // grid crossfades when the server answers. Modified clicks keep the link's own behaviour.
  function go(event: MouseEvent<HTMLAnchorElement>, next: Shown) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    startTransition(() => {
      setShown(next);
      router.push(libraryHref(next.tab, next.kind), { scroll: false });
    });
  }

  return (
    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <nav aria-label="Library tabs" className="-mx-4 -my-2 overflow-x-auto px-4 py-4 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
        <ul id="library-tabs" className="flex w-max gap-2">
          {STATUSES.map((status) => {
            const active = shown.tab === status;
            return (
              <li key={status}>
                <Link
                  id={`tab-${status}`}
                  href={libraryHref(status, shown.kind)}
                  scroll={false}
                  aria-current={active ? "page" : undefined}
                  onClick={(event) => go(event, { tab: status, kind: shown.kind })}
                  className={cn(
                    "inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-medium text-muted-foreground transition-[background-color,color,box-shadow] duration-200 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                    active && ACTIVE_TAB,
                  )}
                >
                  {STATUS_LABEL[status]}
                  <span className="tabular text-xs opacity-80">{counts[status]}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <nav aria-label="Kind">
        <ul id="library-kinds" className="flex gap-2">
          {KINDS.map(({ value, label }) => {
            const active = shown.kind === value;
            return (
              <li key={value}>
                <Link
                  id={`kind-${value}`}
                  href={libraryHref(shown.tab, value)}
                  scroll={false}
                  aria-current={active ? "page" : undefined}
                  onClick={(event) => go(event, { tab: shown.tab, kind: value })}
                  className={cn(
                    "inline-flex min-h-11 items-center rounded-lg border px-4 text-sm font-medium text-muted-foreground transition-colors duration-200 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                    active && "border-primary bg-accent font-semibold text-accent-foreground hover:text-accent-foreground",
                  )}
                >
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
