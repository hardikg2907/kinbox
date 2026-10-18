"use client";

import { useEffect, useId, useRef, useState } from "react";
import { cn } from "cn";
import { Skeleton } from "@/components/ui/skeleton";

const TEXT = "text-base leading-relaxed";
const MORE_ROW = "mt-1 h-6";

// A few lines, then "More". Whether the text is cut off is measured, and the
// button's row is always reserved, so the page does not jump when it shows. Two lines are the
// drawer's quick view, which keeps both lines' height so its size never depends on the text.
export function Overview({ text, lines = 3 }: { text: string; lines?: 2 | 3 }) {
  const id = useId();
  const paragraph = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [clipped, setClipped] = useState(false);

  useEffect(() => {
    const element = paragraph.current;
    if (!element) return;
    const measure = () => {
      if (!expanded) setClipped(element.scrollHeight > element.clientHeight + 1);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [expanded, text]);

  return (
    <div id="entry-overview">
      <p
        id={id}
        ref={paragraph}
        className={cn(TEXT, "text-foreground/90", !expanded && (lines === 2 ? "line-clamp-2 min-h-[2lh]" : "line-clamp-3"))}
      >
        {text}
      </p>
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={id}
        onClick={() => setExpanded((value) => !value)}
        className={cn(
          MORE_ROW,
          "relative flex cursor-pointer items-center rounded-full px-1 text-sm font-semibold text-foreground underline underline-offset-4 after:absolute after:-inset-x-2 after:-inset-y-2.5 after:content-[''] hover:text-muted-foreground focus-visible:ring-3 focus-visible:ring-ring focus-visible:outline-none",
          !clipped && !expanded && "invisible",
        )}
      >
        {expanded ? "Less" : "More"}
      </button>
    </div>
  );
}

/** Two lines and the "More" row, before the overview has loaded. */
export function OverviewPreview() {
  return (
    <div>
      <div className={cn(TEXT, "flex h-[2lh] flex-col justify-evenly")}>
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
      </div>
      <div className={MORE_ROW} />
    </div>
  );
}
