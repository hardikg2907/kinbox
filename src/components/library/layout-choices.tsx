"use client";

import { useSyncExternalStore } from "react";
import { cn } from "cn";
import type { Layout } from "@/components/library/layout";
import { useWallLayout } from "@/components/library/wall-layout";

type Option = { value: Layout; label: string };

const PHONE: Option[] = [
  { value: "2", label: "2 columns" },
  { value: "3", label: "3 columns" },
  { value: "list", label: "List" },
];
const DESKTOP: Option[] = [...PHONE.slice(0, 2), { value: "4", label: "4 columns" }, PHONE[2]];

const WIDE_PHONE = "(min-width: 40rem)";

function subscribeWidePhone(onChange: () => void) {
  const query = window.matchMedia(WIDE_PHONE);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

// The saved layout may not exist on this screen (a phone shows "4" as three), and the default grows
// with the screen: two columns, three from 40rem, four on a desktop. So the pressed button is the
// one the wall actually shows.
function shownOn(layout: Layout, desktop: boolean, widePhone: boolean): Layout {
  if (layout === "auto") return desktop ? "4" : widePhone ? "3" : "2";
  if (layout === "4" && !desktop) return "3";
  return layout;
}

export function LayoutChoices({ desktop, idPrefix, className }: { desktop: boolean; idPrefix: string; className?: string }) {
  const { layout, setLayout } = useWallLayout();
  const widePhone = useSyncExternalStore(
    subscribeWidePhone,
    () => window.matchMedia(WIDE_PHONE).matches,
    () => false,
  );
  const shown = shownOn(layout, desktop, widePhone);
  return (
    <ul id={`${idPrefix}-layout`} className={cn("grid gap-2", desktop ? "grid-cols-2" : "grid-cols-3", className)}>
      {(desktop ? DESKTOP : PHONE).map(({ value, label }) => (
        <li key={value}>
          <button
            type="button"
            aria-pressed={shown === value}
            onClick={() => setLayout(value)}
            className={cn(
              "flex min-h-11 w-full cursor-pointer items-center justify-center rounded-full px-2 text-sm font-semibold transition-colors focus-visible:ring-3 focus-visible:ring-ring focus-visible:outline-none",
              shown === value ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground hover:bg-accent",
            )}
          >
            {label}
          </button>
        </li>
      ))}
    </ul>
  );
}
