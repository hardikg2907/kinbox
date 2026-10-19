"use client";

import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
  type ReactNode,
  type RefObject,
} from "react";
import { cn } from "cn";
import { GRID, WALL_CLASS, readLayoutCookie, writeLayoutCookie, type Layout } from "@/components/library/layout";
import { wallMarks } from "@/components/library/wall-marks";

// One layout per page, shared by the top bar's Tiles and List buttons (in the static shell) and the
// wall (which streams in later). It starts from the cookie, the same one the server and the head
// script read.
let saved: Layout | null = null;
// Where Tiles goes back to: the tile size last pinched to, or the default.
let lastTiles: Layout = "auto";
const listeners = new Set<() => void>();
const beforeChange = new Set<() => void>();

function currentLayout(): Layout {
  saved ??= readLayoutCookie(document.cookie);
  return saved;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The saved layout; `serverLayout` stands in while the page hydrates. */
export function useSavedLayout(serverLayout: Layout): Layout {
  return useSyncExternalStore(subscribe, currentLayout, () => serverLayout);
}

export function changeLayout(next: Layout): void {
  const now = currentLayout();
  if (next === now) return;
  if (now !== "list") lastTiles = now;
  for (const run of beforeChange) run();
  saved = next;
  document.documentElement.setAttribute("data-wall-layout", next);
  writeLayoutCookie(next);
  for (const listener of listeners) listener();
}

export function showTiles(): void {
  if (currentLayout() === "list") changeLayout(lastTiles);
}

/**
 * Sets the head script's marks again. React clears attributes it does not own from <html> when it
 * remounts the root in development, and a move to the Library from another page runs no head script.
 */
export function markWall(): void {
  const root = document.documentElement;
  const marks = wallMarks(document.cookie, location.pathname, location.search);
  root.setAttribute("data-wall-layout", currentLayout());
  if (marks["data-wall-tab"]) root.setAttribute("data-wall-tab", marks["data-wall-tab"]);
  if (marks["data-wall-kind"]) root.setAttribute("data-wall-kind", marks["data-wall-kind"]);
}

type WallLayout = {
  layout: Layout;
  wall: RefObject<HTMLUListElement | null>;
};

const WallLayoutContext = createContext<WallLayout | null>(null);

const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Where each card on (or near) the screen sits, so a change can glide the cards to their new places. */
export function measure(root: HTMLElement | null): Map<string, DOMRect> {
  const map = new Map<string, DOMRect>();
  if (!root) return map;
  const height = window.innerHeight;
  for (const card of root.querySelectorAll<HTMLElement>(":scope > li[id]")) {
    const rect = card.getBoundingClientRect();
    // Cards far off screen need no motion.
    if (rect.bottom < -height || rect.top > height * 2) continue;
    map.set(card.id, rect);
  }
  return map;
}

/** Moves each card from where `measure` saw it to where it sits now. Cards new to the wall just appear. */
export function glide(root: HTMLElement | null, first: Map<string, DOMRect>) {
  if (!root) return;
  const easing = "cubic-bezier(0.22, 1, 0.36, 1)";
  const spring = getComputedStyle(document.documentElement).getPropertyValue("--spring").trim();
  for (const card of root.querySelectorAll<HTMLElement>(":scope > li[id]")) {
    const from = first.get(card.id);
    if (!from) continue;
    const to = card.getBoundingClientRect();
    if (to.width === 0) continue;
    const scale = from.width / to.width;
    const dx = from.left - to.left;
    const dy = from.top - to.top;
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1 && Math.abs(1 - scale) < 0.01) continue;
    // A card that changes shape too much (grid to list) fades in instead of stretching.
    const stretchy = Math.abs(1 - scale) > 0.6;
    const frames: Keyframe[] = stretchy
      ? [{ opacity: 0 }, { opacity: 1 }]
      : [{ transform: `translate(${dx}px, ${dy}px) scale(${scale})`, transformOrigin: "0 0" }, { transform: "none", transformOrigin: "0 0" }];
    const options: KeyframeAnimationOptions = { duration: 520, easing };
    try {
      card.animate(frames, spring ? { ...options, easing: spring } : options);
    } catch {
      card.animate(frames, options);
    }
  }
}

const DESKTOP_STEPS: readonly Layout[] = ["2", "3", "4"];

export function LayoutProvider({ initial, children }: { initial: Layout; children: ReactNode }) {
  const layout = useSavedLayout(initial);
  const wall = useRef<HTMLUListElement>(null);
  const snapshot = useRef<Map<string, DOMRect> | null>(null);

  // With reduced motion the change is instant: no snapshot means no glide.
  useEffect(() => {
    const takeSnapshot = () => {
      snapshot.current = prefersReducedMotion() ? null : measure(wall.current);
    };
    beforeChange.add(takeSnapshot);
    return () => {
      beforeChange.delete(takeSnapshot);
    };
  }, []);

  useLayoutEffect(() => {
    const first = snapshot.current;
    snapshot.current = null;
    if (first) glide(wall.current, first);
  }, [layout]);

  // Pinch on the wall switches two and three columns on a phone; Ctrl or Cmd with the wheel steps
  // through the grids on a desktop (a laptop trackpad pinch arrives as Ctrl + wheel). The listeners
  // sit on the document because the wall's list unmounts while a tab is empty; they act only on
  // events that start inside the wall, and leave the browser's own zoom alone elsewhere.
  useEffect(() => {
    const inWall = (target: EventTarget | null) =>
      target instanceof Node && Boolean(wall.current?.contains(target));
    let startDistance = 0;
    const distance = (touches: TouchList) => Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);

    const onStart = (event: TouchEvent) => {
      startDistance = event.touches.length === 2 && inWall(event.target) ? distance(event.touches) : 0;
    };
    const onMove = (event: TouchEvent) => {
      if (startDistance === 0 || event.touches.length !== 2) return;
      const ratio = distance(event.touches) / startDistance;
      const now = currentLayout();
      if (now === "list") return;
      const columns = now === "3" || now === "4" ? "3" : "2";
      if (ratio > 1.25 && columns === "3") changeLayout("2");
      else if (ratio < 0.8 && columns === "2") changeLayout("3");
      else return;
      startDistance = distance(event.touches);
    };
    const onEnd = (event: TouchEvent) => {
      if (event.touches.length < 2) startDistance = 0;
    };
    // iOS Safari zooms the page on a pinch even with touch-action set.
    const onGesture = (event: Event) => {
      if (inWall(event.target)) event.preventDefault();
    };

    let acc = 0;
    let lockedUntil = 0;
    const onWheel = (event: WheelEvent) => {
      if (!(event.ctrlKey || event.metaKey) || !inWall(event.target) || !window.matchMedia("(min-width: 1024px)").matches) return;
      const now = currentLayout();
      if (now === "list") return;
      // The rest of one pinch, right after a change, must not zoom the page either.
      if (performance.now() < lockedUntil) {
        event.preventDefault();
        return;
      }
      acc += event.deltaY;
      if (Math.abs(acc) < 40) return;
      const index = DESKTOP_STEPS.indexOf(now === "auto" ? "4" : now);
      const next = DESKTOP_STEPS[Math.min(DESKTOP_STEPS.length - 1, Math.max(0, index + (acc > 0 ? 1 : -1)))];
      acc = 0;
      if (next === (now === "auto" ? "4" : now)) return;
      event.preventDefault();
      lockedUntil = performance.now() + 380;
      changeLayout(next);
    };

    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchmove", onMove, { passive: true });
    document.addEventListener("touchend", onEnd);
    document.addEventListener("touchcancel", onEnd);
    document.addEventListener("gesturestart", onGesture);
    window.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
      document.removeEventListener("touchcancel", onEnd);
      document.removeEventListener("gesturestart", onGesture);
      window.removeEventListener("wheel", onWheel);
    };
  }, []);

  const value = useMemo(() => ({ layout, wall }), [layout]);
  return <WallLayoutContext value={value}>{children}</WallLayoutContext>;
}

type Props = {
  /** The first card as the wide tile, shown in every grid layout. */
  lead?: ReactNode;
  /** The same card as an ordinary one, which List view shows in the lead's place. */
  leadAsRow?: ReactNode;
  children: ReactNode;
};

export function WallFrame({ lead, leadAsRow, children }: Props) {
  const { layout, wall } = useContext(WallLayoutContext)!;
  return (
    <ul ref={wall} id="library-grid" data-layout={layout} className={cn(WALL_CLASS, GRID[layout])}>
      {layout === "list" ? leadAsRow : lead}
      {children}
    </ul>
  );
}
