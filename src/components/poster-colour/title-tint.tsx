"use client";

import { useEffect, useRef } from "react";
import { readPalette } from "./palette";

// How much of the poster's calm colour the page takes on, per scheme.
const MIX_DARK = "44%";
const MIX_LIGHT = "42%";

// Gives the Title's container (the drawer's panel or the page) the poster's colours. The container
// paints the tinted page colour, so the body, the scrim and the panel all agree. Until the colours
// are read, or when they cannot be, the page colour shows.
export function TitleTint({ posterPath }: { posterPath: string | null }) {
  const marker = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const container = marker.current?.closest<HTMLElement>(".title-tint");
    if (!container) return;
    let current = true;
    const names = ["--tint-dark", "--tint-light", "--bloom", "--tint-mix-dark", "--tint-mix-light"];
    readPalette(posterPath).then((palette) => {
      if (!current || !palette) return;
      container.style.setProperty("--tint-dark", palette.calmDark);
      container.style.setProperty("--tint-light", palette.calmLight);
      container.style.setProperty("--bloom", palette.vivid);
      container.style.setProperty("--tint-mix-dark", MIX_DARK);
      container.style.setProperty("--tint-mix-light", MIX_LIGHT);
    });
    return () => {
      current = false;
      for (const name of names) container.style.removeProperty(name);
    };
  }, [posterPath]);

  return <span ref={marker} hidden />;
}
