import type { Metadata } from "next";
import { Suspense } from "react";
import { LibraryContent } from "@/components/library/library-content";
import { LibrarySkeleton } from "@/components/library/library-skeleton";
import { LibraryTopBar } from "@/components/library/library-top-bar";
import { LibrarySearch } from "@/components/search/library-search";

export const metadata: Metadata = { title: "Library" };

export default function LibraryPage({ searchParams }: PageProps<"/">) {
  return (
    <>
      <h1 className="sr-only">Library</h1>
      {/* The top bar and the search sheet paint with the static shell; the Library streams in under them. */}
      <LibrarySearch>
        <LibraryTopBar />
        <Suspense fallback={<LibrarySkeleton />}>
          <LibraryContent searchParams={searchParams} />
        </Suspense>
      </LibrarySearch>
    </>
  );
}
