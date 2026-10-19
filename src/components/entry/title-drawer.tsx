"use client";

import { useRouter } from "next/navigation";
import { useCallback, useLayoutEffect, useMemo, useRef, useState, ViewTransition, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { cn } from "cn";
import {
  clamp,
  DrawerMotionContext,
  prefersReducedMotion,
  releaseVelocity,
  spring,
} from "./drawer-motion";
import { CLOSE_LOOK, CloseIcon, HANDLE_BAR, HANDLE_LOOK } from "./drawer-chrome";
import { DrawerHero, DrawerTitleContext, heroFromTile, nextHero, type DrawerHeroState } from "./drawer-hero";
import { BODY_OVERLAP_PX, STRIP_PX } from "./entry-layout";
import { openedTile } from "./opened-tile";
import { holdHistoryMoves } from "./history-gate";
import { focusAfterInput } from "./quiet-focus";

const DESKTOP = "(min-width: 1024px)";

/** How far the desktop side panel travels when it slides in or out, in px. */
const SIDE_TRAVEL_PX = 470;

/** About how long the drawer takes to rise, in ms; `drawer-rise` in globals.css lasts 520. */
const RISE_MS = 600;

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

type Sample = [time: number, position: number];

type Controls = { close: () => void; toggle: () => void };

// Next.js keeps routes you navigated away from mounted but hidden, so an id can match a hidden copy
// of the Library as well as the one on screen.
function visibleElement(selector: string): HTMLElement | undefined {
  return Array.from(document.querySelectorAll<HTMLElement>(selector)).find(
    (element) => element.getClientRects().length > 0,
  );
}

/**
 * The Title over the Library. On a phone it rises to a quick view; pulling it up (or scrolling up
 * inside it) grows the same sections in place to full height, where they scroll. Pulling down from
 * the top shrinks it back, and pulling down again closes it. On desktop it is a side panel that
 * simply scrolls. Closing goes Back, so the Library's address returns and Forward reopens it.
 *
 * Every frame of a drag writes the drawer's transform, its --p variable and the scrim's opacity
 * straight to the DOM; React only hears about it when the drawer reaches or leaves full height.
 */
export function TitleDrawer({ children }: { children: ReactNode }) {
  const router = useRouter();
  const panel = useRef<HTMLElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const scrim = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const controls = useRef<Controls | null>(null);
  // A drag that started on the handle must not also toggle it when the finger lifts.
  const dragged = useRef(false);
  const [closing, setClosing] = useState(false);
  const [atFull, setAtFull] = useState(false);
  const [desktop, setDesktop] = useState(false);
  const [tile] = useState(openedTile);
  const [hero, setHero] = useState<DrawerHeroState>(() => heroFromTile(tile));
  const show = useCallback(
    (entryId: string | null, posterPath: string | null) => setHero((current) => nextHero(current, entryId, posterPath)),
    [],
  );

  useLayoutEffect(() => {
    if (!panel.current || !scroller.current || !scrim.current) return;
    const panelElement: HTMLElement = panel.current;
    const scrollElement: HTMLDivElement = scroller.current;
    const scrimElement: HTMLDivElement = scrim.current;
    const root = document.documentElement;
    const desktopQuery = window.matchMedia(DESKTOP);
    // `offset` is how far the drawer sits from its open place: down from the top on a phone, in
    // from the right edge on desktop.
    const geometry = { offset: 0, quick: 0, viewport: 0, desktop: false, full: false };
    let motion: { stop: () => void } | null = null;
    // Where a running spring is headed; null once it has landed.
    let target: number | null = null;
    let closingNow = false;
    // Back and Forward hide and reveal this same drawer, so it starts each showing afresh.
    setClosing(false);
    setAtFull(false);

    function apply(offset: number) {
      geometry.offset = offset;
      panelElement.dataset.moving = "";
      if (geometry.desktop) {
        panelElement.style.transform = `translate3d(${offset}px, 0, 0)`;
        scrimElement.style.opacity = String(clamp(1 - offset / SIDE_TRAVEL_PX, 0, 1));
        return;
      }
      panelElement.style.transform = `translate3d(0, ${offset}px, 0)`;
      const progress = clamp((geometry.quick - offset) / Math.max(1, geometry.quick), 0, 1);
      panelElement.style.setProperty("--p", progress.toFixed(4));
      scrimElement.style.opacity = String(
        clamp((geometry.viewport - offset) / Math.max(1, geometry.viewport - geometry.quick), 0, 1),
      );
      const full = offset <= 1;
      if (full !== geometry.full) {
        geometry.full = full;
        setAtFull(full);
      }
    }

    // Toasts read where the drawer settled: above its top edge, or at the top of the screen at full height.
    function settle() {
      if (closingNow) return;
      target = null;
      delete panelElement.dataset.moving;
      if (geometry.desktop) {
        root.dataset.drawer = "side";
        root.style.removeProperty("--drawer-lift");
        return;
      }
      root.dataset.drawer = geometry.offset <= 1 ? "full" : "quick";
      root.style.setProperty("--drawer-lift", `${Math.round(geometry.viewport - geometry.offset)}px`);
    }

    function measure() {
      geometry.viewport = window.innerHeight;
      geometry.desktop = desktopQuery.matches;
      setDesktop(geometry.desktop);
      if (geometry.desktop) {
        panelElement.style.setProperty("--p", "1");
        panelElement.style.setProperty("--gap", "0px");
        return;
      }
      const hero = scrollElement.querySelector<HTMLElement>("[data-title-hero]");
      const head = scrollElement.querySelector<HTMLElement>("[data-title-body] [data-title-head]");
      const heroHeight = hero?.offsetHeight ?? STRIP_PX;
      panelElement.style.setProperty("--gap", `${Math.max(0, heroHeight - STRIP_PX)}px`);
      // The quick view shows the strip, then the body from its top down to the stars, plus a little air.
      const headBottom = head ? head.offsetTop + head.offsetHeight : 240;
      const visible = STRIP_PX - BODY_OVERLAP_PX + headBottom + 20;
      geometry.quick = Math.round(clamp(geometry.viewport - visible, 80, geometry.viewport - 160));
    }

    function animateTo(to: number, velocity = 0) {
      motion?.stop();
      target = to;
      motion = spring({ from: geometry.offset, to, velocity, onUpdate: apply, onDone: settle });
    }

    function snap(to: "full" | "quick", velocity = 0) {
      if (closingNow || geometry.desktop) return;
      if (to === "quick" && scrollElement.scrollTop > 0) {
        scrollElement.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" });
      }
      animateTo(to === "full" ? 0 : geometry.quick, velocity);
    }

    // `leave` takes the drawer's address away once it has gone: Back by default, or a history
    // move the browser already made.
    function close(velocity = 0, leave: () => void = () => router.back()) {
      if (closingNow) return;
      closingNow = true;
      target = null;
      motion?.stop();
      motion = spring({
        from: geometry.offset,
        to: geometry.desktop ? SIDE_TRAVEL_PX : geometry.viewport,
        velocity,
        stiffness: 360,
        damping: 1,
        onUpdate: apply,
        onDone: () => {
          // The hero lets go of the poster's shared name before the Library returns, so the poster
          // stays in its tile instead of flying up from below the screen.
          flushSync(() => setClosing(true));
          leave();
        },
      });
    }

    // The browser's Back moves the address before anything can run, and the router would drop the
    // drawer in that same frame. The drawer holds the move back from the router, leaves the way the
    // Close button does, and then hands the router the same move. A move the browser animated
    // itself (an edge swipe) and one made while the drawer already leaves go straight through.
    const ownPath = window.location.pathname;
    let held = false;
    let replaying = false;
    function holdMove(event: PopStateEvent): boolean {
      if (replaying) return false;
      if (held) {
        // A second move while the drawer sinks: the router takes this one, and a move back to
        // this Title keeps the drawer open.
        held = false;
        motion?.stop();
        if (window.location.pathname === ownPath) {
          closingNow = false;
          animateTo(geometry.desktop ? 0 : geometry.quick);
        }
        return false;
      }
      const animatedByBrowser = "hasUAVisualTransition" in event && event.hasUAVisualTransition === true;
      if (closingNow || animatedByBrowser || prefersReducedMotion()) return false;
      held = true;
      const { state } = event;
      close(0, () => {
        if (!held) return;
        held = false;
        replaying = true;
        try {
          window.dispatchEvent(new PopStateEvent("popstate", { state }));
        } finally {
          replaying = false;
        }
      });
      return true;
    }

    // From the full view a pull down only shrinks it; from the quick view, far enough or fast enough closes it.
    function release(velocity: number, fromFull: boolean) {
      const projected = geometry.offset + velocity * 0.2;
      const pastClose = projected > geometry.quick + (geometry.viewport - geometry.quick) * 0.38;
      const flungDown = velocity > 1100 && geometry.offset > geometry.quick - 40;
      if (!fromFull && (pastClose || flungDown)) {
        close(velocity);
        return;
      }
      snap(Math.abs(projected) < Math.abs(projected - geometry.quick) ? "full" : "quick", velocity);
    }

    // The quick view follows its content. When the Title arrives in place of the skeleton, any
    // difference lands in the frame the Title paints in (observers report before paint), and --gap
    // moves with the offset, so no frame shows the strip at one size and the sections at another.
    // A change made in the drawer itself (a new Status, say) springs to the new size instead.
    function refit(arrived: boolean) {
      if (closingNow) return;
      const wasDesktop = geometry.desktop;
      const wasQuick = geometry.quick;
      const atQuick = !wasDesktop && Math.abs(geometry.offset - geometry.quick) < 2;
      measure();
      if (geometry.desktop !== wasDesktop) {
        motion?.stop();
        // The quick view never opens scrolled.
        if (!geometry.desktop) scrollElement.scrollTop = 0;
        apply(geometry.desktop ? 0 : geometry.quick);
        settle();
      } else if (geometry.quick === wasQuick) {
        return;
      } else if (target !== null) {
        // Still on its way to the quick view: the running spring aims at the new one.
        if (target === wasQuick) animateTo(geometry.quick);
      } else if (atQuick && arrived) {
        apply(geometry.quick);
        settle();
      } else if (atQuick) {
        animateTo(geometry.quick);
      }
    }

    let touch: {
      x: number;
      y: number;
      start: number;
      mode: "drag" | "scroll" | "none" | null;
      handle: boolean;
      fromFull: boolean;
      samples: Sample[];
    } | null = null;

    // Touch, Apple Maps style: at the quick view any vertical drag moves the drawer. At full height
    // the content scrolls, and a pull down from its top moves the drawer. The handle always drags.
    function onTouchStart(event: TouchEvent) {
      const point = event.touches[0];
      if (geometry.desktop || closingNow || event.touches.length !== 1 || !point) return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest("textarea, input, select")) return;
      touch = {
        x: point.clientX,
        y: point.clientY,
        start: geometry.offset,
        mode: null,
        handle: Boolean(target?.closest("[data-drawer-handle]")),
        fromFull: geometry.offset <= 1,
        samples: [[event.timeStamp, point.clientY]],
      };
    }

    function onTouchMove(event: TouchEvent) {
      const point = event.touches[0];
      if (!touch || !point) return;
      if (touch.mode === null) {
        const dx = point.clientX - touch.x;
        const dy = point.clientY - touch.y;
        if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
        if (Math.abs(dx) > Math.abs(dy)) {
          touch.mode = "none";
          return;
        }
        touch.mode =
          touch.fromFull && !touch.handle && (dy < 0 || scrollElement.scrollTop > 0) ? "scroll" : "drag";
        if (touch.mode === "drag") {
          motion?.stop();
          dragged.current = true;
          touch.y = point.clientY;
          touch.start = geometry.offset;
        }
      }
      if (touch.mode !== "drag") return;
      event.preventDefault();
      touch.samples.push([event.timeStamp, point.clientY]);
      if (touch.samples.length > 6) touch.samples.shift();
      apply(Math.max(0, touch.start + point.clientY - touch.y));
    }

    function onTouchEnd() {
      if (touch?.mode === "drag") release(releaseVelocity(touch.samples), touch.fromFull);
      touch = null;
    }

    // A mouse drags by the handle or the poster strip; touch has its own path above.
    let pointer: { id: number; y: number; start: number; moved: boolean; fromFull: boolean; samples: Sample[] } | null =
      null;

    function onPointerDown(event: PointerEvent) {
      dragged.current = false;
      if (event.pointerType !== "mouse" || event.button !== 0 || geometry.desktop || closingNow) return;
      const target = event.target instanceof Element ? event.target : null;
      if (!target?.closest("[data-drawer-handle], [data-title-hero]")) return;
      pointer = {
        id: event.pointerId,
        y: event.clientY,
        start: geometry.offset,
        moved: false,
        fromFull: geometry.offset <= 1,
        samples: [[event.timeStamp, event.clientY]],
      };
    }

    function onPointerMove(event: PointerEvent) {
      if (!pointer || event.pointerId !== pointer.id) return;
      if (!pointer.moved) {
        if (Math.abs(event.clientY - pointer.y) < 6) return;
        pointer.moved = true;
        dragged.current = true;
        motion?.stop();
        panelElement.setPointerCapture(event.pointerId);
        pointer.y = event.clientY;
        pointer.start = geometry.offset;
      }
      pointer.samples.push([event.timeStamp, event.clientY]);
      if (pointer.samples.length > 6) pointer.samples.shift();
      apply(Math.max(0, pointer.start + event.clientY - pointer.y));
    }

    function onPointerUp(event: PointerEvent) {
      if (!pointer || event.pointerId !== pointer.id) return;
      if (pointer.moved) release(releaseVelocity(pointer.samples), pointer.fromFull);
      pointer = null;
    }

    // A wheel or trackpad grows the quick view, and shrinks the full view from its top.
    let wheelLockedUntil = 0;
    function onWheel(event: WheelEvent) {
      if (geometry.desktop || closingNow) return;
      const full = geometry.offset <= 1;
      if (performance.now() < wheelLockedUntil) {
        if (!full) event.preventDefault();
        return;
      }
      if (!full && event.deltaY > 4) {
        event.preventDefault();
        wheelLockedUntil = performance.now() + 500;
        snap("full");
      } else if (full && scrollElement.scrollTop <= 0 && event.deltaY < -12) {
        event.preventDefault();
        wheelLockedUntil = performance.now() + 500;
        snap("quick");
      }
    }

    // Tab cycles through what can take focus now: the panel's own controls (the sticky name bar's
    // pill sits in an inert region and cannot), then the buttons of any toast, which lives outside
    // the panel. A menu, dialog or sheet opened from the drawer handles its own keys; a sheet that
    // closed on this Escape has already sent focus back, so its handled mark is what counts.
    function cycle(): HTMLElement[] {
      const reachable = (element: HTMLElement) =>
        element.getClientRects().length > 0 && !element.closest("[inert]");
      return [
        ...Array.from(panelElement.querySelectorAll<HTMLElement>(FOCUSABLE)),
        ...Array.from(document.querySelectorAll<HTMLElement>("[data-sonner-toaster] button:not([disabled])")),
      ].filter(reachable);
    }

    // The toaster sends focus back to where it came from when focus leaves it, in the middle of
    // this very move; a second call lands it where the cycle meant.
    function moveFocus(target: HTMLElement) {
      target.focus();
      if (document.activeElement !== target) target.focus();
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented) return;
      const active = document.activeElement;
      const inCycle =
        active === null ||
        active === document.body ||
        panelElement.contains(active) ||
        Boolean(active.closest("[data-sonner-toaster]"));
      if (!inCycle) return;
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== "Tab") return;
      const items = cycle();
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;
      const index = active instanceof HTMLElement ? items.indexOf(active) : -1;
      // The toast itself takes focus on the way to its buttons; going forward the browser's own step
      // is right. Going back, the toaster would send focus to where it came from, so the step is made here.
      if (index === -1 && active?.closest("[data-sonner-toaster]")) {
        if (!event.shiftKey) return;
        event.preventDefault();
        moveFocus(items.filter((item) => !item.closest("[data-sonner-toaster]")).pop() ?? last);
        return;
      }
      if (event.shiftKey && index > 0 && active?.closest("[data-sonner-toaster]")) {
        event.preventDefault();
        moveFocus(items[index - 1] ?? last);
        return;
      }
      if (index === -1) {
        event.preventDefault();
        moveFocus(event.shiftKey ? last : first);
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        moveFocus(last);
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        moveFocus(first);
      }
    }

    // The drawer's frame paints before the Title's address data reaches it, so it learns which
    // Title it holds, and its accessible name, from the content as that arrives.
    const resizeObserver = new ResizeObserver(() => refit(false));
    let watchedHead: Element | null = null;
    let entryId: string | undefined;
    function watchContent() {
      entryId = scrollElement.querySelector<HTMLElement>("[data-entry-id]")?.dataset.entryId ?? entryId;
      const name = scrollElement.querySelector("[data-title-name]");
      if (name?.id) panelElement.setAttribute("aria-labelledby", name.id);
      const head = scrollElement.querySelector("[data-title-head]");
      if (head === watchedHead) return;
      if (watchedHead) resizeObserver.unobserve(watchedHead);
      watchedHead = head;
      if (head) resizeObserver.observe(head);
    }
    const contentObserver = new MutationObserver(() => {
      watchContent();
      refit(true);
    });

    measure();
    watchContent();
    // Where the browser has view transitions, the drawer is already in place when React captures it:
    // it rises in the transition while the poster morphs from its tile. Elsewhere it springs up.
    const viaTransition = typeof document.startViewTransition === "function";
    if (viaTransition || prefersReducedMotion()) {
      apply(geometry.desktop ? 0 : geometry.quick);
      settle();
    } else {
      apply(geometry.desktop ? SIDE_TRAVEL_PX : geometry.viewport);
      animateTo(geometry.desktop ? 0 : geometry.quick);
    }
    // A poster colour that arrives while the drawer still rises lands at once instead of fading.
    panelElement.dataset.rising = "";
    const risen = window.setTimeout(() => delete panelElement.dataset.rising, prefersReducedMotion() ? 0 : RISE_MS);

    // The Library behind is out of reach while the drawer is open: no focus, no screen reader.
    const library = visibleElement("main#main");
    library?.setAttribute("inert", "");
    focusAfterInput(closeButton.current);

    contentObserver.observe(scrollElement, { childList: true });
    panelElement.addEventListener("touchstart", onTouchStart, { passive: true });
    panelElement.addEventListener("touchmove", onTouchMove, { passive: false });
    panelElement.addEventListener("touchend", onTouchEnd);
    panelElement.addEventListener("touchcancel", onTouchEnd);
    panelElement.addEventListener("pointerdown", onPointerDown);
    panelElement.addEventListener("pointermove", onPointerMove);
    panelElement.addEventListener("pointerup", onPointerUp);
    panelElement.addEventListener("pointercancel", onPointerUp);
    panelElement.addEventListener("wheel", onWheel, { passive: false });
    document.addEventListener("keydown", onKeyDown);
    holdHistoryMoves(holdMove);
    const onResize = () => refit(false);
    desktopQuery.addEventListener("change", onResize);
    window.addEventListener("resize", onResize);
    controls.current = { close, toggle: () => snap(geometry.offset <= 1 ? "quick" : "full") };

    return () => {
      motion?.stop();
      window.clearTimeout(risen);
      delete panelElement.dataset.rising;
      controls.current = null;
      resizeObserver.disconnect();
      contentObserver.disconnect();
      panelElement.removeEventListener("touchstart", onTouchStart);
      panelElement.removeEventListener("touchmove", onTouchMove);
      panelElement.removeEventListener("touchend", onTouchEnd);
      panelElement.removeEventListener("touchcancel", onTouchEnd);
      panelElement.removeEventListener("pointerdown", onPointerDown);
      panelElement.removeEventListener("pointermove", onPointerMove);
      panelElement.removeEventListener("pointerup", onPointerUp);
      panelElement.removeEventListener("pointercancel", onPointerUp);
      panelElement.removeEventListener("wheel", onWheel);
      document.removeEventListener("keydown", onKeyDown);
      holdHistoryMoves(null);
      desktopQuery.removeEventListener("change", onResize);
      window.removeEventListener("resize", onResize);
      delete root.dataset.drawer;
      root.style.removeProperty("--drawer-lift");
      library?.removeAttribute("inert");
      // Focus goes back to the poster that opened the drawer.
      if (entryId) focusAfterInput(visibleElement(`#card-${CSS.escape(entryId)} a[href]`));
    };
  }, [router]);

  const motionState = useMemo(() => ({ closing }), [closing]);
  const drawerTitle = useMemo(() => ({ tile, hero, show }), [tile, hero, show]);

  return (
    <DrawerMotionContext value={motionState}>
      <DrawerTitleContext value={drawerTitle}>
        <div
          ref={scrim}
          aria-hidden
          onClick={() => controls.current?.close()}
          className="fixed inset-0 z-50 touch-none bg-black/45 opacity-0"
        />
        <ViewTransition enter="drawer-in" exit="drawer-out" default="none">
          <section
            ref={panel}
            id="title-drawer"
            role="dialog"
            aria-modal="true"
            data-full={atFull ? "" : undefined}
            className={cn(
              // The edge only turns clear at full height, so the sections never move by its width.
              "fixed inset-x-0 top-0 z-50 h-dvh overflow-hidden border border-b-0 title-tint shadow-[0_-12px_50px_rgb(0_0_0/0.35)] will-change-transform",
              "lg:inset-x-auto lg:top-3 lg:right-3 lg:bottom-3 lg:h-auto lg:w-[430px] lg:rounded-sheet lg:border lg:shadow-[0_22px_54px_-18px_rgb(0_0_0/0.6)]",
              atFull ? "rounded-none border-transparent" : "rounded-t-sheet",
            )}
          >
            <button
              ref={closeButton}
              type="button"
              data-drawer-close
              aria-label="Close"
              onClick={() => controls.current?.close()}
              className={cn(
                CLOSE_LOOK,
                "z-[3] cursor-pointer transition-colors hover:bg-secondary focus-visible:ring-3 focus-visible:ring-ring focus-visible:outline-none",
              )}
            >
              <CloseIcon />
            </button>
            <button
              type="button"
              data-drawer-handle
              aria-label={atFull ? "Show less" : "Show more"}
              onClick={(event) => {
                // Enter and Space click with detail 0; no drag can be behind them.
                if (event.detail === 0 || !dragged.current) controls.current?.toggle();
              }}
              className={cn(
                HANDLE_LOOK,
                "z-[3] cursor-grab touch-none rounded-full focus-visible:ring-3 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset",
              )}
            >
              <span aria-hidden className={HANDLE_BAR} />
            </button>
            <div
              ref={scroller}
              className={cn(
                "absolute inset-0 overscroll-contain rounded-[inherit]",
                atFull || desktop ? "overflow-y-auto" : "overflow-hidden",
              )}
            >
              <DrawerHero />
              {children}
            </div>
          </section>
        </ViewTransition>
      </DrawerTitleContext>
    </DrawerMotionContext>
  );
}
