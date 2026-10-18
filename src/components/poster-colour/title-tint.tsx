"use client";

import { useLayoutEffect, useRef } from "react";
import { cachedPalette, readPalette, type PosterPalette } from "./palette";

// How much of the poster's calm colour the page takes on, per scheme.
const MIX_DARK = "44%";
const MIX_LIGHT = "42%";
const NAMES = ["--tint-dark", "--tint-light", "--bloom", "--tint-mix-dark", "--tint-mix-light"];

function paint(container: HTMLElement, palette: PosterPalette, fade: boolean) {
  // Without a fade the transition is held off while the values change, and the colour is simply there.
  if (!fade) container.style.setProperty("transition", "none");
  container.style.setProperty("--tint-dark", palette.calmDark);
  container.style.setProperty("--tint-light", palette.calmLight);
  container.style.setProperty("--bloom", palette.vivid);
  container.style.setProperty("--tint-mix-dark", MIX_DARK);
  container.style.setProperty("--tint-mix-light", MIX_LIGHT);
  if (!fade) {
    getComputedStyle(container).getPropertyValue("--tint-amount");
    container.style.removeProperty("transition");
  }
}

// Gives the Title's container (the drawer's panel or the page) the poster's colours. The container
// paints the tinted page colour, so the body, the scrim and the panel all agree. A colour read
// earlier (the tap on a tile starts the read) is there from the container's first frame; one that
// arrives while the drawer rises lands at once, and only a later one fades in. Until the colours
// are read, or when they cannot be, the page colour shows.
export function TitleTint({ posterPath }: { posterPath: string | null }) {
  const marker = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const container = marker.current?.closest<HTMLElement>(".title-tint");
    if (!container) return;
    let current = true;
    const ready = cachedPalette(posterPath);
    if (ready) {
      paint(container, ready, false);
    } else if (ready === undefined) {
      readPalette(posterPath).then((palette) => {
        if (current && palette) paint(container, palette, !container.hasAttribute("data-rising"));
      });
    }
    return () => {
      current = false;
      for (const name of NAMES) container.style.removeProperty(name);
    };
  }, [posterPath]);

  return <span ref={marker} hidden />;
}
