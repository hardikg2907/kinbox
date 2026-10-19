"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode, type RefObject } from "react";
import { cn } from "cn";

type Props = {
  open: boolean;
  onClose: () => void;
  /** Accessible name of the dialog. */
  label?: string;
  /** Or the id of the element that names it. */
  labelledBy?: string;
  /** Where focus goes on close: the control that opened the sheet. */
  openerRef: RefObject<HTMLElement | null>;
  /** The element that takes focus on open; the first control when omitted. */
  initialFocusId?: string;
  /** Where the sheet grows from, as a CSS transform-origin. */
  origin: string;
  className?: string;
  /** Stacking for the scrim, when the sheet has to sit over another layer such as the drawer. */
  scrimClassName?: string;
  /** Drawn over the scrim and under the sheet, such as a poster lifted out of the page. */
  behind?: ReactNode;
  style?: CSSProperties;
  children: ReactNode;
};

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Whether the last input was a key, so focus handed back after a tap or a click shows no ring.
let keyboardLast = false;
let watchingInput = false;

function watchInput() {
  if (watchingInput) return;
  watchingInput = true;
  window.addEventListener(
    "keydown",
    () => {
      keyboardLast = true;
      document.querySelector("[data-pointer-focus]")?.removeAttribute("data-pointer-focus");
    },
    { capture: true },
  );
  window.addEventListener(
    "pointerdown",
    () => {
      keyboardLast = false;
    },
    { capture: true },
  );
}

function handBackFocus(element: HTMLElement | null) {
  if (!element) return;
  if (!keyboardLast) {
    element.setAttribute("data-pointer-focus", "");
    element.addEventListener("blur", () => element.removeAttribute("data-pointer-focus"), { once: true });
  }
  element.focus({ preventScroll: true });
}

// A glass sheet over a dimmed page. It stays mounted so its state and its grow/shrink motion survive;
// `inert` keeps it out of the tab order and the accessibility tree while closed.
export function Sheet({
  open,
  onClose,
  label,
  labelledBy,
  openerRef,
  initialFocusId,
  origin,
  className,
  scrimClassName,
  behind,
  style,
  children,
}: Props) {
  const panel = useRef<HTMLDivElement>(null);
  const wasOpen = useRef(false);

  useEffect(watchInput, []);

  useEffect(() => {
    if (open) {
      wasOpen.current = true;
      const target = initialFocusId ? document.getElementById(initialFocusId) : null;
      (target ?? panel.current?.querySelector<HTMLElement>(FOCUSABLE))?.focus({ preventScroll: true });
    } else if (wasOpen.current) {
      wasOpen.current = false;
      handBackFocus(openerRef.current);
    }
  }, [open, initialFocusId, openerRef]);

  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });

  // Listens on the window, ahead of the page: a tap can leave focus on the page behind the sheet,
  // and Escape and Tab must still reach the sheet, not a drawer under it.
  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        close.current();
        return;
      }
      if (event.key !== "Tab") return;
      const items = Array.from(panel.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []).filter(
        (element) => element.getClientRects().length > 0,
      );
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;
      const active = document.activeElement;
      if (!(active instanceof Node) || !panel.current?.contains(active)) {
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
    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", onKeyDown, { capture: true });
  }, [open]);

  return (
    <>
      <div
        aria-hidden
        data-sheet-scrim=""
        data-open={open}
        onClick={onClose}
        className={cn(
          "fixed inset-0 z-50 touch-none bg-black/30 transition-opacity duration-300",
          open ? "opacity-100" : "pointer-events-none opacity-0",
          scrimClassName,
        )}
      />
      {behind}
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        aria-labelledby={labelledBy}
        inert={!open}
        data-open={open}
        data-sheet=""
        style={{ ...style, "--sheet-origin": origin } as CSSProperties}
        className={cn(
          "sheet glass-strong fixed z-50 flex flex-col overflow-hidden rounded-sheet border shadow-[0_22px_54px_-18px_rgb(0_0_0/0.6)]",
          className,
        )}
      >
        {children}
      </div>
    </>
  );
}
