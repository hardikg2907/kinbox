"use client";

import { useState } from "react";
import { TitleSkeleton } from "./entry-skeleton";
import { openedTile } from "./opened-tile";
import { TitleHero } from "./title-hero";

// The tapped tile's poster is already loaded, so the strip shows it in the drawer's first frame and
// the poster morphs from its tile while the rest of the Title loads.
export function DrawerSkeleton() {
  const [tile] = useState(openedTile);
  return (
    <TitleSkeleton
      container="drawer"
      hero={
        tile ? (
          <TitleHero entryId={tile.entryId} low={tile.poster} high={null} alt="" container="drawer" />
        ) : undefined
      }
    />
  );
}
