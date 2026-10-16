import { describe, expect, it } from "vitest";
import {
  canRate,
  halfStarsFromStars,
  isValidRating,
  ratingLabel,
  starsFromHalfStars,
} from "./rating";

describe("canRate", () => {
  it.each(["watching", "watched", "dropped"] as const)("allows a %s Entry", (status) => {
    expect(canRate(status)).toBe(true);
  });

  it("does not allow a To watch Entry", () => {
    expect(canRate("to_watch")).toBe(false);
  });
});

describe("isValidRating", () => {
  it.each([1, 2, 5, 9, 10])("accepts %i", (value) => {
    expect(isValidRating(value)).toBe(true);
  });

  it.each([0, 11, -1, 3.5, 0.5, NaN, Infinity, -Infinity])("rejects %s", (value) => {
    expect(isValidRating(value)).toBe(false);
  });
});

describe("ratingLabel", () => {
  it.each([
    [1, "0.5 stars"],
    [2, "1 star"],
    [3, "1.5 stars"],
    [7, "3.5 stars"],
    [8, "4 stars"],
    [10, "5 stars"],
  ])("labels %i half-stars as %s", (halfStars, label) => {
    expect(ratingLabel(halfStars)).toBe(label);
  });

  it.each([0, 11, 2.5, NaN])("rejects %s", (halfStars) => {
    expect(() => ratingLabel(halfStars)).toThrow(RangeError);
  });
});

describe("starsFromHalfStars", () => {
  it("converts half-star units to stars", () => {
    expect(starsFromHalfStars(7)).toBe(3.5);
    expect(starsFromHalfStars(1)).toBe(0.5);
    expect(starsFromHalfStars(10)).toBe(5);
  });

  it.each([0, 11, 1.5])("rejects %s", (halfStars) => {
    expect(() => starsFromHalfStars(halfStars)).toThrow(RangeError);
  });
});

describe("halfStarsFromStars", () => {
  it("converts stars to half-star units", () => {
    expect(halfStarsFromStars(3.5)).toBe(7);
    expect(halfStarsFromStars(0.5)).toBe(1);
    expect(halfStarsFromStars(5)).toBe(10);
    expect(halfStarsFromStars(1)).toBe(2);
  });

  it.each([0, 5.5, 6, -1, 0.25, 3.3, NaN, Infinity])("throws RangeError for %s", (stars) => {
    expect(() => halfStarsFromStars(stars)).toThrow(RangeError);
  });

  it("round-trips every valid Rating", () => {
    for (let halfStars = 1; halfStars <= 10; halfStars++) {
      expect(halfStarsFromStars(starsFromHalfStars(halfStars))).toBe(halfStars);
    }
  });
});
