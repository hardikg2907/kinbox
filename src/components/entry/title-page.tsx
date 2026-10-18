import { X } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

// The Title on its own, for a direct link or a reload. The close button and the frame are static;
// the sections stream in as children. From `lg` it fills the content area beside the sidebar.
export function TitlePage({ children }: { children: ReactNode }) {
  return (
    <article
      id="entry-page"
      className="title-tint relative min-h-dvh lg:grid lg:grid-cols-[minmax(22rem,5fr)_minmax(0,7fr)] lg:items-start lg:pl-80"
    >
      <Link
        id="entry-close"
        href="/"
        aria-label="Close"
        className="glass-strong fixed top-[calc(env(safe-area-inset-top)+0.75rem)] left-[max(0.75rem,env(safe-area-inset-left))] z-30 grid size-11 place-items-center rounded-full border text-foreground transition-colors hover:bg-secondary focus-visible:ring-3 focus-visible:ring-ring focus-visible:outline-none lg:left-[calc(20rem+0.75rem)]"
      >
        <X aria-hidden className="size-5" />
      </Link>
      {children}
    </article>
  );
}
