"use client";

import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLayoutEffect, useMemo, useRef, useState, ViewTransition, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { cn } from "cn";
import {
  clamp,
  DrawerMotionContext,
  prefersReducedMotion,
  releaseVelocity,
  spring,
} from "./drawer-motion";
import { BODY_OVERLAP_PX, STRIP_PX } from "./entry-layout";

const DESKTOP = "(min-width: 1024px)";

/** How far the desktop side panel travels when it slides in or out, in px. */
const SIDE_TRAVEL_PX = 470;

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

    function animateTo(target: number, velocity = 0) {
      motion?.stop();
      motion = spring({ from: geometry.offset, to: target, velocity, onUpdate: apply, onDone: settle });
    }

    function snap(to: "full" | "quick", velocity = 0) {
      if (closingNow || geometry.desktop) return;
      if (to === "quick" && scrollElement.scrollTop > 0) {
        scrollElement.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" });
      }
      animateTo(to === "full" ? 0 : geometry.quick, velocity);
    }

    function close(velocity = 0) {
      if (closingNow) return;
      closingNow = true;
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
          router.back();
        },
      });
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

    // When the content arrives, or the quick view's content changes size, the quick view follows.
    function refit() {
      if (closingNow) return;
      const wasDesktop = geometry.desktop;
      const atQuick = !wasDesktop && Math.abs(geometry.offset - geometry.quick) < 2;
      measure();
      if (geometry.desktop !== wasDesktop) {
        motion?.stop();
        apply(geometry.desktop ? 0 : geometry.quick);
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

    // A menu, dialog or toast opened from the drawer handles its own keys.
    function onKeyDown(event: KeyboardEvent) {
      const active = document.activeElement;
      const onDrawer = active === null || active === document.body || panelElement.contains(active);
      if (!onDrawer) return;
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== "Tab") return;
      const items = Array.from(panelElement.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (element) => element.getClientRects().length > 0,
      );
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;
      if (!panelElement.contains(active)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    // The drawer's frame paints before the Title's address data reaches it, so it learns which
    // Title it holds, and its accessible name, from the content as that arrives.
    const resizeObserver = new ResizeObserver(refit);
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
      refit();
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

    // The Library behind is out of reach while the drawer is open: no focus, no screen reader.
    const library = visibleElement("main#main");
    library?.setAttribute("inert", "");
    closeButton.current?.focus({ preventScroll: true });

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
    desktopQuery.addEventListener("change", refit);
    window.addEventListener("resize", refit);
    controls.current = { close, toggle: () => snap(geometry.offset <= 1 ? "quick" : "full") };

    return () => {
      motion?.stop();
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
      desktopQuery.removeEventListener("change", refit);
      window.removeEventListener("resize", refit);
      delete root.dataset.drawer;
      root.style.removeProperty("--drawer-lift");
      library?.removeAttribute("inert");
      // Focus goes back to the poster that opened the drawer.
      if (entryId) visibleElement(`#card-${CSS.escape(entryId)} a[href]`)?.focus({ preventScroll: true });
    };
  }, [router]);

  const motionState = useMemo(() => ({ closing }), [closing]);

  return (
    <DrawerMotionContext value={motionState}>
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
          className={cn(
            "fixed inset-x-0 top-0 z-50 h-dvh overflow-hidden bg-background shadow-[0_-12px_50px_rgb(0_0_0/0.35)] will-change-transform",
            "lg:inset-x-auto lg:top-3 lg:right-3 lg:bottom-3 lg:h-auto lg:w-[430px] lg:rounded-sheet lg:border lg:shadow-[0_22px_54px_-18px_rgb(0_0_0/0.6)]",
            atFull ? "rounded-none" : "rounded-t-sheet border border-b-0",
          )}
        >
          <div
            ref={scroller}
            className={cn("absolute inset-0 overscroll-contain", atFull || desktop ? "overflow-y-auto" : "overflow-hidden")}
          >
            {children}
          </div>
          <button
            ref={closeButton}
            type="button"
            aria-label="Close"
            onClick={() => controls.current?.close()}
            className="glass-strong absolute top-3 left-3 z-[3] grid size-11 translate-y-[calc(env(safe-area-inset-top)*var(--p,0))] cursor-pointer place-items-center rounded-full border text-foreground transition-colors hover:bg-secondary focus-visible:ring-3 focus-visible:ring-ring focus-visible:outline-none"
          >
            <X aria-hidden className="size-5" />
          </button>
          <button
            type="button"
            data-drawer-handle
            aria-label={atFull ? "Show less" : "Show more"}
            aria-expanded={atFull}
            onClick={() => {
              if (!dragged.current) controls.current?.toggle();
            }}
            className="absolute top-0 left-1/2 z-[3] flex h-11 w-30 -translate-x-1/2 translate-y-[calc(env(safe-area-inset-top)*var(--p,0))] cursor-grab touch-none justify-center rounded-full pt-2.5 focus-visible:ring-3 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset lg:hidden"
          >
            <span aria-hidden className="h-1.5 w-10 rounded-full bg-white/90 shadow-[0_1px_6px_rgb(0_0_0/0.45)]" />
          </button>
        </section>
      </ViewTransition>
    </DrawerMotionContext>
  );
}
