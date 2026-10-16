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
export default function EntryPage({ params }: PageProps<"/entry/[id]">) {
  return (
    <div id="entry-page" className="relative isolate overflow-x-clip">
      <div className="mx-auto w-full max-w-[72rem] px-4 pb-[max(3rem,env(safe-area-inset-bottom))] sm:px-6">
        <Link
          id="entry-back-link"
          href="/"
          className="-ml-2 mb-2 inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <ChevronLeft aria-hidden className="size-4" />
          Library
        </Link>
        <Suspense fallback={<EntrySkeleton />}>
          <EntryContent params={params} />
        </Suspense>
      </div>
    </div>
  );
}

async function EntryContent({ params }: { params: PageProps<"/entry/[id]">["params"] }) {
  const { id } = await params;
  const entry = await getEntry(id);
  if (!entry) notFound();
  return <EntryScreen entry={entry} />;
}
