const IMAGE_BASE_URL = "https://image.tmdb.org/t/p/";

// Anchored, single-class pattern: no nested quantifiers, so it stays linear.
const POSTER_PATH_PATTERN = /^\/[A-Za-z0-9_-]+\.(?:jpg|jpeg|png|webp)$/;

// Poster paths are tens of characters; the cap keeps hostile input away from the pattern.
const MAX_POSTER_PATH_LENGTH = 200;

export type PosterSize = "w92" | "w185" | "w342" | "w500";

const POSTER_SIZES: ReadonlySet<string> = new Set<PosterSize>(["w92", "w185", "w342", "w500"]);

/** True when the value is a plain TMDB image file path such as `/abc123.jpg`. */
export function isPosterPath(value: string): boolean {
  return value.length <= MAX_POSTER_PATH_LENGTH && POSTER_PATH_PATTERN.test(value);
}

/**
 * Builds the TMDB image URL for a poster. Returns null for a missing path and for
 * anything that is not a plain image file name, so a bad stored value can never
 * point the browser at another host or path.
 */
export function posterUrl(posterPath: string | null, size: PosterSize): string | null {
  if (posterPath === null || !POSTER_SIZES.has(size) || !isPosterPath(posterPath)) return null;
  return `${IMAGE_BASE_URL}${size}${posterPath}`;
}
