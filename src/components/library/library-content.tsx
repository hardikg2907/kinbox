import { X } from "lucide-react";
import Link from "next/link";
import { cookies } from "next/headers";
import { ViewTransition } from "react";
import { getLibrary } from "@/data/library";
import { LibraryMoves, LibraryWall } from "@/components/library/library-moves";
import { LibraryNav } from "@/components/library/library-nav";
import { LAYOUT_COOKIE, parseLayout } from "@/components/library/layout";
import { libraryHref, parseKind, parseTab } from "@/components/library/params";
import { LayoutProvider } from "@/components/library/wall-layout";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const KIND_CHIP = { movie: "Movies", series: "Series" } as const;

// Awaits the URL and the Owner's data, so the caller wraps it in Suspense.
export async function LibraryContent({ searchParams }: Props) {
  const params = await searchParams;
  const tab = parseTab(params.tab);
  const kind = parseKind(params.kind);
  const [view, jar] = await Promise.all([getLibrary({ tab, kind }), cookies()]);
  const layout = parseLayout(jar.get(LAYOUT_COOKIE)?.value);

  return (
    <LayoutProvider initial={layout}>
      <LibraryMoves tab={tab} cards={view.cards} counts={view.counts}>
        <LibraryNav tab={tab} kind={kind} counts={view.counts} />
        {kind !== "all" ? (
          <div id="library-chips" className="flex gap-2 px-2 pb-3 lg:px-3 lg:pt-3">
            <span className="glass-strong inline-flex min-h-11 items-center rounded-full border pl-4 text-sm font-semibold">
              {KIND_CHIP[kind]}
              <Link
                id="chip-remove-kind"
                href={libraryHref(tab, "all")}
                scroll={false}
                aria-label={`Remove ${KIND_CHIP[kind]} filter`}
                className="flex size-11 items-center justify-center rounded-full text-muted-foreground hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring focus-visible:outline-none"
              >
                <X aria-hidden className="size-4" />
              </Link>
            </span>
          </div>
        ) : null}
        {/* Tabs crossfade in place: same page, different content. */}
        <ViewTransition key={`${tab}-${kind}`} name="library-grid" share="auto" enter="auto" default="none">
          <LibraryWall kind={kind} className={kind === "all" ? "lg:pt-3" : undefined} />
        </ViewTransition>
      </LibraryMoves>
    </LayoutProvider>
  );
}
