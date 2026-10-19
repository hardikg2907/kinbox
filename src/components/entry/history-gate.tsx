"use client";

// The browser's Back moves the address before any script runs, and the router answers the popstate
// in that same task. A drawer that wants to leave first must hear the event before the router does.
// Listeners on the window run in the order they were added, so this one is added as this module
// loads with the root layout, ahead of the router's own, which it adds once the app has mounted.

type Hold = (event: PopStateEvent) => boolean;

let hold: Hold | null = null;

/** While set, `next` sees each Back or Forward first; returning true keeps that move from the router. */
export function holdHistoryMoves(next: Hold | null): void {
  hold = next;
}

if (typeof window !== "undefined") {
  window.addEventListener("popstate", (event) => {
    if (hold?.(event)) event.stopImmediatePropagation();
  });
}

/** Renders nothing: the root layout renders it so this module loads with the app. */
export function HistoryGate() {
  return null;
}
