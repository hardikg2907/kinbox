import { describe, expect, it } from "vitest";
import { parseWide } from "./viewport";

describe("parseWide", () => {
  it("reads the two values the app writes", () => {
    expect(parseWide("1")).toBe(true);
    expect(parseWide("0")).toBe(false);
  });

  it("treats a missing or unexpected value as not known, so the desktop sidebar still renders", () => {
    expect(parseWide(undefined)).toBeNull();
    expect(parseWide("")).toBeNull();
    expect(parseWide("true")).toBeNull();
    expect(parseWide("1; path=/")).toBeNull();
  });
});
