// The wall layout is a per-device view setting. It lives in a cookie (like the time zone), so the
// server renders the right grid, and the static shell's skeleton can match it before the data arrives.
export const LAYOUT_COOKIE = "kb_layout";

export const LAYOUTS = ["auto", "2", "3", "4", "list"] as const;
export type Layout = (typeof LAYOUTS)[number];

/** The cookie is user input: anything outside the allow-list means the default. */
export function parseLayout(value: string | undefined): Layout {
  return LAYOUTS.find((layout) => layout === value) ?? "auto";
}

const COOKIE_PATTERN = new RegExp(`(?:^|; )${LAYOUT_COOKIE}=([^;]*)`);

export function readLayoutCookie(cookie: string): Layout {
  return parseLayout(COOKIE_PATTERN.exec(cookie)?.[1]);
}

export function writeLayoutCookie(layout: Layout): void {
  const secure = location.protocol === "https:" ? "; secure" : "";
  document.cookie = `${LAYOUT_COOKIE}=${layout}; path=/; max-age=31536000; samesite=lax${secure}`;
}

// The wall and its skeleton share these classes, so the skeleton's boxes sit exactly where the cards land.
export const WALL_CLASS =
  "grid touch-pan-y pr-[max(0.5rem,env(safe-area-inset-right))] pb-[calc(env(safe-area-inset-bottom)+8.5rem)] pl-[max(0.5rem,env(safe-area-inset-left))] lg:px-3 lg:pb-8";

// Every layout gives the same cards a new place, so only the grid's own classes change.
// "4" is three on a phone, which a phone-only 4 would otherwise make too narrow. The default is the
// "2", "3" and "4" layouts in turn as the screen widens.
export const GRID: Record<Layout, string> = {
  auto: "grid-cols-2 gap-x-2 gap-y-5 sm:grid-cols-3 sm:gap-x-1.5 sm:gap-y-4 lg:grid-cols-4 lg:gap-x-1 lg:gap-y-3.5",
  "2": "grid-cols-2 gap-x-2 gap-y-5",
  "3": "grid-cols-3 gap-x-1.5 gap-y-4",
  "4": "grid-cols-3 gap-x-1.5 gap-y-4 sm:grid-cols-4 sm:gap-x-1 sm:gap-y-3.5",
  list: "grid-cols-1 gap-0 px-4",
};

// The Watching tab's lead tile: a 4:3 crop, tall enough that faces clear the text at its foot. A phone
// gives it the whole row, at most about 40 % of the screen. A desktop gives it two columns and
// stretches it to the height of the row beside it, so it reads as a big tile among the others.
export const LEAD_BOX =
  "col-span-full aspect-[4/3] max-h-[40svh] w-full rounded-card lg:col-span-2 lg:max-h-none lg:self-stretch";
