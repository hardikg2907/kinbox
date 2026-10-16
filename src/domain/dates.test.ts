import { describe, expect, it } from "vitest";
import { isIsoDate, isValidTimeZone, isValidWatchDate, todayIn } from "./dates";

describe("todayIn", () => {
  it("gives the calendar date in the zone, across a day boundary", () => {
    const now = new Date("2026-10-16T20:00:00Z");
    expect(todayIn("UTC", now)).toBe("2026-10-16");
    expect(todayIn("Asia/Kolkata", now)).toBe("2026-10-17");
    expect(todayIn("America/Los_Angeles", now)).toBe("2026-10-16");
  });

  it("goes back a day for zones behind UTC", () => {
    expect(todayIn("America/Los_Angeles", new Date("2026-10-16T02:00:00Z"))).toBe("2026-10-15");
  });

  it("pads single-digit months and days", () => {
    expect(todayIn("UTC", new Date("2026-03-04T12:00:00Z"))).toBe("2026-03-04");
  });

  it("follows the zone's own rules on a daylight saving change", () => {
    expect(todayIn("Europe/London", new Date("2026-10-24T23:30:00Z"))).toBe("2026-10-25");
    expect(todayIn("Europe/London", new Date("2026-10-25T23:30:00Z"))).toBe("2026-10-25");
  });

  it.each(["Not/AZone", "", "x".repeat(65)])("falls back to UTC for the zone %j", (zone) => {
    expect(todayIn(zone, new Date("2026-10-16T20:00:00Z"))).toBe("2026-10-16");
  });
});

describe("isValidTimeZone", () => {
  it.each(["UTC", "Asia/Kolkata", "America/Argentina/Buenos_Aires"])("accepts %s", (zone) => {
    expect(isValidTimeZone(zone)).toBe(true);
  });

  it.each(["", "Mars/Olympus", "Asia/", "x".repeat(65)])("rejects %j", (zone) => {
    expect(isValidTimeZone(zone)).toBe(false);
  });
});

describe("isIsoDate", () => {
  it.each(["2026-10-16", "1900-01-01", "2024-02-29", "2000-02-29", "0050-06-15"])(
    "accepts %s",
    (value) => {
      expect(isIsoDate(value)).toBe(true);
    },
  );

  it.each([
    "2026-02-30",
    "2026-02-29",
    "1900-02-29",
    "2100-02-29",
    "2026-13-01",
    "2026-00-10",
    "2026-10-00",
    "2026-10-32",
    "2026-04-31",
  ])("rejects the impossible date %s", (value) => {
    expect(isIsoDate(value)).toBe(false);
  });

  it.each([
    "",
    "2026-1-16",
    "26-10-16",
    "2026/10/16",
    "20261016",
    "2026-10-16T00:00:00Z",
    " 2026-10-16",
    "2026-10-16 ",
    "2026-10-16\n",
    "２０２６-10-16",
    "+2026-10-16",
  ])("rejects the malformed text %j", (value) => {
    expect(isIsoDate(value)).toBe(false);
  });

  it("rejects a very long text without scanning it forever", () => {
    expect(isIsoDate("1".repeat(100_000))).toBe(false);
  });
});

describe("isValidWatchDate", () => {
  const today = "2026-10-16";

  it("accepts today and earlier dates back to 1900-01-01", () => {
    expect(isValidWatchDate("2026-10-16", today)).toBe(true);
    expect(isValidWatchDate("2026-10-15", today)).toBe(true);
    expect(isValidWatchDate("1900-01-01", today)).toBe(true);
  });

  it("rejects the future", () => {
    expect(isValidWatchDate("2026-10-17", today)).toBe(false);
    expect(isValidWatchDate("2027-01-01", today)).toBe(false);
  });

  it("rejects dates before 1900", () => {
    expect(isValidWatchDate("1899-12-31", today)).toBe(false);
    expect(isValidWatchDate("0050-06-15", today)).toBe(false);
  });

  it("rejects anything that is not a real ISO date", () => {
    expect(isValidWatchDate("2026-02-30", today)).toBe(false);
    expect(isValidWatchDate("yesterday", today)).toBe(false);
  });

  it("accepts a leap day only in a leap year", () => {
    expect(isValidWatchDate("2024-02-29", today)).toBe(true);
    expect(isValidWatchDate("2025-02-29", today)).toBe(false);
  });
});
