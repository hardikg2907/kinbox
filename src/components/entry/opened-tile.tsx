"use client";

import { useEffect } from "react";

const ENTRY_LINK = /^\/entry\/([0-9a-f-]{36})$/i;
const TMDB_IMAGES = "https://image.tmdb.org/t/p/";
/** How long a tap stays the drawer's source, in ms; a slow network can take a while to commit. */
const FRESH_MS = 4000;

type OpenedTile = { entryId: string; poster: string | null; at: number };

let lastOpened: OpenedTile | null = null;

/**
 * The tile tapped to open the drawer, so the drawer can show that poster in its first frame and
 * the poster can morph into it. The drawer's address arrives with the server's answer; the tap is
 * known at once.
 */
export function openedTile(): Omit<OpenedTile, "at"> | null {
  if (!lastOpened || performance.now() - lastOpened.at > FRESH_MS) return null;
  return { entryId: lastOpened.entryId, poster: lastOpened.poster };
}

function remember(event: MouseEvent) {
  // These clicks open a new tab or window, not the drawer.
  if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
  const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
  const entryId = link ? ENTRY_LINK.exec(link.pathname)?.[1] : undefined;
  if (!link || !entryId) {
    lastOpened = null;
    return;
  }
  const image = link.closest("li")?.querySelector("img");
  const source = image?.currentSrc || image?.src || null;
  lastOpened = {
    entryId,
    poster: source && source.startsWith(TMDB_IMAGES) ? source : null,
    at: performance.now(),
  };
}

function forget() {
  lastOpened = null;
}

/** Listens for taps on Title links in the Library; renders nothing. */
export function RememberOpenedTile() {
  useEffect(() => {
    document.addEventListener("click", remember, { capture: true });
    // Back and Forward reopen a drawer without a tap, so an older tap must not speak for them.
    window.addEventListener("popstate", forget);
    return () => {
      document.removeEventListener("click", remember, { capture: true });
      window.removeEventListener("popstate", forget);
    };
  }, []);
  return null;
}
