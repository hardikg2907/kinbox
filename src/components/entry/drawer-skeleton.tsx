"use client";

import { use } from "react";
import { DrawerTitleContext } from "./drawer-hero";
import { TITLE_LAYOUT } from "./entry-layout";
import { TitleHeadSkeleton, TitleMoreSkeleton } from "./entry-skeleton";
import { TitleHeadPreview } from "./title-sections";

// The drawer's sections while the Title loads. The poster strip above them belongs to the drawer
// itself. A tapped card already shows the name, the Status and the Next line, so those are drawn
// as the real quick view draws them; only what the card does not know waits as a placeholder of
// the same height. Without a tap (Back, Forward) every box is a placeholder of the same shape.
export function DrawerSkeleton() {
  const tile = use(DrawerTitleContext)?.tile ?? null;
  const layout = TITLE_LAYOUT.drawer;
  return (
    <div id="entry-skeleton" data-title-body role="status" aria-label="Loading" className={layout.body}>
      <div aria-hidden className={layout.fade} />
      {tile?.facts ? (
        <TitleHeadPreview entryId={tile.entryId} facts={tile.facts} />
      ) : (
        <TitleHeadSkeleton container="drawer" />
      )}
      <TitleMoreSkeleton />
    </div>
  );
}
