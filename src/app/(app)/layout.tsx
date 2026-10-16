import Link from "next/link";
import { AccountMenu } from "@/components/library/account-menu";

// The shell never reads the session: each screen reads its own data inside a
// Suspense boundary, so this frame paints from the static shell.
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col pr-[max(1rem,env(safe-area-inset-right))] pl-[max(1rem,env(safe-area-inset-left))] sm:pr-[max(1.5rem,env(safe-area-inset-right))] sm:pl-[max(1.5rem,env(safe-area-inset-left))]">
      <header className="pt-[env(safe-area-inset-top)]">
        <div className="flex h-14 items-center justify-between">
          <Link
            id="home-link"
            href="/"
            className="-mx-2 inline-flex min-h-11 items-center rounded-lg px-2 font-display text-3xl text-foreground focus-visible:ring-3 focus-visible:ring-ring focus-visible:outline-none"
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
