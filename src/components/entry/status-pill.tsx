"use client";

import { ChevronDown } from "lucide-react";
import { createContext, use, useRef, useState, type ReactNode } from "react";
import { cn } from "cn";
import { STATUS_ICON, STATUS_LABEL } from "@/components/status";
import { useEntry } from "./entry-state";
import type { MoveTarget, SheetFacts } from "./status-moves";
import { StatusSheet } from "./status-sheet";

type Opener = "head" | "bar";

type PillHost = { openedBy: Opener | null; open: (by: Opener, button: HTMLElement, pointer: boolean) => void };

const PillContext = createContext<PillHost | null>(null);

/** One status sheet for the Title, opened by the pill under its name or the one in the sticky bar. */
export function StatusPillHost({
  name,
  posterPath,
  children,
}: {
  name: string;
  posterPath: string | null;
  children: ReactNode;
}) {
  const { kind, model, changeStatus, addWatch } = useEntry();
  const opener = useRef<HTMLElement | null>(null);
  const [openedBy, setOpenedBy] = useState<Opener | null>(null);
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const [byPointer, setByPointer] = useState(false);
  // The sheet keeps showing the Status it opened on while it shrinks away after a move.
  const [facts, setFacts] = useState<SheetFacts>({ kind, status: model.status, episodes: null });

  function open(by: Opener, button: HTMLElement, pointer: boolean) {
    opener.current = button;
    setByPointer(pointer);
    const series = model.series;
    setFacts({
      kind,
      status: model.status,
      episodes: series
        ? { aired: series.airedCount, watched: series.watchedCount, next: series.next?.label ?? null }
        : null,
    });
    setAnchor(button.getBoundingClientRect());
    setOpenedBy(by);
  }

  function move(target: MoveTarget) {
    setOpenedBy(null);
    if (target === "again") addWatch();
    else changeStatus(target);
  }

  return (
    <PillContext value={{ openedBy, open }}>
      {children}
      <StatusSheet
        open={openedBy !== null}
        onClose={() => setOpenedBy(null)}
        openerRef={opener}
        anchor={anchor}
        side="below"
        name={name}
        posterPath={posterPath}
        facts={facts}
        focusTitle={byPointer}
        onMove={move}
      />
    </PillContext>
  );
}

/** The current Status with its icon. It opens the status sheet; it never looks like a Library tab. */
export function StatusPill({ compact = false }: { compact?: boolean }) {
  const { model } = useEntry();
  const host = use(PillContext);
  if (!host) throw new Error("StatusPill needs a StatusPillHost above it.");
  const by: Opener = compact ? "bar" : "head";
  const label = STATUS_LABEL[model.status];
  const Icon = STATUS_ICON[model.status];
  return (
    <button
      id={compact ? undefined : "entry-status-button"}
      type="button"
      aria-label={`Change from ${label}`}
      aria-haspopup="dialog"
      aria-expanded={host.openedBy === by}
      // Enter and Space click with detail 0.
      onClick={(event) => host.open(by, event.currentTarget, event.detail > 0)}
      className={cn(
        "relative inline-flex shrink-0 cursor-pointer items-center rounded-full border border-input font-semibold whitespace-nowrap transition-transform duration-[400ms] ease-(--spring) hover:bg-secondary focus-visible:ring-3 focus-visible:ring-ring focus-visible:outline-none active:scale-95",
        compact
          ? "h-9 gap-1.5 pr-2.5 pl-3 text-sm after:absolute after:-inset-1"
          : "h-11 gap-2 self-start pr-3.5 pl-4 text-base",
      )}
    >
      <Icon aria-hidden className={compact ? "size-4" : "size-[18px]"} />
      {label}
      <ChevronDown aria-hidden className="size-4 text-muted-foreground" />
    </button>
  );
}
