"use client";

// The browser's Back moves the address before any script runs, and the router answers the popstate
// in that same task. A drawer that wants to leave first must hear the event before the router does.
// Listeners on the window run in the order they were added, so this one is added as this module
// loads with the root layout, ahead of the router's own, which it adds once the app has mounted.

type Hold = (event: PopStateEvent) => boolean;

type Gate = { hold: Hold | null };

declare global {
  interface Window {
    kinboxHistoryGate?: Gate;
  }
}

// The gate lives on the window, so a module that runs again (Fast Refresh in development) finds the
// listener added the first time, still ahead of the router's, and adds no second one after it.
function historyGate(): Gate | null {
  if (typeof window === "undefined") return null;
  if (!window.kinboxHistoryGate) {
    const gate: Gate = { hold: null };
    window.kinboxHistoryGate = gate;
    window.addEventListener("popstate", (event) => {
      if (gate.hold?.(event)) event.stopImmediatePropagation();
    });
  }
  return window.kinboxHistoryGate;
}

historyGate();

/** While set, `next` sees each Back or Forward first; returning true keeps that move from the router. */
export function holdHistoryMoves(next: Hold | null): void {
  const gate = historyGate();
  if (gate) gate.hold = next;
}

/** Renders nothing: the root layout renders it so this module loads with the app. */
export function HistoryGate() {
  return null;
}
