import type { Metadata } from "next";
import { Suspense } from "react";
import { DrawerSkeleton } from "@/components/entry/drawer-skeleton";
import { EntryScreen } from "@/components/entry/entry-screen";
import { TitleDrawer } from "@/components/entry/title-drawer";
import { getEntry } from "@/data/entries";

// getEntry is cached per request, so the drawer's body reuses this lookup.
export async function generateMetadata({ params }: PageProps<"/entry/[id]">): Promise<Metadata> {
  const { id } = await params;
  const entry = await getEntry(id);
  return { title: entry ? entry.title.name : "Not found" };
}

// A Title tapped in the Library opens here, over the wall. The drawer and its skeleton paint at
// once; the Owner's data streams in behind them.
export default function TitleDrawerPage({ params }: PageProps<"/entry/[id]">) {
  return (
    <TitleDrawer>
      <Suspense fallback={<DrawerSkeleton />}>
        <DrawerContent params={params} />
      </Suspense>
    </TitleDrawer>
  );
}

async function DrawerContent({ params }: { params: PageProps<"/entry/[id]">["params"] }) {
  const { id } = await params;
  const entry = await getEntry(id);
  if (!entry) {
    return (
      <div className="flex flex-col gap-3 px-5 pt-20 pb-10">
        <h2 id={`title-name-${id}`} data-title-name className="font-display text-3xl">
          Not in your library
        </h2>
        <p className="text-base text-muted-foreground">
          We couldn&apos;t find that title in your library. It may have been removed.
        </p>
      </div>
    );
  }
  return <EntryScreen entry={entry} container="drawer" />;
}
