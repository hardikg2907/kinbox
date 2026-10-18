"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "cn";
import type { TitleContainer } from "./entry-layout";
import { useEntry } from "./entry-state";
import { StatusPill } from "./status-pill";

/** Height of the bar below the top inset; the name counts as gone once it passes under it. */
const BAR_PX = 56;

// Once the name scrolls under it, the name and a compact status pill show in a slim glass bar.
// Inside the drawer, `fixed` resolves against the drawer (it is transformed), so the bar stays at
// the drawer's top edge while its content scrolls. The name repeats the heading, so screen readers
// skip it; the pill is a real control, and the bar is inert while hidden so it is never tabbed to.
export function NameBar({ name, container }: { name: string; container: TitleContainer }) {
  const { entryId } = useEntry();
  const bar = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    // The bar's parent holds this Title's heading; a hidden copy of another Title may share the page.
    const heading = bar.current?.parentElement?.querySelector(`[id="title-name-${CSS.escape(entryId)}"]`);
    if (!heading) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        const barBottom = bar.current?.getBoundingClientRect().bottom ?? BAR_PX;
        setShown(!entry.isIntersecting && entry.boundingClientRect.top < barBottom);
      },
      { rootMargin: `-${BAR_PX}px 0px 0px 0px` },
    );
    observer.observe(heading);
    return () => observer.disconnect();
  }, [entryId]);

  return (
    <div
      ref={bar}
      inert={!shown}
      className={cn(
        "glass-strong fixed inset-x-0 top-0 flex h-[calc(env(safe-area-inset-top)+3.5rem)] items-center gap-3 border-b pt-[env(safe-area-inset-top)] pr-3 pl-16 transition-[opacity,transform] duration-300 ease-(--spring)",
        container === "page" ? "z-20 lg:left-80" : "z-[2] lg:pt-0",
        shown ? "opacity-100" : "pointer-events-none -translate-y-2 opacity-0",
      )}
    >
      <p aria-hidden className="min-w-0 flex-1 truncate text-base font-extrabold">
        {name}
      </p>
      <StatusPill compact />
    </div>
  );
}
