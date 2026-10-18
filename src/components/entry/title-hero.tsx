"use client";

import { use, useState, ViewTransition } from "react";
import { cn } from "cn";
import { DrawerMotionContext } from "./drawer-motion";
import { TITLE_LAYOUT, type TitleContainer } from "./entry-layout";

type Props = {
  entryId: string;
  /** Already on screen (the tile's w342), so it shows at once. */
  low: string | null;
  /** The sharper poster, faded in over `low` once it has decoded, so nothing flashes. */
  high: string | null;
  /** Empty in the drawer, where the strip is decoration beside the name. */
  alt: string;
  container: TitleContainer;
};

const IMAGE = "absolute inset-0 size-full object-cover object-[50%_12%] [-webkit-user-drag:none]";

export function TitleHero({ entryId, low, high, alt, container }: Props) {
  const drawer = use(DrawerMotionContext);
  const [highState, setHighState] = useState<"waiting" | "fading" | "shown">("waiting");
  const layout = TITLE_LAYOUT[container];

  // Already in the browser's cache (a tile showed it): there before the first paint, no fade.
  function attachHigh(image: HTMLImageElement | null) {
    if (image?.complete && image.naturalWidth > 0) setHighState((state) => (state === "waiting" ? "shown" : state));
  }

  function fadeInHigh(image: HTMLImageElement) {
    const fade = () => setHighState((state) => (state === "waiting" ? "fading" : state));
    image.decode().then(fade, fade);
  }

  // The window is what morphs. In the drawer it is cut to the part of the poster on show, so the
  // poster lands in the strip instead of spreading over the sections below it.
  const media = (
    <div data-title-window className="absolute inset-x-0 top-0 h-full overflow-hidden">
      <div className={layout.media}>
        {low ? (
          // TMDB serves sized posters, so next/image optimisation would only spend quota.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={low} alt={alt} draggable={false} decoding="async" fetchPriority="high" className={IMAGE} />
        ) : (
          <div aria-hidden className="absolute inset-0 bg-muted" />
        )}
        {high ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            ref={attachHigh}
            src={high}
            alt=""
            aria-hidden
            draggable={false}
            decoding="async"
            onLoad={(event) => fadeInHigh(event.currentTarget)}
            className={cn(
              IMAGE,
              highState === "fading" && "transition-opacity duration-500",
              highState === "waiting" ? "opacity-0" : "opacity-100",
            )}
          />
        ) : null}
      </div>
    </div>
  );

  return (
    <header id="entry-header" data-title-hero data-entry-id={entryId} className={layout.hero}>
      {/* The tile and the hero share this name, so the poster morphs between them. A drawer that has
          already slid away drops it, so Back does not fly the poster up from below the screen. */}
      {drawer?.closing ? (
        media
      ) : (
        <ViewTransition name={`poster-${entryId}`} share="poster-morph" default="none">
          {media}
        </ViewTransition>
      )}
      {container === "drawer" ? <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-24 shade-top" /> : null}
    </header>
  );
}
