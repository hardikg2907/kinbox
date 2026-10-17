import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { EntryScreen } from "@/components/entry/entry-screen";
import { EntrySkeleton } from "@/components/entry/entry-skeleton";
import { getEntry } from "@/data/entries";

// getEntry is cached per request, so the page body reuses this lookup.
export async function generateMetadata({ params }: PageProps<"/entry/[id]">): Promise<Metadata> {
  const { id } = await params;
  const entry = await getEntry(id);
  return { title: entry ? entry.title.name : "Not found" };
}

// The shell (back link and skeleton) is static; everything per Owner streams in behind it.
// The page pulls itself up under the app header (3.5 rem plus the top inset) so the hero poster
// runs to the top of the screen, and down over the main area's bottom padding so the sheet ends at the edge.
export default function EntryPage({ params }: PageProps<"/entry/[id]">) {
  return (
    <div
      id="entry-page"
      className="relative -mt-[calc(3.5rem+env(safe-area-inset-top))] -mb-[max(2rem,env(safe-area-inset-bottom))] lg:-mb-0"
    >
      <Link
        id="entry-back-link"
        href="/"
        className="glass-strong absolute top-[calc(3.5rem+env(safe-area-inset-top)+0.5rem)] left-[max(1rem,env(safe-area-inset-left))] z-20 inline-flex min-h-11 items-center gap-1 rounded-full border py-2 pr-5 pl-3 text-sm font-medium text-foreground transition-colors hover:bg-secondary focus-visible:ring-3 focus-visible:ring-ring focus-visible:outline-none sm:left-6"
      >
        <ChevronLeft aria-hidden className="size-4" />
        Library
      </Link>
      <Suspense fallback={<EntrySkeleton />}>
        <EntryContent params={params} />
      </Suspense>
    </div>
  );
}

async function EntryContent({ params }: { params: PageProps<"/entry/[id]">["params"] }) {
  const { id } = await params;
  const entry = await getEntry(id);
  if (!entry) notFound();
  return <EntryScreen entry={entry} />;
}
