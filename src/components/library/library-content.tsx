import { ViewTransition } from "react";
import { getLibrary } from "@/data/library";
import { LibraryEmpty } from "@/components/library/library-empty";
import { LibraryFilters } from "@/components/library/library-filters";
import { LibraryGrid } from "@/components/library/library-grid";
import { parseKind, parseTab } from "@/components/library/params";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

// Awaits the URL and the Owner's data, so the caller wraps it in Suspense.
export async function LibraryContent({ searchParams }: Props) {
  const params = await searchParams;
  const tab = parseTab(params.tab);
  const kind = parseKind(params.kind);
  const view = await getLibrary({ tab, kind });

  return (
    <>
      <LibraryFilters tab={tab} kind={kind} counts={view.counts} />
      {/* Tabs crossfade in place: same page, different content. */}
      <ViewTransition key={`${tab}-${kind}`} name="library-grid" share="auto" enter="auto" default="none">
        <div className="mt-4">
          {view.cards.length > 0 ? <LibraryGrid cards={view.cards} /> : <LibraryEmpty tab={tab} kind={kind} />}
        </div>
      </ViewTransition>
    </>
  );
}
