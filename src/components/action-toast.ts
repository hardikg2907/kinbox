import type { ReactNode } from "react";
import { toast } from "sonner";

/** How long a toast with an action stays up, in milliseconds. */
export const ACTION_TOAST_MS = 8000;

const TICK_MS = 250;

type Options = {
  id: string;
  description?: ReactNode;
  action?: { label: string; onClick: () => void };
};

// The token tells a toast apart from a later one that reuses its id.
const running = new Map<string, { left: number; token: symbol }>();
let ticker: ReturnType<typeof setInterval> | null = null;

// Sonner stops its own timer on hover but not on keyboard focus, and a phone has no hover.
// A toast with a button must wait while the Owner is on it (WCAG 2.2.1), so these toasts
// get no Sonner timer and count down here instead, only while nobody is holding them.
function held(): boolean {
  if (document.hidden) return true;
  for (const toaster of document.querySelectorAll("[data-sonner-toaster]")) {
    if (toaster.matches(":hover") || toaster.contains(document.activeElement)) return true;
  }
  return false;
}

function tick() {
  if (!held()) {
    for (const [id, entry] of running) {
      if (entry.left <= TICK_MS) {
        running.delete(id);
        toast.dismiss(id);
      } else {
        entry.left -= TICK_MS;
      }
    }
  }
  if (running.size === 0 && ticker !== null) {
    clearInterval(ticker);
    ticker = null;
  }
}

/** Shows a toast that stays for `ACTION_TOAST_MS`, paused while hovered or focused. */
export function showActionToast(
  kind: "default" | "success",
  message: ReactNode,
  { id, description, action }: Options,
) {
  const token = Symbol(id);
  running.set(id, { left: ACTION_TOAST_MS, token });
  ticker ??= setInterval(tick, TICK_MS);

  const forget = () => {
    if (running.get(id)?.token === token) running.delete(id);
  };
  const options = {
    id,
    description,
    // Sonner never closes a toast with an infinite duration; `tick` does.
    duration: Infinity,
    onDismiss: forget,
    action: action
      ? {
          label: action.label,
          onClick: () => {
            forget();
            action.onClick();
          },
        }
      : undefined,
  };
  if (kind === "success") toast.success(message, options);
  else toast(message, options);
}
