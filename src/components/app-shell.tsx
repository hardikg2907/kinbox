import Link from "next/link";
import type { ReactNode } from "react";
import { GUTTER } from "@/components/gutter";
import { AccountMenu } from "@/components/library/account-menu";
import { cn } from "cn";

// The shell never reads the session: each screen reads its own data inside a
// Suspense boundary, so this frame paints from the static shell. The header is not
// sticky: it sits above the Library's own bar and, on an Entry page, over the hero poster.
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh w-full flex-col">
      <header className="relative z-30 pt-[env(safe-area-inset-top)]">
        <div className={cn(GUTTER, "flex h-14 items-center justify-between")}>
          <Link
            id="home-link"
            href="/"
            className="-mx-2 inline-flex min-h-11 items-center rounded-full px-2 font-display text-3xl text-foreground focus-visible:ring-3 focus-visible:ring-ring focus-visible:outline-none"
          >
            Kinbox
          </Link>
          <AccountMenu />
        </div>
      </header>
      <main id="main" className="flex-1 pb-[max(2rem,env(safe-area-inset-bottom))]">
        {children}
      </main>
    </div>
  );
}
