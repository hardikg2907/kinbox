import { useCallback, useEffect, useRef } from "react";

const RATING_SAVE_DELAY_MS = 400;

type Waiting = { release: (send: boolean) => void };

// Every arrow key on the stars changes the Rating. The screen shows each step at once,
// but only the last one within the delay should reach the server. The returned function
// resolves true for the newest call and false for any call a newer one replaced.
// Leaving the screen, or the page going to the background, releases the waiting call as
// true, so the last choice is not lost.
export function useRatingSaveDelay(): () => Promise<boolean> {
  const waiting = useRef<Waiting | null>(null);

  useEffect(() => {
    // Locking the phone or switching apps can suspend the page before the timer fires.
    const flushWhenHidden = () => {
      if (document.visibilityState === "hidden") waiting.current?.release(true);
    };
    document.addEventListener("visibilitychange", flushWhenHidden);
    return () => {
      document.removeEventListener("visibilitychange", flushWhenHidden);
      waiting.current?.release(true);
    };
  }, []);

  return useCallback(
    () =>
      new Promise<boolean>((resolve) => {
        waiting.current?.release(false);
        const timer = setTimeout(() => release(true), RATING_SAVE_DELAY_MS);
        const release = (send: boolean) => {
          clearTimeout(timer);
          if (waiting.current === entry) waiting.current = null;
          resolve(send);
        };
        const entry: Waiting = { release };
        waiting.current = entry;
      }),
    [],
  );
}
