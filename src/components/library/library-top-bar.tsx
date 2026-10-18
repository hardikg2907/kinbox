import Link from "next/link";
import { GUTTER } from "@/components/gutter";
import { AccountMenu } from "@/components/library/account-menu";
import { cn } from "cn";

// Scrolls away with the wall. On desktop the sidebar carries the wordmark, so only the account button
// stays, floating over the wall's top right corner.
export function LibraryTopBar() {
  return (
    <header className="relative z-30 pt-[env(safe-area-inset-top)] lg:absolute lg:inset-x-0 lg:top-0 lg:pt-0 lg:pointer-events-none">
      <div className={cn(GUTTER, "flex h-14 items-center justify-between lg:h-auto lg:justify-end lg:pt-3")}>
        <Link
          id="home-link"
          href="/"
          className="-mx-2 inline-flex min-h-11 items-center rounded-full px-2 font-display text-3xl text-foreground focus-visible:ring-3 focus-visible:ring-ring focus-visible:outline-none lg:hidden"
        >
          Kinbox
        </Link>
        <div className="lg:pointer-events-auto">
          <AccountMenu />
        </div>
      </div>
    </header>
  );
}
