// Whether this device's screen is wide enough for the desktop sidebar (Tailwind's `lg`). Kept in a
// cookie, like the time zone, so the server can leave out what a phone never shows.
export const WIDE_COOKIE = "kb_wide";
export const WIDE_QUERY = "(min-width: 1024px)";

/** The cookie is user input: "1" or "0", and anything else means not known. */
export function parseWide(value: string | undefined): boolean | null {
  if (value === "1") return true;
  if (value === "0") return false;
  return null;
}
