import { X } from "lucide-react";
import Link from "next/link";
import type { MouseEvent, ReactNode, Ref } from "react";
import { cn } from "cn";
import { Skeleton } from "@/components/ui/skeleton";

// The import page's frame: a slim glass bar on top, the content, and an action bar in the dock's
// shape at the bottom. On desktop all three share one centred column.

/** Side padding, kept clear of a phone's side insets. */
export const SIDES = "pr-[max(1rem,env(safe-area-inset-right))] pl-[max(1rem,env(safe-area-inset-left))]";
export const COLUMN = "mx-auto w-full max-w-[40rem]";
const FLOAT_SHADOW = "shadow-[0_18px_44px_-18px_rgb(0_0_0/0.5)]";
export const FOCUS = "outline-none focus-visible:ring-3 focus-visible:ring-ring";

export const PASTE_LABEL = "Paste your list";
export const PASTE_HELP = "One title per line. Put ✔ after the ones you've watched.";

export function ImportTopBar({ onClose }: { onClose?: (event: MouseEvent<HTMLAnchorElement>) => void }) {
  return (
    <header className={cn("sticky top-0 z-30 pt-[calc(env(safe-area-inset-top)+10px)]", SIDES)}>
      <div className={cn(COLUMN, FLOAT_SHADOW, "glass-strong flex h-13 items-center gap-3 rounded-full border pr-5 pl-1")}>
        <Link
          id="import-close"
          href="/"
          aria-label="Close"
          onClick={onClose}
          className={cn(
            FOCUS,
            "grid size-11 shrink-0 place-items-center rounded-full bg-secondary text-foreground transition-colors hover:bg-accent",
          )}
        >
          <X aria-hidden className="size-5" />
        </Link>
        <h1 className="text-xl font-bold">Import a list</h1>
      </div>
    </header>
  );
}

/** The bottom action bar. Its height is published as --import-bar-height so content and toasts clear it. */
export function ImportActionBar({ children, innerRef }: { children: ReactNode; innerRef?: Ref<HTMLDivElement> }) {
  return (
    <div
      data-import-bar=""
      className={cn(
        "pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+10px)] z-40 transition-opacity duration-200",
        SIDES,
      )}
    >
      <div ref={innerRef} className={cn(COLUMN, FLOAT_SHADOW, "glass-strong pointer-events-auto rounded-sheet border p-2")}>
        {children}
      </div>
    </div>
  );
}

export function ImportContent({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={SIDES}>
      <div
        className={cn(
          COLUMN,
          "pt-6 pb-[calc(var(--import-bar-height,4.5rem)+env(safe-area-inset-bottom)+2.5rem)]",
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}

/** The Paste step's shape with its words in place, shown until the page can read the saved text. */
export function ImportSkeleton() {
  return (
    <main id="main" className="min-h-dvh">
      <ImportTopBar />
      <ImportContent>
        <p className="text-base font-semibold">{PASTE_LABEL}</p>
        <p className="mt-1 text-sm text-muted-foreground">{PASTE_HELP}</p>
        <div aria-hidden className="mt-3 h-[max(16rem,45dvh)] rounded-2xl border border-input bg-glass-strong" />
        <Skeleton className="mt-3 h-5 w-24" />
      </ImportContent>
      <ImportActionBar>
        <div aria-hidden className="flex h-12 items-center justify-center rounded-full bg-primary text-base font-semibold text-primary-foreground opacity-50">
          Check list
        </div>
      </ImportActionBar>
    </main>
  );
}
