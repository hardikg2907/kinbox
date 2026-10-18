"use client";

import { useEffect, useId, useRef, useState } from "react";
import { cn } from "cn";

// A few lines, then "More". Whether the text is cut off is measured, and the
// button's row is always reserved, so the page does not jump when it shows.
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
        className={cn(
          "text-base leading-relaxed text-foreground/90",
          !expanded && (lines === 2 ? "line-clamp-2" : "line-clamp-3"),
        )}
      >
        {text}
      </p>
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={id}
        onClick={() => setExpanded((value) => !value)}
        className={cn(
          "relative mt-1 flex h-6 cursor-pointer items-center rounded-full px-1 text-sm font-semibold text-foreground underline underline-offset-4 after:absolute after:-inset-x-2 after:-inset-y-2.5 after:content-[''] hover:text-muted-foreground focus-visible:ring-3 focus-visible:ring-ring focus-visible:outline-none",
          !clipped && !expanded && "invisible",
        )}
      >
        {expanded ? "Less" : "More"}
      </button>
    </div>
  );
}
