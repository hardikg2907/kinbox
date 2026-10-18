// The wall layout is a per-device view setting. It lives in a cookie (like the time zone), so the
// server renders the right grid on the first paint and nothing shifts on load.
export const LAYOUT_COOKIE = "kb_layout";

export const LAYOUTS = ["auto", "2", "3", "4", "list"] as const;
export type Layout = (typeof LAYOUTS)[number];

/** The cookie is user input: anything outside the allow-list means the default. */
export function parseLayout(value: string | undefined): Layout {
  return LAYOUTS.find((layout) => layout === value) ?? "auto";
}

export function writeLayoutCookie(layout: Layout): void {
  const secure = location.protocol === "https:" ? "; secure" : "";
  document.cookie = `${LAYOUT_COOKIE}=${layout}; path=/; max-age=31536000; samesite=lax${secure}`;
}
