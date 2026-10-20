"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState, ViewTransition, type ReactNode } from "react";
import { useWallLayout } from "@/components/library/wall-layout";

// A copy of a Library tile's poster, laid over it, shares its name with the Title's hero, so the
// poster morphs between them. While this Title's drawer is open the drawer holds the name, so the
// copy unmounts: React lets go of a name only when its <ViewTransition> unmounts, and two mounted
// with one name make view transitions fail. The tile's own poster underneath never remounts, and
// the copy shows the same pixels with no background of its own, so neither change can be seen. A
// List row's small thumbnail would only blur on its way into the strip, so a row never morphs: its
// drawer just rises.
//
// The copy arrives one step after its card. A card that changes shape (a grid tile that becomes the
// lead tile, or back) is a new card in a new place; with its copy there at once, React would morph
// the old poster's crop into the new one instead of letting the wall cross-fade it.
export function TilePosterTransition({ entryId, children }: { entryId: string; children: ReactNode }) {
  const drawerOpen = usePathname() === `/entry/${entryId}`;
  const layout = useWallLayout();
  const [placed, setPlaced] = useState(false);
  useEffect(() => {
    let mounted = true;
    queueMicrotask(() => {
      if (mounted) setPlaced(true);
    });
    return () => {
      mounted = false;
    };
  }, []);
  if (!placed || drawerOpen || layout === "list") return null;
  return (
    <ViewTransition name={`poster-${entryId}`} share="poster-morph" default="none">
      <div data-poster-copy aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
        {children}
      </div>
    </ViewTransition>
  );
}
