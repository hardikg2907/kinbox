import Link from "next/link";
import { GUTTER } from "@/components/gutter";
import { AccountMenu } from "@/components/library/account-menu";
import { LayoutToggle } from "@/components/library/layout-toggle";
import { cn } from "cn";

// Scrolls away with the wall. On desktop the sidebar carries the wordmark, so the row holds only the
// buttons, at the wall's right edge and level with the sidebar's top. Once the Library has loaded, a
// desktop copy of the buttons takes their place after the sidebar (DesktopTopButtons), so Tab reaches
// the sidebar first.
const TOP_BUTTONS = "flex items-center gap-4";

export function LibraryTopBar() {
  return (
    <header className="relative z-30 pt-[env(safe-area-inset-top)]">
      <div className={cn(GUTTER, "flex h-14 items-center justify-between lg:h-auto lg:max-w-none lg:justify-end lg:pt-3 lg:pr-3")}>
        <Link
          id="home-link"
          href="/"
          className="-mx-2 inline-flex min-h-11 items-center rounded-full px-2 font-display text-3xl text-foreground focus-visible:ring-3 focus-visible:ring-ring focus-visible:outline-none lg:hidden"
        >
          Kinbox
        </Link>
        <div id="top-buttons" className={TOP_BUTTONS}>
          <LayoutToggle />
          <AccountMenu />
        </div>
      </div>
    </header>
  );
}

// The same buttons on the same spot, placed in the page after the sidebar.
export function DesktopTopButtons() {
  return (
    <div id="desk-top-buttons" className={cn(TOP_BUTTONS, "absolute top-3 right-3 z-30 hidden lg:flex")}>
      <LayoutToggle idPrefix="desk-layout" />
      <AccountMenu id="desk-account-menu-trigger" />
    </div>
  );
}
