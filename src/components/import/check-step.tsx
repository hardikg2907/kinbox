"use client";

import {
  Check,
  ChevronDown,
  CornerDownRight,
  EyeOff,
  LibraryBig,
  LoaderCircle,
  SearchX,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { cn } from "cn";
import { Poster } from "@/components/poster";
import { KindBadge, STATUS_LABEL } from "@/components/status";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { Status } from "@/domain/types";
import { FOCUS } from "./import-frame";
import { lookRightLabel, rowsByGroup, type Group, type Row } from "./import-model";

const GROUP_TITLE: Record<Exclude<Group, "found">, string> = {
  check: "Check these",
  not_found: "Not found",
  error: "Couldn't check",
};

const PILL_COLUMNS: Record<number, string> = { 2: "grid-cols-2", 3: "grid-cols-3", 4: "grid-cols-2" };

export type RowHandlers = {
  /** Opens the pick sheet for these lines; `opener` gets focus back when it closes. */
  onPick: (row: Row, lineIds: number[], opener: HTMLElement) => void;
  onChoose: (lineIds: number[], intent: Status) => void;
  onInclude: (lineIds: number[]) => void;
  onRetry: (lineIds: number[]) => void;
};

type Props = RowHandlers & {
  rows: Row[];
  /** Lines being checked again. */
  retrying: ReadonlySet<number>;
  /** More rows are on their way. */
  checking: boolean;
};

export function CheckStep({ rows, retrying, checking, ...handlers }: Props) {
  const groups = rowsByGroup(rows);
  const problems = (["check", "not_found", "error"] as const).filter((group) => groups[group].length > 0);

  return (
    <div id="import-check" className="flex flex-col gap-8">
      {problems.map((group) => (
        <section key={group} aria-labelledby={`import-group-${group}`}>
          <h2 id={`import-group-${group}`} className="flex items-baseline justify-between gap-3 px-1 pb-2 text-base font-semibold">
            {GROUP_TITLE[group]}
            <span aria-hidden className="tabular text-sm font-normal text-muted-foreground">
              {groups[group].length}
            </span>
          </h2>
          <RowList rows={groups[group]} retrying={retrying} {...handlers} />
        </section>
      ))}
      {groups.found.length > 0 ? <FoldedRows rows={groups.found} retrying={retrying} {...handlers} /> : null}
      {checking ? <RowsSkeleton rows={rows.length === 0 ? 4 : 2} /> : null}
    </div>
  );
}

function RowList({ rows, retrying, ...handlers }: RowHandlers & { rows: Row[]; retrying: ReadonlySet<number> }) {
  return (
    <ul className="glass flex flex-col rounded-3xl border p-1">
      {rows.map((row) => (
        <MatchRow
          key={row.anchorId}
          row={row}
          retrying={row.lines.some((line) => retrying.has(line.id))}
          {...handlers}
        />
      ))}
    </ul>
  );
}

// The rows that look right, folded into one row that opens in place, like a Season.
function FoldedRows({ rows, retrying, ...handlers }: RowHandlers & { rows: Row[]; retrying: ReadonlySet<number> }) {
  const [open, setOpen] = useState(false);
  return (
    <section aria-labelledby="import-group-found">
      <h2 id="import-group-found">
        <button
          id="import-found-toggle"
          type="button"
          aria-expanded={open}
          aria-controls="import-found-rows"
          onClick={() => setOpen((current) => !current)}
          className={cn(
            FOCUS,
            "flex min-h-14 w-full cursor-pointer items-center justify-between gap-3 rounded-2xl border bg-secondary px-4 py-2 text-left text-base font-semibold transition-colors hover:bg-accent",
          )}
        >
          <span className="tabular">{lookRightLabel(rows.length)}</span>
          <ChevronDown aria-hidden className={cn("size-5 text-muted-foreground transition-transform duration-200", open && "rotate-180")} />
        </button>
      </h2>
      <div id="import-found-rows" hidden={!open} className="mt-2 animate-in duration-200 fade-in">
        {open ? <RowList rows={rows} retrying={retrying} {...handlers} /> : null}
      </div>
    </section>
  );
}

type RowProps = RowHandlers & { row: Row; retrying: boolean };

export function MatchRow({ row, retrying, onPick, onChoose, onInclude, onRetry }: RowProps) {
  const ids = row.lines.map((line) => line.id);
  const nameId = `import-row-${row.anchorId}-name`;
  const merged = row.lines.length > 1;
  const { title } = row;
  // A row with no Title shows what was pasted as its name, so the line is not repeated under it.
  const name = title?.name ?? row.lines[0].original;
  // Only the pills need the row's width; a helper fits beside the poster, so the row stays short.
  const beside = row.display !== "choose";
  const actions = (
    <RowActions
      row={row}
      ids={ids}
      nameId={nameId}
      beside={beside}
      retrying={retrying}
      onChoose={onChoose}
      onInclude={onInclude}
      onRetry={onRetry}
    />
  );

  return (
    <li id={`import-row-${row.anchorId}`} data-row-lines={ids.join(" ")} className="p-3 not-last:border-b">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div data-pick-block="" className="relative grid min-w-0 flex-1 grid-cols-[4rem_1fr] gap-x-3">
          {title ? (
            <Poster path={title.posterPath} name={title.name} size="w92" decorative className="w-16" />
          ) : (
            <EmptyPoster icon={row.display === "error" ? TriangleAlert : SearchX} />
          )}
          <div className="min-w-0 py-0.5">
            {/* Stretched over the poster and the words, so tapping either opens the pick sheet. */}
            <button
              id={nameId}
              data-pick-button=""
              type="button"
              aria-haspopup="dialog"
              onClick={(event) => onPick(row, ids, event.currentTarget)}
              className="block cursor-pointer text-left text-base leading-snug font-semibold outline-none after:absolute after:inset-0 after:rounded-2xl focus-visible:after:ring-3 focus-visible:after:ring-ring"
            >
              <span className="line-clamp-2 [overflow-wrap:anywhere]">{name}</span>
            </button>
            {title ? (
              <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-sm text-muted-foreground">
                {title.year !== null ? <span className="tabular">{title.year}</span> : null}
                <KindBadge kind={title.kind} />
              </div>
            ) : null}
            {title || merged ? (
              <ul className="mt-1.5 flex flex-col gap-0.5 text-sm text-muted-foreground">
                {row.lines.map((line) => (
                  <li key={line.id} className="flex min-w-0 items-start gap-1.5">
                    <CornerDownRight aria-hidden className="mt-[0.2rem] size-3.5 shrink-0" />
                    {merged ? (
                      // In a merged row each line can get its own Title, which splits it out.
                      <button
                        type="button"
                        aria-haspopup="dialog"
                        onClick={(event) => onPick(row, [line.id], event.currentTarget)}
                        className={cn(
                          FOCUS,
                          "relative z-10 min-h-6 min-w-0 cursor-pointer rounded-sm text-left underline decoration-dotted underline-offset-4 [overflow-wrap:anywhere] hover:text-foreground",
                        )}
                      >
                        {line.original}
                      </button>
                    ) : (
                      <span className="min-w-0 [overflow-wrap:anywhere]">{line.original}</span>
                    )}
                  </li>
                ))}
              </ul>
            ) : null}
            {beside ? actions : null}
          </div>
        </div>
        {beside ? null : actions}
      </div>
    </li>
  );
}

function RowActions({
  row,
  ids,
  nameId,
  beside,
  retrying,
  onChoose,
  onInclude,
  onRetry,
}: Pick<RowHandlers, "onChoose" | "onInclude" | "onRetry"> & {
  row: Row;
  ids: number[];
  nameId: string;
  /** Sits in the text column beside the poster rather than under the row. */
  beside: boolean;
  retrying: boolean;
}) {
  switch (row.display) {
    case "choose":
      return (
        <div className="relative z-10 flex flex-col gap-1.5 sm:items-end">
          <div role="group" aria-labelledby={nameId} className={cn("grid gap-2 sm:flex", PILL_COLUMNS[row.intentOptions.length])}>
            {row.intentOptions.map((option) => {
              const chosen = row.intent === option;
              return (
                <Button
                  key={option}
                  type="button"
                  variant={chosen ? "default" : "outline"}
                  aria-pressed={chosen}
                  onClick={() => onChoose(ids, option)}
                  className="px-2 sm:px-4"
                >
                  {chosen ? <Check aria-hidden /> : null}
                  {STATUS_LABEL[option]}
                </Button>
              );
            })}
          </div>
          {row.title?.kind === "series" && row.intent === "watched" ? (
            <p className="text-sm text-muted-foreground">Ticks all aired episodes</p>
          ) : null}
        </div>
      );
    case "in_library":
      return <Helper icon={LibraryBig} label="Already in your library" beside={beside} />;
    case "skipped":
      return (
        <Helper icon={EyeOff} label="Skipped" beside={beside}>
          <Button type="button" variant="outline" onClick={() => onInclude(ids)} className="relative z-10">
            Include
          </Button>
        </Helper>
      );
    case "not_found":
      return <Helper icon={SearchX} label="Not found" beside={beside} />;
    case "error":
      return (
        <Helper icon={TriangleAlert} label="Couldn't check" beside={beside}>
          <Button
            type="button"
            variant="outline"
            aria-disabled={retrying}
            onClick={() => {
              if (!retrying) onRetry(ids);
            }}
            className="relative z-10 aria-disabled:cursor-wait aria-disabled:opacity-70"
          >
            {retrying ? <LoaderCircle aria-hidden className="animate-spin motion-reduce:animate-none" /> : null}
            Try again
          </Button>
        </Helper>
      );
  }
}

function Helper({
  icon: Icon,
  label,
  beside,
  children,
}: {
  icon: LucideIcon;
  label: string;
  beside: boolean;
  children?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex min-h-11 items-center gap-3",
        beside ? "mt-1 flex-wrap" : "justify-between sm:justify-end",
      )}
    >
      <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
        <Icon aria-hidden className="size-4 shrink-0" />
        {label}
      </span>
      {children}
    </div>
  );
}

function EmptyPoster({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <div aria-hidden className="grid aspect-[2/3] w-16 place-items-center rounded-md border border-dashed border-input/60 bg-muted/60 text-muted-foreground">
      <Icon className="size-5" />
    </div>
  );
}

function RowsSkeleton({ rows }: { rows: number }) {
  return (
    <ul aria-hidden className="glass flex flex-col rounded-3xl border p-1">
      {Array.from({ length: rows }, (_, index) => (
        <li key={index} className="flex gap-3 p-3 not-last:border-b">
          <Skeleton className="aspect-[2/3] w-16 shrink-0" />
          <div className="flex flex-1 flex-col gap-2 py-1">
            <Skeleton className="h-5 w-40 max-w-full" />
            <Skeleton className="h-5 w-24 rounded-full" />
            <Skeleton className="h-4 w-32 max-w-full" />
          </div>
        </li>
      ))}
    </ul>
  );
}
