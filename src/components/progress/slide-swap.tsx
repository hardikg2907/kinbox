"use client";

import { useEffect, useState, type ReactNode } from "react";
import { cn } from "cn";

/** The leaving animation's length (`duration-150`), in ms. */
const LEAVE_MS = 150;

type SlideSwapProps = {
  /** Changes when the content is a different thing; the old content slides up and out. */
  id: string;
  children: ReactNode;
  className?: string;
};

// The old content stays mounted just long enough to leave, so the change reads
// as one thing replacing another instead of a flash. Only transform and opacity move.
export function SlideSwap({ id, children, className }: SlideSwapProps) {
  const [shown, setShown] = useState({ id, node: children });
  const [leaving, setLeaving] = useState<{ key: number; node: ReactNode } | null>(null);
  const [swapped, setSwapped] = useState(false);

  if (shown.id !== id) {
    setLeaving({ key: (leaving?.key ?? 0) + 1, node: shown.node });
    setShown({ id, node: children });
    setSwapped(true);
  }

  // A key per swap gives each leaving copy its own animation, and the timer clears it even when
  // animationend never comes; otherwise a hidden copy stays and the next swap skips its exit.
  useEffect(() => {
    if (!leaving) return;
    const timer = window.setTimeout(() => setLeaving(null), LEAVE_MS + 50);
    return () => window.clearTimeout(timer);
  }, [leaving]);

  return (
    <div className={cn("relative", className)} aria-live="polite" aria-atomic="true">
      {leaving ? (
        <div
          key={leaving.key}
          aria-hidden
          className="absolute inset-x-0 top-0 animate-out fade-out-0 slide-out-to-top-2 fill-mode-forwards duration-150 ease-in"
          onAnimationEnd={(event) => {
            if (event.target === event.currentTarget) setLeaving(null);
          }}
        >
          {leaving.node}
        </div>
      ) : null}
      <div
        key={id}
        className={cn(swapped && "animate-in fade-in-0 slide-in-from-bottom-2 duration-200 ease-out")}
      >
        {children}
      </div>
    </div>
  );
}
