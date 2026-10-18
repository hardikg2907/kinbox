import { X } from "lucide-react";

// The drawer's Close button and handle, as they look. The buttons and the copies the poster's window
// carries through a view transition share these, so the two always match.
const LIFT = "translate-y-[calc(env(safe-area-inset-top)*var(--p,0))]";
export const CLOSE_LOOK = `glass-strong absolute top-3 left-3 grid size-11 ${LIFT} place-items-center rounded-full border text-foreground`;
export const HANDLE_LOOK = `absolute top-0 left-1/2 flex h-11 w-30 -translate-x-1/2 ${LIFT} justify-center pt-2.5 lg:hidden`;
export const HANDLE_BAR = "h-1.5 w-10 rounded-full bg-white/90 shadow-[0_1px_6px_rgb(0_0_0/0.45)]";

export function CloseIcon() {
  return <X aria-hidden className="size-5" />;
}

/**
 * Pictures of the Close button and the handle, drawn inside the poster's window. A view transition
 * lifts the poster above the drawer, over the real buttons; globals.css shows these only then, so
 * the buttons stay in sight while the poster lands.
 */
export function DrawerChromeCopy() {
  return (
    <div aria-hidden data-chrome-copy>
      <span className={CLOSE_LOOK}>
        <CloseIcon />
      </span>
      <span className={HANDLE_LOOK}>
        <span className={HANDLE_BAR} />
      </span>
    </div>
  );
}
