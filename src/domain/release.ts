import type { IsoDate } from "./types";

/** Out from the release date on. A missing date counts as out, so the Owner's choice is never blocked by a gap in TMDB. */
export function isOutYet(releaseDate: IsoDate | null, today: IsoDate): boolean {
  return releaseDate === null || releaseDate <= today;
}
