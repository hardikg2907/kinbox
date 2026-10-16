import type { Status } from "./types";

/** A Rating is stored in half-star units: 1 is half a star, 10 is five stars. */
const MIN_HALF_STARS = 1;
const MAX_HALF_STARS = 10;

export function canRate(status: Status): boolean {
  return status === "watching" || status === "watched" || status === "dropped";
}

export function isValidRating(halfStars: number): boolean {
  return Number.isInteger(halfStars) && halfStars >= MIN_HALF_STARS && halfStars <= MAX_HALF_STARS;
}

function assertValidRating(halfStars: number): void {
  if (!isValidRating(halfStars)) {
    throw new RangeError("A Rating is a whole number of half-stars from 1 to 10.");
  }
}

export function starsFromHalfStars(halfStars: number): number {
  assertValidRating(halfStars);
  return halfStars / 2;
}

export function halfStarsFromStars(stars: number): number {
  const halfStars = stars * 2;
  assertValidRating(halfStars);
  return halfStars;
}

export function ratingLabel(halfStars: number): string {
  const stars = starsFromHalfStars(halfStars);
  return stars === 1 ? "1 star" : `${stars} stars`;
}
