import { X } from "lucide-react";

// The drawer's Close button and handle, as they look.
const LIFT = "translate-y-[calc(env(safe-area-inset-top)*var(--p,0))]";
export const CLOSE_LOOK = `glass-strong absolute top-3 left-3 grid size-11 ${LIFT} place-items-center rounded-full border text-foreground`;
export const HANDLE_LOOK = `absolute top-0 left-1/2 flex h-11 w-30 -translate-x-1/2 ${LIFT} justify-center pt-2.5 lg:hidden`;
export const HANDLE_BAR = "h-1.5 w-10 rounded-full bg-white/90 shadow-[0_1px_6px_rgb(0_0_0/0.45)]";

export function CloseIcon() {
  return <X aria-hidden className="size-5" />;
}
