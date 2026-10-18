import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { EntryScreen } from "@/components/entry/entry-screen";
import { EntrySkeleton } from "@/components/entry/entry-skeleton";
import { TitlePage } from "@/components/entry/title-page";
import { LibraryNav } from "@/components/library/library-nav";
import { LibrarySearch } from "@/components/search/library-search";
import { getEntry } from "@/data/entries";
import { getLibrary } from "@/data/library";

// getEntry is cached per request, so the page body and the sidebar reuse this lookup.
export async function generateMetadata({ params }: PageProps<"/entry/[id]">): Promise<Metadata> {
  const { id } = await params;
  const entry = await getEntry(id);
  return { title: entry ? entry.title.name : "Not found" };
}

// The shell (close button and skeleton) is static; everything per Owner streams in behind it.
export default function EntryPage({ params }: PageProps<"/entry/[id]">) {
  return (
    <LibrarySearch>
      {/* Desktop only: the Library's sidebar, so the page opens in the content area beside it. */}
      <div className="hidden lg:contents">
        <Suspense fallback={<SidebarFrame />}>
          <Sidebar params={params} />
        </Suspense>
      </div>
      <TitlePage>
        <Suspense fallback={<EntrySkeleton />}>
          <EntryContent params={params} />
        </Suspense>
      </TitlePage>
    </LibrarySearch>
  );
}

async function EntryContent({ params }: { params: PageProps<"/entry/[id]">["params"] }) {
  const { id } = await params;
  const entry = await getEntry(id);
  if (!entry) notFound();
  return <EntryScreen entry={entry} container="page" />;
}

// The tab that holds this Title is the current one, so the sidebar says where the Title lives.
async function Sidebar({ params }: { params: PageProps<"/entry/[id]">["params"] }) {
  const { id } = await params;
  const entry = await getEntry(id);
  if (!entry) return <SidebarFrame />;
  const view = await getLibrary({ tab: entry.status, kind: "all" });
  return <LibraryNav tab={entry.status} kind="all" counts={view.counts} />;
}

function SidebarFrame() {
  return <div aria-hidden className="glass-strong fixed top-3 bottom-3 left-3 z-40 w-74 rounded-sheet border" />;
}
