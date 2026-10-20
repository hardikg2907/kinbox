"use client";

import { X } from "lucide-react";
import {
  createContext,
  startTransition,
  use,
  useEffect,
  useLayoutEffect,
  useOptimistic,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { toast } from "sonner";
import { setRating, setStatus, undoStatusMove, watchAgain } from "@/actions/entries";
import type { ActionResult, KindFilter, LibraryCard, StatusMove, StatusMoveUndo } from "@/data/dto";
import type { Status } from "@/domain/types";
import { showActionToast } from "@/components/action-toast";
import { StatusSheet, type LiftSource } from "@/components/entry/status-sheet";
import { movedMessage, offersStars, titleToastId, type MoveTarget, type SheetFacts } from "@/components/entry/status-moves";
import { WatchedStars } from "@/components/entry/watched-stars";
import { useRatingSaveDelay } from "@/components/rating-save-delay";
import { LibraryEmpty } from "@/components/library/library-empty";
import { LibraryGrid } from "@/components/library/library-grid";
import { crossFadeReshaped, glide, markWall, measure, placeCards, useWallLayout } from "@/components/library/wall-layout";
import type { Layout } from "@/components/library/layout";

const GENERIC_ERROR = "Couldn't save that. Try again.";
const HOLD_MS = 450;
const HOLD_SLOP_PX = 8;
const HINT_ID = "hold-hint";
const HINT_KEY = "kb_hold_hint";
// How long the sheet and the lifted copy take to leave, so the cards glide only after them.
const LEAVE_MS = 180;

type Counts = Record<Status, number>;
type Shown = { cards: LibraryCard[]; counts: Counts };

/** One Title moving between tabs: a move from the sheet, or its Undo. */
type Move = {
  card: LibraryCard;
  from: Status;
  to: Status;
  tab: Status;
  /** The Movies or Series filter in force when the move was made. */
  kind: KindFilter;
  /** The card's place in its tab before the move, where Undo puts it back. */
  index: number;
  /** The counts the move was made against. */
  countsBefore: Counts;
};

function sameCounts(a: Counts, b: Counts): boolean {
  return a.to_watch === b.to_watch && a.watching === b.watching && a.watched === b.watched && a.dropped === b.dropped;
}

// A fresh render from the server can arrive while a move is still pending, and the move is then
// applied again on top of it. So each part is a "set": counts that no longer match what the move
// saw already hold it, and a card that is already gone (or back) stays as it is.
function applyMove(shown: Shown, move: Move): Shown {
  // A Title the filter hides is in neither the wall nor the counts, so an Undo must not add it.
  if (move.kind !== "all" && move.card.kind !== move.kind) return shown;
  const counts =
    move.from !== move.to && sameCounts(shown.counts, move.countsBefore)
      ? {
          ...shown.counts,
          [move.from]: Math.max(0, shown.counts[move.from] - 1),
          [move.to]: shown.counts[move.to] + 1,
        }
      : shown.counts;
  const at = shown.cards.findIndex((card) => card.entryId === move.card.entryId);
  let cards = shown.cards;
  if (move.to !== move.tab) {
    if (at >= 0) cards = cards.filter((card) => card.entryId !== move.card.entryId);
  } else if (at < 0) {
    const index = Math.min(move.index, cards.length);
    cards = [...cards.slice(0, index), { ...move.card, status: move.to }, ...cards.slice(index)];
  }
  return { cards, counts };
}

type Subject = { id: number; card: LibraryCard; index: number; anchor: DOMRect; lift: LiftSource | null };

type MovesValue = {
  tab: Status;
  shown: Shown;
  wallRef: RefObject<HTMLDivElement | null>;
  /** Card places taken just before a move, so the cards left behind glide to their new places. */
  beforeRef: RefObject<Map<string, DOMRect> | null>;
  openSheet: (cardElement: HTMLElement, pointer: boolean) => void;
};

const MovesContext = createContext<MovesValue | null>(null);

/** The Library's counts, with moves still waiting for the server already in them. */
export function useShownCounts(counts: Counts): Counts {
  return use(MovesContext)?.shown.counts ?? counts;
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function readHintSeen(): boolean {
  try {
    return window.localStorage.getItem(HINT_KEY) === "1";
  } catch {
    return false;
  }
}

function rememberHintSeen() {
  try {
    window.localStorage.setItem(HINT_KEY, "1");
  } catch {
    // Without storage the hint may show again on a later visit; nothing else depends on it.
  }
}

async function send(entryId: string, target: MoveTarget): Promise<ActionResult<StatusMove>> {
  try {
    return target === "again" ? await watchAgain({ entryId }) : await setStatus({ entryId, status: target });
  } catch {
    return { ok: false, error: GENERIC_ERROR };
  }
}

/**
 * Status moves straight from the wall: press-and-hold or right-click a poster for the status sheet.
 * A moved card leaves its tab and the counts change at once; the server's answer (and its fresh
 * render) confirms, and a failure puts both back by itself when the transition ends.
 */
export function LibraryMoves({
  tab,
  kind,
  cards,
  counts,
  children,
}: {
  tab: Status;
  kind: KindFilter;
  cards: LibraryCard[];
  counts: Counts;
  children: ReactNode;
}) {
  const [shown, addMove] = useOptimistic<Shown, Move>({ cards, counts }, applyMove);
  const wall = useRef<HTMLDivElement>(null);
  const before = useRef<Map<string, DOMRect> | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const openings = useRef(0);
  const [subject, setSubject] = useState<Subject | null>(null);
  const [open, setOpen] = useState(false);
  const [liftLeaves, setLiftLeaves] = useState(false);
  const [byPointer, setByPointer] = useState(false);
  const waitToSaveRating = useRatingSaveDelay();
  // A toast's Undo runs after this screen may have moved on to another tab.
  const latest = useRef({ tab, kind, shown });
  useLayoutEffect(() => {
    latest.current = { tab, kind, shown };
  });

  // The skeleton's shape follows the marks on <html>, so they change with the tab and the kind.
  useLayoutEffect(() => {
    markWall({ tab, kind });
  }, [tab, kind]);

  const hasCards = shown.cards.length > 0;
  useEffect(() => {
    if (!hasCards || readHintSeen() || !window.matchMedia("(pointer: coarse)").matches) return;
    rememberHintSeen();
    toast.custom((id) => <HoldHint onClose={() => toast.dismiss(id)} />, { id: HINT_ID, duration: Infinity });
  }, [hasCards]);

  function snapshotWall() {
    before.current = prefersReducedMotion() ? null : measure(wall.current?.querySelector("ul") ?? null);
  }

  function openSheet(cardElement: HTMLElement, pointer: boolean) {
    const entryId = cardElement.id.slice("card-".length);
    const index = latest.current.shown.cards.findIndex((card) => card.entryId === entryId);
    const card = latest.current.shown.cards[index];
    if (!card) return;
    toast.dismiss(HINT_ID);
    const poster = cardElement.firstElementChild instanceof HTMLElement ? cardElement.firstElementChild : cardElement;
    const image = poster.querySelector("img");
    opener.current = cardElement.querySelector<HTMLElement>("a[href]");
    openings.current += 1;
    setSubject({
      id: openings.current,
      card,
      index,
      anchor: poster.getBoundingClientRect(),
      lift: {
        poster,
        src: image ? image.currentSrc || image.src : null,
        imageClass: image?.className ?? "",
        hide: (hidden) => {
          poster.style.visibility = hidden ? "hidden" : "";
        },
      },
    });
    setLiftLeaves(false);
    setByPointer(pointer);
    setOpen(true);
  }

  function rate(entryId: string, halfStars: number | null) {
    startTransition(async () => {
      if (!(await waitToSaveRating())) return;
      const result = await setRating({ entryId, ratingHalfStars: halfStars });
      if (!result.ok) toast.error(result.error);
    });
  }

  function applyNow(move: Omit<Move, "tab" | "kind" | "countsBefore">) {
    snapshotWall();
    addMove({ ...move, tab: latest.current.tab, kind: latest.current.kind, countsBefore: latest.current.shown.counts });
  }

  function undo(card: LibraryCard, index: number, data: StatusMoveUndo) {
    startTransition(async () => {
      applyNow({ card, from: data.status, to: data.previousStatus, index });
      let result: ActionResult<{ status: Status }>;
      try {
        result = await undoStatusMove(data);
      } catch {
        result = { ok: false, error: GENERIC_ERROR };
      }
      if (!result.ok) toast.error(result.error);
    });
  }

  function move(target: MoveTarget) {
    if (!subject) return;
    const { card, index } = subject;
    const to: Status = target === "again" ? "watched" : target;
    const leaves = to !== tab;
    // The card is about to leave the wall, so focus goes to the one that takes its place.
    if (leaves) {
      const cardsNow = latest.current.shown.cards;
      const neighbour = cardsNow[index + 1] ?? cardsNow[index - 1];
      opener.current = neighbour
        ? (wall.current?.querySelector<HTMLElement>(`[id="card-${CSS.escape(neighbour.entryId)}"] a[href]`) ?? null)
        : null;
    }
    setLiftLeaves(leaves);
    setOpen(false);
    toast.dismiss(titleToastId(card.entryId));
    // One step after another: the sheet goes and the copy fades, then the cards glide into the gap.
    if (leaves && !prefersReducedMotion()) window.setTimeout(() => commit(card, index, to, target), LEAVE_MS);
    else commit(card, index, to, target);
  }

  function commit(card: LibraryCard, index: number, to: Status, target: MoveTarget) {
    startTransition(async () => {
      applyNow({ card, from: card.status, to, index });
      const result = await send(card.entryId, target);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const moved = result.data;
      const undoData = moved.undo;
      showActionToast("success", movedMessage(moved), {
        id: titleToastId(card.entryId),
        description: offersStars(moved) ? (
          <WatchedStars initial={null} onRate={(halfStars) => rate(card.entryId, halfStars)} />
        ) : undefined,
        action: undoData ? { label: "Undo", onClick: () => undo(card, index, undoData) } : undefined,
      });
    });
  }

  // "Open" is a real tap on the card's link, so the drawer opens, and the poster morphs, as from a tap.
  function openTitle() {
    const link = opener.current;
    setOpen(false);
    link?.click();
  }

  const facts: SheetFacts | null = subject
    ? {
        kind: subject.card.kind,
        status: subject.card.status,
        // Cards carry no Episode counts; a watching Series still has its progress.
        episodes: null,
      }
    : null;

  return (
    <MovesContext value={{ tab, shown, wallRef: wall, beforeRef: before, openSheet }}>
      {children}
      {subject && facts ? (
        <StatusSheet
          open={open}
          onClose={() => setOpen(false)}
          openerRef={opener}
          anchor={subject.anchor}
          side="beside"
          name={subject.card.name}
          posterPath={subject.card.posterPath}
          facts={facts}
          focusTitle={byPointer}
          onMove={move}
          onOpenTitle={openTitle}
          lift={subject.lift}
          liftKey={subject.id}
          liftLeaves={liftLeaves}
          onLiftDone={() => setSubject((current) => (current === subject ? { ...current, lift: null } : current))}
        />
      ) : null}
    </MovesContext>
  );
}

function HoldHint({ onClose }: { onClose: () => void }) {
  return (
    <div data-hold-hint className="flex w-[var(--width)] max-w-full items-center gap-2 rounded-[1.25rem] border bg-card py-1.5 pr-1.5 pl-4 text-sm font-medium text-card-foreground shadow-[0_12px_40px_-12px_rgb(0_0_0/0.5)]">
      <p className="flex-1">Press and hold a poster for quick actions.</p>
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-full hover:bg-secondary focus-visible:ring-3 focus-visible:ring-ring focus-visible:outline-none"
      >
        <X aria-hidden className="size-5" />
      </button>
    </div>
  );
}

/**
 * The wall, from the cards as they stand with pending moves applied. It also listens for
 * press-and-hold and right-click on its posters.
 */
export function LibraryWall({ kind, className }: { kind: KindFilter; className?: string }) {
  const moves = use(MovesContext);
  if (!moves) throw new Error("LibraryWall needs LibraryMoves above it.");
  const { tab, shown, wallRef, beforeRef, openSheet } = moves;
  const open = useRef(openSheet);
  useLayoutEffect(() => {
    open.current = openSheet;
  });

  // A move from the sheet glides the cards from where they stood just before it. A change that comes
  // from the server (a "Watched it" that makes a tile the lead) cross-fades the cards that changed
  // shape, from where they stood after the last change. A new layout glides by itself, so it only
  // starts a fresh record.
  const layout = useWallLayout();
  const placed = useRef<{ layout: Layout; cards: ReturnType<typeof placeCards> } | null>(null);
  useLayoutEffect(() => {
    const list = wallRef.current?.querySelector("ul") ?? null;
    const first = beforeRef.current;
    beforeRef.current = null;
    // Read before any card starts to move.
    const cards = placeCards(list);
    if (first) glide(list, first);
    else if (placed.current?.layout === layout) crossFadeReshaped(list, placed.current.cards);
    placed.current = { layout, cards };
  }, [shown.cards, beforeRef, wallRef, layout]);

  useEffect(() => {
    const root = wallRef.current;
    if (!root) return;
    let hold: { pointerId: number; x: number; y: number; timer: number } | null = null;
    let holdFired = false;
    // The click that follows a fired hold must not also open the drawer.
    let swallowClicksUntil = 0;

    const cardAt = (target: EventTarget | null) =>
      target instanceof Element ? target.closest<HTMLElement>('li[id^="card-"]') : null;

    function cancel() {
      if (hold) window.clearTimeout(hold.timer);
      hold = null;
    }

    // Any new press, on the sheet too, ends the wait for that click.
    function onAnyPointerDown() {
      swallowClicksUntil = 0;
      holdFired = false;
    }

    function onPointerDown(event: PointerEvent) {
      // A second finger is a pinch.
      if (!event.isPrimary) return cancel();
      if (event.button !== 0 || !(event.target instanceof Element) || event.target.closest("button")) return;
      const card = cardAt(event.target);
      if (!card || !root?.contains(card)) return;
      cancel();
      hold = {
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        timer: window.setTimeout(() => {
          hold = null;
          holdFired = true;
          navigator.vibrate?.(8);
          open.current(card, true);
        }, HOLD_MS),
      };
    }

    function onPointerMove(event: PointerEvent) {
      if (hold && event.pointerId === hold.pointerId && Math.hypot(event.clientX - hold.x, event.clientY - hold.y) > HOLD_SLOP_PX) cancel();
    }

    function onPointerEnd() {
      cancel();
      if (holdFired) {
        holdFired = false;
        swallowClicksUntil = performance.now() + 600;
      }
    }

    // After a hold on a touch screen the lifting finger must not become a tap: no click on the
    // poster, and no mouse press that would pull focus out of the sheet.
    function onTouchEnd(event: TouchEvent) {
      if (performance.now() <= swallowClicksUntil && event.cancelable) event.preventDefault();
    }

    function onClick(event: MouseEvent) {
      if (performance.now() > swallowClicksUntil || !cardAt(event.target)) return;
      swallowClicksUntil = 0;
      event.preventDefault();
      event.stopPropagation();
    }

    // Right-click, the keyboard's menu key, and a long press where the browser reports one.
    function onContextMenu(event: MouseEvent) {
      const card = cardAt(event.target);
      if (!card) return;
      event.preventDefault();
      const fromHold = hold !== null || holdFired;
      cancel();
      if (holdFired) return;
      if (fromHold) holdFired = true;
      // The keyboard's menu key sends no pointer type.
      open.current(card, "pointerType" in event && event.pointerType !== "");
    }

    function onDragStart(event: DragEvent) {
      if (cardAt(event.target)) event.preventDefault();
    }

    window.addEventListener("pointerdown", onAnyPointerDown, { capture: true });
    root.addEventListener("pointerdown", onPointerDown);
    root.addEventListener("contextmenu", onContextMenu);
    root.addEventListener("dragstart", onDragStart);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerup", onPointerEnd);
    window.addEventListener("pointercancel", onPointerEnd);
    window.addEventListener("scroll", cancel, { passive: true, capture: true });
    window.addEventListener("click", onClick, { capture: true });
    window.addEventListener("touchend", onTouchEnd, { passive: false });
    return () => {
      cancel();
      window.removeEventListener("pointerdown", onAnyPointerDown, { capture: true });
      root.removeEventListener("pointerdown", onPointerDown);
      root.removeEventListener("contextmenu", onContextMenu);
      root.removeEventListener("dragstart", onDragStart);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerEnd);
      window.removeEventListener("pointercancel", onPointerEnd);
      window.removeEventListener("scroll", cancel, { capture: true });
      window.removeEventListener("click", onClick, { capture: true });
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [wallRef]);

  return (
    <div ref={wallRef} className={className}>
      {shown.cards.length > 0 ? <LibraryGrid cards={shown.cards} /> : <LibraryEmpty tab={tab} kind={kind} />}
    </div>
  );
}
