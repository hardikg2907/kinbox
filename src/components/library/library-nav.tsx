"use client";

import { Search, SlidersHorizontal, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useOptimistic, useRef, useState, useTransition, type CSSProperties, type MouseEvent } from "react";
import { cn } from "cn";
import type { KindFilter } from "@/data/dto";
import { STATUSES, type Status } from "@/domain/types";
import { LayoutChoices } from "@/components/library/layout-choices";
import { useShownCounts } from "@/components/library/library-moves";
import { Sheet } from "@/components/library/sheet";
import { libraryHref } from "@/components/library/params";
import { useSearchSheet } from "@/components/search/search-sheet-context";
import { STATUS_ICON, STATUS_LABEL } from "@/components/status";

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

const FOCUS = "focus-visible:ring-3 focus-visible:ring-ring focus-visible:outline-none";
const ROUND =
  "glass-strong relative grid size-12 shrink-0 cursor-pointer place-items-center rounded-full border shadow-[0_18px_44px_-18px_rgb(0_0_0/0.5)] transition-transform duration-[400ms] ease-(--spring) active:scale-90";
const ACTIVE = "bg-primary text-primary-foreground hover:text-primary-foreground";

// The dock on a phone, the sidebar on a wide screen. Both read one optimistic state, so a pressed
// tab or filter lights up at once and the wall crossfades when the server answers. Counts include
// status moves still waiting for the server.
export function LibraryNav({ tab, kind, counts: serverCounts }: Props) {
  const counts = useShownCounts(serverCounts);
  const router = useRouter();
  const search = useSearchSheet();
  const [, startTransition] = useTransition();
  const [shown, setShown] = useOptimistic<Shown, Shown>({ tab, kind }, (_current, next) => next);
  const [filterOpen, setFilterOpen] = useState(false);
  const [collapsed, setCollapsed] = useDockCollapsed(filterOpen);
  const filterButton = useRef<HTMLButtonElement>(null);
  const filtersOn = shown.kind === "all" ? 0 : 1;
  const ActiveIcon = STATUS_ICON[shown.tab];

  // Modified clicks keep the link's own behaviour (new tab, copy link).
  function go(event: MouseEvent<HTMLAnchorElement>, next: Shown) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    startTransition(() => {
      setShown(next);
      router.push(libraryHref(next.tab, next.kind), { scroll: false });
    });
  }

  const kindLinks = (idPrefix: string, linkClass: string) =>
    KINDS.map(({ value, label }) => {
      const active = shown.kind === value;
      return (
        <li key={value}>
          <Link
            id={`${idPrefix}-${value}`}
            href={libraryHref(shown.tab, value)}
            scroll={false}
            aria-current={active ? "page" : undefined}
            onClick={(event) => go(event, { tab: shown.tab, kind: value })}
            className={cn(linkClass, FOCUS, active ? ACTIVE : "bg-secondary text-foreground hover:bg-accent")}
          >
            {label}
          </Link>
        </li>
      );
    });

  return (
    <>
      <div
        data-collapsed={collapsed}
        inert={collapsed}
        className="dock fixed right-[max(10px,env(safe-area-inset-right))] bottom-[calc(env(safe-area-inset-bottom)+10px)] left-[max(10px,env(safe-area-inset-left))] z-40 flex origin-bottom items-center gap-1.5 transition-[transform,opacity] duration-[620ms] ease-(--spring) data-[collapsed=true]:pointer-events-none data-[collapsed=true]:translate-y-4 data-[collapsed=true]:scale-50 data-[collapsed=true]:opacity-0 lg:hidden"
      >
        <button
          id="dock-search"
          type="button"
          aria-label="Search"
          onClick={(event) => search.open(event.currentTarget)}
          className={cn(ROUND, FOCUS)}
        >
          <Search aria-hidden className="size-5" />
        </button>
        <nav
          aria-label="Library tabs"
          className="glass-strong min-w-0 flex-1 rounded-full border p-1 shadow-[0_18px_44px_-18px_rgb(0_0_0/0.5)]"
        >
          <ul id="library-tabs" style={{ "--i": STATUSES.indexOf(shown.tab) } as CSSProperties} className="relative grid grid-cols-4">
            <li aria-hidden className="absolute inset-y-0 left-0 w-1/4 translate-x-[calc(var(--i)*100%)] rounded-full bg-primary transition-transform duration-[550ms] ease-(--spring)" />
            {STATUSES.map((status) => {
              const active = shown.tab === status;
              return (
                <li key={status} className="relative">
                  <Link
                    id={`tab-${status}`}
                    href={libraryHref(status, shown.kind)}
                    scroll={false}
                    aria-current={active ? "page" : undefined}
                    onClick={(event) => go(event, { tab: status, kind: shown.kind })}
                    className={cn(
                      "flex h-13 flex-col-reverse items-center justify-center rounded-full text-xs font-semibold tracking-tight whitespace-nowrap transition-colors duration-200",
                      FOCUS,
                      active ? "text-primary-foreground" : "text-foreground",
                    )}
                  >
                    {STATUS_LABEL[status]}
                    <span className="tabular text-[17px] leading-tight font-extrabold">{counts[status]}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <button
          ref={filterButton}
          id="dock-filters"
          type="button"
          aria-label={filtersOn > 0 ? `Filters, ${filtersOn} on` : "Filters"}
          aria-haspopup="dialog"
          aria-expanded={filterOpen}
          onClick={() => setFilterOpen(true)}
          className={cn(ROUND, FOCUS)}
        >
          <SlidersHorizontal aria-hidden className="size-5" />
          <span
            aria-hidden
            className={cn(
              "tabular absolute top-0.5 right-0.5 grid size-5 place-items-center rounded-full bg-primary text-xs leading-none font-extrabold text-primary-foreground transition-transform duration-[450ms] ease-(--spring)",
              filtersOn > 0 ? "scale-100" : "scale-0",
            )}
          >
            {filtersOn}
          </span>
        </button>
      </div>

      <button
        id="dock-pill"
        type="button"
        inert={!collapsed}
        onClick={() => setCollapsed(false)}
        className={cn(
          "glass-strong fixed bottom-[calc(env(safe-area-inset-bottom)+14px)] left-1/2 z-40 flex h-13 -translate-x-1/2 cursor-pointer items-center gap-2 rounded-full border px-5 text-base font-semibold shadow-[0_18px_44px_-18px_rgb(0_0_0/0.5)] transition-[transform,opacity] duration-[620ms] ease-(--spring) lg:hidden",
          FOCUS,
          collapsed ? "scale-100 opacity-100" : "pointer-events-none translate-y-4 scale-90 opacity-0",
        )}
      >
        <ActiveIcon aria-hidden className="size-5" />
        {STATUS_LABEL[shown.tab]}
        <span className="tabular text-muted-foreground">{counts[shown.tab]}</span>
      </button>

      <Sheet
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        label="Filters"
        openerRef={filterButton}
        origin="calc(100% - 28px) calc(100% - 28px)"
        className="inset-x-[10px] bottom-[calc(env(safe-area-inset-bottom)+10px)] lg:hidden"
      >
        <div className="flex items-center justify-between pt-4 pr-3 pl-5">
          <h2 className="text-xl font-extrabold">Filters</h2>
          <button
            type="button"
            onClick={() => setFilterOpen(false)}
            aria-label="Close"
            className={cn("flex size-11 cursor-pointer items-center justify-center rounded-full bg-secondary hover:bg-accent", FOCUS)}
          >
            <X aria-hidden className="size-5" />
          </button>
        </div>
        <section aria-labelledby="filter-show" className="px-5 pt-3">
          <h3 id="filter-show" className="text-sm font-semibold text-muted-foreground">
            Show
          </h3>
          <ul id="library-kinds" className="mt-2 grid grid-cols-3 gap-2">
            {kindLinks("kind", "flex min-h-11 items-center justify-center rounded-full text-sm font-semibold transition-colors")}
          </ul>
        </section>
        <hr className="mx-5 mt-5" />
        <section aria-labelledby="filter-layout" className="px-5 pt-4">
          <h3 id="filter-layout" className="text-sm font-semibold text-muted-foreground">
            Layout
          </h3>
          <LayoutChoices desktop={false} idPrefix="sheet" className="mt-2" />
        </section>
        <div className="flex min-h-11 items-center justify-between gap-2 px-5 py-4">
          {filtersOn > 0 ? (
            <Link
              id="filters-clear"
              href={libraryHref(shown.tab, "all")}
              scroll={false}
              onClick={(event) => go(event, { tab: shown.tab, kind: "all" })}
              className={cn("flex min-h-11 items-center rounded-full px-4 text-base font-semibold text-muted-foreground hover:text-foreground", FOCUS)}
            >
              Clear filters
            </Link>
          ) : (
            <span />
          )}
          <button
            id="filters-done"
            type="button"
            onClick={() => setFilterOpen(false)}
            className={cn("min-h-11 cursor-pointer rounded-full bg-primary px-6 text-base font-semibold text-primary-foreground hover:bg-primary/85", FOCUS)}
          >
            Done
          </button>
        </div>
      </Sheet>

      <aside
        aria-label="Library"
        className="glass-strong fixed top-3 bottom-3 left-3 z-40 hidden w-74 flex-col gap-5 overflow-y-auto rounded-sheet border p-5 shadow-[0_22px_54px_-18px_rgb(0_0_0/0.6)] lg:flex"
      >
        <Link
          href="/"
          className={cn("-mx-2 inline-flex min-h-11 items-center self-start rounded-full px-2 font-display text-3xl text-foreground", FOCUS)}
        >
          Kinbox
        </Link>
        <button
          id="side-search"
          type="button"
          onClick={(event) => search.open(event.currentTarget)}
          className={cn("flex min-h-12 cursor-pointer items-center gap-3 rounded-full bg-secondary px-4 text-base text-muted-foreground hover:bg-accent", FOCUS)}
        >
          <Search aria-hidden className="size-5 shrink-0" />
          Search a movie or series
        </button>
        <nav aria-label="Library tabs">
          <ul id="side-tabs" className="flex flex-col gap-1">
            {STATUSES.map((status) => {
              const active = shown.tab === status;
              return (
                <li key={status}>
                  <Link
                    id={`side-tab-${status}`}
                    href={libraryHref(status, shown.kind)}
                    scroll={false}
                    aria-current={active ? "page" : undefined}
                    onClick={(event) => go(event, { tab: status, kind: shown.kind })}
                    className={cn(
                      "flex min-h-12 items-center justify-between rounded-full px-4 text-base font-medium transition-colors duration-200",
                      FOCUS,
                      active ? cn(ACTIVE, "font-semibold") : "text-foreground hover:bg-secondary",
                    )}
                  >
                    {STATUS_LABEL[status]}
                    <span className="tabular">{counts[status]}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <section aria-labelledby="side-show">
          <div className="flex items-center justify-between">
            <h2 id="side-show" className="text-sm font-semibold text-muted-foreground">
              Show
            </h2>
            {filtersOn > 0 ? (
              <Link
                href={libraryHref(shown.tab, "all")}
                scroll={false}
                onClick={(event) => go(event, { tab: shown.tab, kind: "all" })}
                className={cn("flex min-h-11 items-center rounded-full px-3 text-sm font-semibold text-muted-foreground hover:text-foreground", FOCUS)}
              >
                Clear filters
              </Link>
            ) : null}
          </div>
          <ul id="side-kinds" className="mt-1 grid grid-cols-3 gap-2">
            {kindLinks("side-kind", "flex min-h-11 items-center justify-center rounded-full text-sm font-semibold transition-colors")}
          </ul>
        </section>
        <section aria-labelledby="side-layout">
          <h2 id="side-layout" className="text-sm font-semibold text-muted-foreground">
            Layout
          </h2>
          <LayoutChoices desktop idPrefix="side" className="mt-1" />
        </section>
      </aside>
    </>
  );
}

// Down shrinks the dock to a slim pill, up (or the top of the page) grows it back. A sheet pins it open.
function useDockCollapsed(paused: boolean) {
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    if (paused) return;
    let last = window.scrollY;
    let frame = 0;
    function onScroll() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const y = window.scrollY;
        const delta = y - last;
        if (Math.abs(delta) < 8) return;
        last = y;
        if (y <= 24 || delta < 0) setCollapsed(false);
        else if (y > 120) setCollapsed(true);
      });
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, [paused]);
  return [collapsed, setCollapsed] as const;
}
