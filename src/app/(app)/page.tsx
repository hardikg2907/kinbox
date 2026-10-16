import type { Metadata } from "next";
import { Suspense } from "react";
import { LibraryContent } from "@/components/library/library-content";
import { LibrarySkeleton } from "@/components/library/library-skeleton";
import { LibrarySearch } from "@/components/search/library-search";

export const metadata: Metadata = { title: "Library" };

export default function LibraryPage({ searchParams }: PageProps<"/">) {
  return (
    <>
      <h1 className="sr-only">Library</h1>
      {/* The field paints with the static shell; the Library streams in under it and results can replace it. */}
      <LibrarySearch>
        <Suspense fallback={<LibrarySkeleton />}>
          <LibraryContent searchParams={searchParams} />
        </Suspense>
      </LibrarySearch>
    </>
  );
}
