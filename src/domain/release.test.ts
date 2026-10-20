import { describe, expect, it } from "vitest";
import { isOutYet } from "./release";

const TODAY = "2026-10-16";

describe("isOutYet", () => {
  it("is out on and after its release date", () => {
    expect(isOutYet("2010-07-15", TODAY)).toBe(true);
    expect(isOutYet(TODAY, TODAY)).toBe(true);
  });

  it("is not out when the release date is after today", () => {
    expect(isOutYet("2026-10-17", TODAY)).toBe(false);
    expect(isOutYet("2027-01-01", TODAY)).toBe(false);
  });

  it("counts a Title with no release date as out", () => {
    expect(isOutYet(null, TODAY)).toBe(true);
  });
});
