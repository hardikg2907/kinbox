"use client";

import { useEffect } from "react";
import { readPalette } from "@/components/poster-colour/palette";
import { STATUSES, type Status, type TitleKind } from "@/domain/types";
import { isPosterPath } from "@/lib/tmdb/images";
import { watchInput } from "./quiet-focus";

const ENTRY_LINK = /^\/entry\/([0-9a-f-]{36})$/i;
const TMDB_IMAGES = "https://image.tmdb.org/t/p/";
/** How long a tap stays the drawer's source, in ms; a slow network can take a while to commit. */
const FRESH_MS = 4000;
const MAX_TEXT = 300;
// Anchored and without nested quantifiers, so it stays linear on any input.
const EPISODE_LABEL = /^(?:S\d{1,4} E\d{1,5}|Special \d{1,5})$/;

/** The Next line a watching Series' card shows, in the states the Title's Next block also has. */
export type TileNext =
  | { state: "next"; label: string; name: string | null }
  | { state: "caught-up" | "all-watched" | "all-aired" };

/** What the tapped card already shows about its Title. */
export type TileFacts = { name: string; kind: TitleKind; status: Status; next: TileNext | null };

export type OpenedTile = {
  entryId: string;
  /** The image the tile shows, already decoded. */
  poster: string | null;
  posterPath: string | null;
  /** Null when the link was not on a Library card. */
  facts: TileFacts | null;
};

let lastOpened: { tile: OpenedTile; at: number } | null = null;

/**
 * The tile tapped to open the drawer, so the drawer's first frame can show that poster and what the
 * card says (name, status, Next) while the rest of the Title loads, and the poster can morph into it.
 * The drawer's address arrives with the server's answer; the tap is known at once.
 */
export function openedTile(): OpenedTile | null {
  if (!lastOpened || performance.now() - lastOpened.at > FRESH_MS) return null;
  return lastOpened.tile;
}

function text(value: string | undefined): string | null {
  return value && value.length <= MAX_TEXT ? value : null;
}

// The card's data attributes are page markup, so each one is checked before it is shown.
function readNext(data: DOMStringMap): TileNext | null {
  switch (data.next) {
    case "next": {
      const label = data.nextLabel && EPISODE_LABEL.test(data.nextLabel) ? data.nextLabel : null;
      return label ? { state: "next", label, name: text(data.nextName) } : null;
    }
    case "caught-up":
    case "all-watched":
    case "all-aired":
      return { state: data.next };
    default:
      return null;
  }
}

function readFacts(card: HTMLElement | null): TileFacts | null {
  if (!card) return null;
  const data = card.dataset;
  const name = text(data.name);
  const kind = data.kind === "movie" || data.kind === "series" ? data.kind : null;
  const status = STATUSES.find((value) => value === data.status) ?? null;
  if (!name || !kind || !status) return null;
  return { name, kind, status, next: readNext(data) };
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
  const item = link.closest("li");
  const image = item?.querySelector("img");
  const source = image?.currentSrc || image?.src || null;
  const card = item?.id === `card-${entryId}` ? item : null;
  const path = card?.dataset.posterPath;
  const posterPath = path && isPosterPath(path) ? path : null;
  // Read while the drawer's address loads, so the drawer can open already in the poster's colour.
  void readPalette(posterPath);
  lastOpened = {
    tile: {
      entryId,
      poster: source && source.startsWith(TMDB_IMAGES) ? source : null,
      posterPath,
      facts: readFacts(card),
    },
    at: performance.now(),
  };
}

function forget() {
  lastOpened = null;
}

/** Listens for taps on Title links in the Library; renders nothing. */
export function RememberOpenedTile() {
  useEffect(() => {
    // The drawer's code may load after the key or tap that opens it, so the input is noted from here.
    watchInput();
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
