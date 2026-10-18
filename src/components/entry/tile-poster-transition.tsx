"use client";

import { usePathname } from "next/navigation";
import { ViewTransition, type ReactNode } from "react";

// A Library tile's poster shares its name with the Title's hero, so the poster morphs between them.
// While this Title's drawer is open over the Library the drawer holds the name: two posters mounted
// with one name would make every view transition fail.
export function TilePosterTransition({ entryId, children }: { entryId: string; children: ReactNode }) {
  const drawerOpen = usePathname() === `/entry/${entryId}`;
  if (drawerOpen) return children;
  return (
    <ViewTransition name={`poster-${entryId}`} share="poster-morph" default="none">
      {children}
    </ViewTransition>
  );
}
