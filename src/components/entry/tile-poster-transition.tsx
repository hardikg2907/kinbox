"use client";

import { usePathname } from "next/navigation";
import { ViewTransition, type ReactNode } from "react";

// A Library tile's poster shares its name with the Title's hero, so the poster morphs between them.
// While this Title's drawer is open over the Library the drawer holds the name: two posters mounted
// with one name would make every view transition fail. The wrapper stays mounted either way, so the
// poster is not remounted; without a name React gives it an automatic one of its own.
export function TilePosterTransition({ entryId, children }: { entryId: string; children: ReactNode }) {
  const drawerOpen = usePathname() === `/entry/${entryId}`;
  return (
    <ViewTransition name={drawerOpen ? undefined : `poster-${entryId}`} share="poster-morph" default="none">
      {children}
    </ViewTransition>
  );
}
