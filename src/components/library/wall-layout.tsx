"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { cn } from "cn";
import { writeLayoutCookie, type Layout } from "@/components/library/layout";

type WallLayout = {
  layout: Layout;
  setLayout: (next: Layout) => void;
  wall: RefObject<HTMLUListElement | null>;
  /** Card positions taken just before a change, so the wall can glide to the new ones. */
  snapshot: RefObject<Map<string, DOMRect> | null>;
};

const WallLayoutContext = createContext<WallLayout | null>(null);

export function useWallLayout(): Pick<WallLayout, "layout" | "setLayout"> {
  const value = useContext(WallLayoutContext);
  if (!value) throw new Error("useWallLayout needs a LayoutProvider above it.");
  return value;
}

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
  const [layout, setLayoutState] = useState<Layout>(initial);
  const wall = useRef<HTMLUListElement>(null);
  const snapshot = useRef<Map<string, DOMRect> | null>(null);
  const current = useRef(layout);

  const setLayout = useCallback((next: Layout) => {
    if (next === current.current) return;
    current.current = next;
    // With reduced motion the change is instant: no snapshot means no glide.
    snapshot.current = prefersReducedMotion() ? null : measure(wall.current);
    setLayoutState(next);
    writeLayoutCookie(next);
  }, []);

  useLayoutEffect(() => {
    const first = snapshot.current;
    snapshot.current = null;
    if (first) glide(wall.current, first);
  }, [layout]);

  // Pinch on the wall switches two and three columns on a phone; Ctrl or Cmd with the wheel steps
  // through the grids on a desktop (a laptop trackpad pinch arrives as Ctrl + wheel).
  useEffect(() => {
    const root = wall.current;
    if (!root) return;
    let startDistance = 0;
    const distance = (touches: TouchList) => Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);

    const onStart = (event: TouchEvent) => {
      startDistance = event.touches.length === 2 ? distance(event.touches) : 0;
    };
    const onMove = (event: TouchEvent) => {
      if (startDistance === 0 || event.touches.length !== 2) return;
      const ratio = distance(event.touches) / startDistance;
      const now = current.current;
      if (now === "list") return;
      const columns = now === "3" || now === "4" ? "3" : "2";
      if (ratio > 1.25 && columns === "3") setLayout("2");
      else if (ratio < 0.8 && columns === "2") setLayout("3");
      else return;
      startDistance = distance(event.touches);
    };
    const onEnd = (event: TouchEvent) => {
      if (event.touches.length < 2) startDistance = 0;
    };
    // iOS Safari zooms the page on a pinch even with touch-action set.
    const onGesture = (event: Event) => event.preventDefault();

    let acc = 0;
    let lockedUntil = 0;
    const onWheel = (event: WheelEvent) => {
      if (!(event.ctrlKey || event.metaKey) || !window.matchMedia("(min-width: 1024px)").matches) return;
      event.preventDefault();
      const now = current.current;
      if (now === "list") return;
      acc += event.deltaY;
      if (performance.now() < lockedUntil || Math.abs(acc) < 40) return;
      const index = DESKTOP_STEPS.indexOf(now === "auto" ? "4" : now);
      const next = DESKTOP_STEPS[Math.min(DESKTOP_STEPS.length - 1, Math.max(0, index + (acc > 0 ? 1 : -1)))];
      acc = 0;
      lockedUntil = performance.now() + 380;
      setLayout(next);
    };

    root.addEventListener("touchstart", onStart, { passive: true });
    root.addEventListener("touchmove", onMove, { passive: true });
    root.addEventListener("touchend", onEnd);
    root.addEventListener("touchcancel", onEnd);
    root.addEventListener("gesturestart", onGesture);
    window.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      root.removeEventListener("touchstart", onStart);
      root.removeEventListener("touchmove", onMove);
      root.removeEventListener("touchend", onEnd);
      root.removeEventListener("touchcancel", onEnd);
      root.removeEventListener("gesturestart", onGesture);
      window.removeEventListener("wheel", onWheel);
    };
  }, [setLayout]);


  const value = useMemo(() => ({ layout, setLayout, wall, snapshot }), [layout, setLayout]);
  return <WallLayoutContext value={value}>{children}</WallLayoutContext>;
}

// Every layout gives the same cards a new place, so only the grid's own classes change here.
// "4" is three on a phone, which a phone-only 4 would otherwise make too narrow.
const GRID: Record<Layout, string> = {
  auto: "grid-cols-2 gap-x-2 gap-y-5 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6",
  "2": "grid-cols-2 gap-x-2 gap-y-5",
  "3": "grid-cols-3 gap-x-1.5 gap-y-4",
  "4": "grid-cols-3 gap-x-1.5 gap-y-4 sm:grid-cols-4 sm:gap-x-1 sm:gap-y-3.5",
  list: "grid-cols-1 gap-0 px-4",
};


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
    <ul
      ref={wall}
      id="library-grid"
      data-layout={layout}
      className={cn(
        "grid touch-pan-y pr-[max(0.5rem,env(safe-area-inset-right))] pb-[calc(env(safe-area-inset-bottom)+8.5rem)] pl-[max(0.5rem,env(safe-area-inset-left))] lg:px-3 lg:pb-8",
        GRID[layout],
      )}
    >
      {layout === "list" ? leadAsRow : lead}
      {children}
    </ul>
  );
}
