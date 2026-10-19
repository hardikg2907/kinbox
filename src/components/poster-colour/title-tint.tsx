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

/** How long the page's poster waits for its colour once the poster itself is ready, in ms. */
const COLOUR_WAIT_MS = 700;

// Gives the Title's container (the drawer's panel or the page) the poster's colours. The container
// paints the tinted page colour, so the body, the scrim and the panel all agree. A colour read
// earlier (the tap on a tile starts the read) is there from the container's first frame; one that
// arrives while the drawer rises lands at once, and only a later one fades in. Until the colours
// are read, or when they cannot be, the page colour shows.
//
// The page has no tap to start the read early. There `revealsHero` holds the poster back over the
// hero's muted box until its colour is read too, then fades both in at once (globals.css), so the
// colour never lands on its own after the poster.
export function TitleTint({ posterPath, revealsHero = false }: { posterPath: string | null; revealsHero?: boolean }) {
  const marker = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const container = marker.current?.closest<HTMLElement>(".title-tint");
    if (!container) return;
    let current = true;
    let waited = 0;
    const ready = cachedPalette(posterPath);
    const arrive = () => {
      if (current) container.dataset.arrived = "";
    };
    if (ready) {
      paint(container, ready, false);
    }
    if (revealsHero) {
      const poster = container.querySelector<HTMLImageElement>("[data-hero-low]");
      const posterReady = poster?.complete && poster.naturalWidth > 0 ? null : (poster?.decode() ?? null);
      if (ready !== undefined && posterReady === null) {
        arrive();
      } else {
        const colour = ready !== undefined ? Promise.resolve(ready) : readPalette(posterPath);
        const shown = (posterReady ?? Promise.resolve()).catch(() => undefined);
        // A poster that is ready waits only a moment longer for its colour.
        void shown.then(() => {
          waited = window.setTimeout(arrive, COLOUR_WAIT_MS);
        });
        void Promise.all([colour, shown]).then(([palette]) => {
          if (!current) return;
          window.clearTimeout(waited);
          if (palette && ready === undefined) paint(container, palette, true);
          arrive();
        });
      }
    } else if (ready === undefined) {
      readPalette(posterPath).then((palette) => {
        if (current && palette) paint(container, palette, !container.hasAttribute("data-rising"));
      });
    }
    return () => {
      current = false;
      window.clearTimeout(waited);
      for (const name of NAMES) container.style.removeProperty(name);
      if (revealsHero) delete container.dataset.arrived;
    };
  }, [posterPath, revealsHero]);

  return <span ref={marker} hidden />;
}
