import { Repeat, type LucideIcon } from "lucide-react";
import type { StatusMove } from "@/data/dto";
import type { Status, TitleKind } from "@/domain/types";
import { STATUS_ICON } from "@/components/status";

/** A row of the status sheet: the Status to move to, or "again" for a rewatch of a Watched Title. */
export type MoveTarget = Status | "again";

/** What the sheet knows about a Title when it opens. */
export type SheetFacts = {
  kind: TitleKind;
  status: Status;
  /**
   * A Series' Episodes, when known. The Title's own screen knows them; a Library card does not,
   * so its helpers use the short forms.
   */
  episodes: { aired: number; watched: number; next: string | null } | null;
};

export type SheetRow = { target: MoveTarget; label: string; helper: string | null; icon: LucideIcon };

export const SHEET_LINE: Record<Status, string> = {
  to_watch: "On your To watch list",
  watching: "You're watching this",
  watched: "You've watched this",
  dropped: "You dropped this",
};

// The likely next step first and "Drop it" last; the current Status is never a row.
const ORDER: Record<Status, readonly MoveTarget[]> = {
  to_watch: ["watching", "watched", "dropped"],
  watching: ["watched", "to_watch", "dropped"],
  watched: ["again", "watching", "to_watch", "dropped"],
  dropped: ["watching", "to_watch", "watched"],
};

const LABEL: Record<MoveTarget, string> = {
  to_watch: "Watch later",
  watching: "Start watching",
  watched: "Mark as watched",
  again: "Watched again",
  dropped: "Drop it",
};

const ICON: Record<MoveTarget, LucideIcon> = { ...STATUS_ICON, again: Repeat };

function helper(target: MoveTarget, { kind, status, episodes }: SheetFacts): string | null {
  if (target === "to_watch" && status === "watched") return "Keeps when you watched it";
  if (kind !== "series") return null;
  // Null when not known. A Library card only knows that a watching Series has progress.
  const ticked = episodes ? episodes.watched > 0 : null;
  switch (target) {
    case "to_watch":
      return status === "watching" && (ticked ?? true) ? "Keeps your progress" : null;
    case "watching":
      if (status === "watched") return (ticked ?? true) ? "Keeps your ticks" : null;
      if (status !== "dropped" || ticked === false) return null;
      return episodes?.next ? `Picks up at ${episodes.next}` : "Picks up where you left off";
    case "watched":
      if (!episodes || episodes.aired === 1) return "Ticks all aired episodes";
      return episodes.aired > 1 ? `Ticks all ${episodes.aired} aired episodes` : null;
    case "dropped":
      // Watching and Watched Series always have progress, even when the Episodes are not known yet.
      return (status === "watching" || status === "watched" ? (ticked ?? true) : ticked) ? "Keeps your progress" : null;
    case "again":
      return null;
  }
}

export function sheetRows(facts: SheetFacts): SheetRow[] {
  return ORDER[facts.status].map((target) => ({
    target,
    label: LABEL[target],
    helper: helper(target, facts),
    icon: ICON[target],
  }));
}

const MOVED: Record<Status, string> = {
  to_watch: "Saved to To watch",
  watching: "Now watching",
  watched: "Marked as watched",
  dropped: "Dropped",
};

type MoveWords = Pick<StatusMove, "status" | "previousStatus" | "addedWatch">;

/** The toast's words, read from what the server says the move did. */
export function movedMessage(move: MoveWords): string {
  return isRewatch(move) ? "Watched again, today" : MOVED[move.status];
}

/** A move that finished the Title offers the optional stars in its toast. */
export function offersStars(move: MoveWords): boolean {
  return move.addedWatch && move.status === "watched" && !isRewatch(move);
}

function isRewatch(move: MoveWords): boolean {
  return move.addedWatch && move.status === "watched" && move.previousStatus === "watched";
}

/** One toast per Title: a new move, or "Watched it", replaces the last one. */
export function titleToastId(entryId: string): string {
  return `watched-${entryId}`;
}
