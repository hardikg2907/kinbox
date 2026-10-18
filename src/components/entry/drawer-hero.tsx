"use client";

import { createContext, use, useLayoutEffect } from "react";
import { TitleTint } from "@/components/poster-colour/title-tint";
import { posterUrl } from "@/lib/tmdb/images";
import { TitleHeroSkeleton } from "./entry-skeleton";
import type { OpenedTile } from "./opened-tile";
import { TitleHero } from "./title-hero";

/** The poster the drawer shows: the tapped tile's at first, then the Title's own once it loads. */
export type HeroSource = { entryId: string; posterPath: string | null; low: string | null };

/** "none": the Title is not in the Library, so the drawer shows no poster. */
export type DrawerHeroState = HeroSource | "none" | null;

type DrawerTitle = {
  /** The tapped tile, or null when the drawer opened without a tap (Back, Forward). */
  tile: OpenedTile | null;
  hero: DrawerHeroState;
  show: (entryId: string | null, posterPath: string | null) => void;
};

export const DrawerTitleContext = createContext<DrawerTitle | null>(null);

export function heroFromTile(tile: OpenedTile | null): DrawerHeroState {
  return tile ? { entryId: tile.entryId, posterPath: tile.posterPath, low: tile.poster } : null;
}

// The image already on screen stays while it is the same Title, so nothing reloads when the Title arrives.
export function nextHero(current: DrawerHeroState, entryId: string | null, posterPath: string | null): DrawerHeroState {
  if (entryId === null) return "none";
  const same = current !== null && current !== "none" && current.entryId === entryId;
  if (same && current.posterPath === posterPath) return current;
  return { entryId, posterPath, low: (same && current.low) || posterUrl(posterPath, "w342") };
}

/**
 * The drawer's poster strip and colour. It sits outside the part that waits for the Title, so it is
 * the same element from the drawer's first frame on: the poster morphs into it once, and the Title's
 * arrival neither swaps it nor resets its colour.
 */
export function DrawerHero() {
  const hero = use(DrawerTitleContext)?.hero ?? null;
  if (hero === "none") return null;
  if (hero === null) return <TitleHeroSkeleton container="drawer" />;
  return (
    <>
      <TitleTint posterPath={hero.posterPath} />
      <TitleHero
        // A different Title is a different poster; its shared name must not pass from one to the other.
        key={hero.entryId}
        entryId={hero.entryId}
        low={hero.low}
        high={posterUrl(hero.posterPath, "w500")}
        alt=""
        container="drawer"
      />
    </>
  );
}

/** Tells the drawer which Title it holds, once the Title has loaded. Renders nothing. */
export function ShowInDrawer({ entryId, posterPath }: { entryId: string | null; posterPath: string | null }) {
  const show = use(DrawerTitleContext)?.show;
  // Before paint, so the strip and the sections change in the same frame.
  useLayoutEffect(() => {
    show?.(entryId, posterPath);
  }, [show, entryId, posterPath]);
  return null;
}
