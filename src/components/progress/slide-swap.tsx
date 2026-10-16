"use client";

import { useState, type ReactNode } from "react";
import { cn } from "cn";

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
  const [leaving, setLeaving] = useState<ReactNode>(null);
  const [swapped, setSwapped] = useState(false);

  if (shown.id !== id) {
    setLeaving(shown.node);
    setShown({ id, node: children });
    setSwapped(true);
  }

  return (
    <div className={cn("relative", className)} aria-live="polite" aria-atomic="true">
      {leaving ? (
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 animate-out fade-out-0 slide-out-to-top-2 fill-mode-forwards duration-150 ease-in"
          onAnimationEnd={() => setLeaving(null)}
        >
          {leaving}
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
