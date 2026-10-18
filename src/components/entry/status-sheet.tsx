"use client";

import { Eye } from "lucide-react";
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "cn";
import { Sheet } from "@/components/library/sheet";
import { posterUrl } from "@/lib/tmdb/images";
import { SHEET_LINE, sheetRows, type MoveTarget, type SheetFacts } from "./status-moves";

const DESKTOP = "(min-width: 1024px)";
const EDGE = 12;
const FOCUS = "focus-visible:ring-3 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset";
const ROW =
  "flex min-h-12 w-full cursor-pointer items-center gap-3.5 rounded-card px-3.5 py-2 text-left text-base font-semibold hover:bg-secondary active:bg-accent";

/** A poster on the wall that press-and-hold lifts out of the page while the sheet is open. */
export type LiftSource = {
  poster: HTMLElement;
  src: string | null;
  imageClass: string;
  /** Hides the wall's own poster while its copy is lifted. */
  hide: (hidden: boolean) => void;
};

type Props = {
  open: boolean;
  onClose: () => void;
  openerRef: RefObject<HTMLElement | null>;
  /** The opener's box, taken when the sheet opens: the sheet grows out of it. */
  anchor: DOMRect | null;
  /** On desktop the sheet sits below a pill, or beside a poster. */
  side: "below" | "beside";
  name: string;
  posterPath: string | null;
  facts: SheetFacts;
  onMove: (target: MoveTarget) => void;
  /**
   * Opened by a tap or a click: focus lands on the name, so no row looks picked. From the keyboard
   * it lands on the first row.
   */
  focusTitle?: boolean;
  /** Press-and-hold adds an "Open" row on top. */
  onOpenTitle?: () => void;
  lift?: LiftSource | null;
  /** Changes with every press-and-hold, so each lift starts from its own poster. */
  liftKey?: number;
  /** The move took the lifted poster out of the tab, so it fades away instead of settling back. */
  liftLeaves?: boolean;
  /** The lifted poster has settled back or faded away. */
  onLiftDone?: () => void;
};

type Place = {
  left: number;
  top: number;
  origin: string;
  /** Where the lifted poster goes, and which poster that was measured for. */
  lift: { poster: HTMLElement; transform: string } | null;
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), Math.max(min, max));

const noop = () => () => {};

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function placeOnDesktop(anchor: DOMRect, side: Props["side"], width: number, height: number) {
  const maxLeft = window.innerWidth - width - EDGE;
  const maxTop = window.innerHeight - height - EDGE;
  if (side === "beside") {
    const right = anchor.right + EDGE;
    const left = right <= maxLeft ? right : anchor.left - EDGE - width;
    return { left: clamp(left, EDGE, maxLeft), top: clamp(anchor.top, EDGE, maxTop) };
  }
  const below = anchor.bottom + 8;
  const top = below <= maxTop ? below : anchor.top - 8 - height;
  return { left: clamp(anchor.left, EDGE, maxLeft), top: clamp(top, EDGE, maxTop) };
}

// Where the lifted poster goes: a little larger, and on a phone up into the room the sheet leaves.
function liftTransform(rect: DOMRect, room: number | null): string {
  const fit = room === null ? 1.04 : Math.min(1.05, (room - EDGE) / rect.height, (window.innerWidth - 2 * EDGE) / rect.width);
  const scale = Math.max(0.45, fit);
  const width = rect.width * scale;
  const height = rect.height * scale;
  let left = rect.left - (width - rect.width) / 2;
  let top = rect.top - (height - rect.height) / 2;
  if (room !== null) {
    left = clamp(left, EDGE, window.innerWidth - width - EDGE);
    top = clamp(top, EDGE, room - height);
  }
  return `translate(${left - rect.left}px, ${top - rect.top}px) scale(${scale})`;
}

/**
 * The action sheet that moves a Title to another Status: a sheet from the bottom on a phone, a
 * popover beside what opened it on desktop. It lives on the body so the drawer's transform and
 * clipping cannot hold it.
 */
export function StatusSheet(props: Props) {
  const { open, onClose, openerRef, anchor, side, name, posterPath, facts, onMove, onOpenTitle } = props;
  const nameId = useId();
  const layer = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<Place | null>(null);
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  const thumb = posterUrl(posterPath, "w92");

  useLayoutEffect(() => {
    const element = layer.current?.querySelector<HTMLElement>('[role="dialog"]');
    if (!open || !element) return;
    const desktop = window.matchMedia(DESKTOP).matches;
    const width = element.offsetWidth;
    const height = element.offsetHeight;
    // Transforms do not move offsetLeft and offsetTop, so these are the sheet's resting place.
    const at =
      desktop && anchor
        ? placeOnDesktop(anchor, side, width, height)
        : { left: element.offsetLeft, top: element.offsetTop };
    const origin = anchor
      ? `${anchor.left + anchor.width / 2 - at.left}px ${anchor.top + anchor.height / 2 - at.top}px`
      : "50% 100%";
    const poster = props.lift?.poster;
    setPlace({
      ...at,
      origin,
      lift: poster
        ? { poster, transform: liftTransform(poster.getBoundingClientRect(), desktop ? null : at.top - EDGE) }
        : null,
    });
    // Measured once per opening; the props it reads were all set together with `open`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!mounted) return null;

  const rows = sheetRows(facts);
  return createPortal(
    <div ref={layer} className="contents">
      <Sheet
        open={open}
        onClose={onClose}
        labelledBy={nameId}
        initialFocusId={props.focusTitle ? nameId : undefined}
        openerRef={openerRef}
        origin={place?.origin ?? "50% 100%"}
        scrimClassName="z-[60] bg-black/40"
        behind={
          props.lift ? (
            <LiftedPoster
              key={props.liftKey}
              source={props.lift}
              open={open}
              transform={place?.lift?.poster === props.lift.poster ? place.lift.transform : null}
              leaves={props.liftLeaves ?? false}
              onDone={props.onLiftDone}
            />
          ) : null
        }
        style={
          place
            ? ({ "--sheet-left": `${place.left}px`, "--sheet-top": `${place.top}px` } as CSSProperties)
            : undefined
        }
        className={cn(
          "z-[60] inset-x-2 bottom-[calc(env(safe-area-inset-bottom)+0.5rem)] mx-auto max-w-110 p-2",
          "lg:inset-x-auto lg:right-auto lg:bottom-auto lg:left-(--sheet-left) lg:top-(--sheet-top) lg:mx-0 lg:w-90",
        )}
      >
        <div data-status-sheet className="flex items-center gap-3 px-2.5 pt-2 pb-2.5">
          {thumb ? (
            // TMDB serves sized posters, so next/image optimisation would only spend quota.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumb} alt="" draggable={false} className="h-12 w-8 shrink-0 rounded-thumb bg-muted object-cover" />
          ) : (
            <span aria-hidden className="h-12 w-8 shrink-0 rounded-thumb bg-muted" />
          )}
          <div className="min-w-0">
            <h2 id={nameId} tabIndex={-1} className="truncate text-base leading-tight font-extrabold outline-none">
              {name}
            </h2>
            <p className="text-sm text-muted-foreground">{SHEET_LINE[facts.status]}</p>
          </div>
        </div>
        {onOpenTitle ? (
          <>
            <button type="button" onClick={onOpenTitle} className={cn(ROW, FOCUS)}>
              <Eye aria-hidden className="size-5 shrink-0" />
              Open
            </button>
            <hr className="mx-3 my-1" />
          </>
        ) : null}
        <ul className="flex flex-col">
          {rows.map(({ target, label, helper, icon: Icon }) => (
            <li key={target}>
              <button type="button" onClick={() => onMove(target)} className={cn(ROW, FOCUS)}>
                <Icon aria-hidden className="size-5 shrink-0" />
                <span className="flex min-w-0 flex-col">
                  {label}
                  {helper ? <span className="text-sm font-medium text-muted-foreground">{helper}</span> : null}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={onClose}
          className={cn(
            "mt-1.5 min-h-12 w-full cursor-pointer rounded-card bg-secondary text-base font-semibold hover:bg-accent",
            FOCUS,
          )}
        >
          Cancel
        </button>
      </Sheet>
    </div>,
    document.body,
  );
}

type LiftProps = {
  source: LiftSource;
  open: boolean;
  /** Null until the sheet has measured where it sits. */
  transform: string | null;
  leaves: boolean;
  onDone?: () => void;
};

// A copy of the wall's poster, drawn over the scrim, so the poster rises out of the dimmed page.
// The wall's own poster hides meanwhile; its image is already decoded, so the copy shows at once.
function LiftedPoster({ source, open, transform, leaves, onDone }: LiftProps) {
  const box = useRef<HTMLDivElement>(null);
  const [rect] = useState(() => source.poster.getBoundingClientRect());
  const [radius] = useState(() => getComputedStyle(source.poster).borderTopLeftRadius);
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  });

  useEffect(() => {
    const { hide } = source;
    hide(true);
    return () => hide(false);
  }, [source]);

  useEffect(() => {
    const element = box.current;
    if (!element) return;
    if (transform === null) {
      if (!open) done.current?.();
      return;
    }
    const spring = getComputedStyle(document.documentElement).getPropertyValue("--spring").trim() || "ease-out";
    const quick = prefersReducedMotion();
    if (open) {
      element.animate([{ transform: "none" }, { transform }], {
        duration: quick ? 0 : 500,
        easing: spring,
        fill: "forwards",
      });
      return;
    }
    const frames: Keyframe[] = leaves
      ? [{ transform, opacity: 1 }, { transform: `${transform} scale(0.85)`, opacity: 0 }]
      : [{ transform }, { transform: "none" }];
    const settle = element.animate(frames, { duration: quick ? 0 : leaves ? 220 : 320, easing: "ease-out", fill: "forwards" });
    settle.finished.then(
      () => done.current?.(),
      () => {},
    );
  }, [open, transform, leaves]);

  return (
    <div
      ref={box}
      aria-hidden
      style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height, borderRadius: radius }}
      className="pointer-events-none fixed z-[60] origin-top-left overflow-hidden bg-muted shadow-[0_30px_70px_-20px_rgb(0_0_0/0.75)]"
    >
      {source.src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={source.src} alt="" draggable={false} className={source.imageClass} />
      ) : null}
    </div>
  );
}
