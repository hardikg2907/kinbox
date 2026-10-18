"use client";

import { useEffect, useRef, type CSSProperties, type KeyboardEvent, type ReactNode, type RefObject } from "react";
import { cn } from "cn";

type Props = {
  open: boolean;
  onClose: () => void;
  /** Accessible name of the dialog. */
  label: string;
  /** Where focus goes on close: the control that opened the sheet. */
  openerRef: RefObject<HTMLElement | null>;
  /** The element that takes focus on open; the first control when omitted. */
  initialFocusId?: string;
  /** Where the sheet grows from, as a CSS transform-origin. */
  origin: string;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
};

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// A glass sheet over a dimmed page. It stays mounted so its state and its grow/shrink motion survive;
// `inert` keeps it out of the tab order and the accessibility tree while closed.
export function Sheet({ open, onClose, label, openerRef, initialFocusId, origin, className, style, children }: Props) {
  const panel = useRef<HTMLDivElement>(null);
  const wasOpen = useRef(false);

  useEffect(() => {
    if (open) {
      wasOpen.current = true;
      const target = initialFocusId ? document.getElementById(initialFocusId) : null;
      (target ?? panel.current?.querySelector<HTMLElement>(FOCUSABLE))?.focus({ preventScroll: true });
    } else if (wasOpen.current) {
      wasOpen.current = false;
      openerRef.current?.focus({ preventScroll: true });
    }
  }, [open, initialFocusId, openerRef]);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== "Tab") return;
    const items = Array.from(panel.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []).filter(
      (element) => element.getClientRects().length > 0,
    );
    const first = items[0];
    const last = items[items.length - 1];
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <>
      <div
        aria-hidden
        onClick={onClose}
        className={cn(
          "fixed inset-0 z-50 touch-none bg-black/30 transition-opacity duration-300",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        inert={!open}
        data-open={open}
        onKeyDown={onKeyDown}
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
