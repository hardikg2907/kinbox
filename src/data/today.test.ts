import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getToday } from "./today";

const cookieValue = vi.hoisted(() => ({ current: undefined as string | undefined }));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "kb_tz" && cookieValue.current !== undefined
        ? { name, value: cookieValue.current }
        : undefined,
  }),
}));

beforeEach(() => {
  vi.useFakeTimers();
  // 20:00 UTC is already the next day in India.
  vi.setSystemTime(new Date("2026-10-16T20:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
  cookieValue.current = undefined;
});

describe("getToday", () => {
  it.each([
    ["Asia/Kolkata", "2026-10-17"],
    ["America%2FNew_York", "2026-10-16"],
    ["Pacific/Kiritimati", "2026-10-17"],
  ])("uses the Owner's time zone %s", async (zone, expected) => {
    cookieValue.current = zone;
    expect(await getToday()).toBe(expected);
  });

  it.each([undefined, "", "Mars/Olympus_Mons", "%E0%A4%A", "x".repeat(500)])(
    "falls back to UTC for the cookie %j",
    async (zone) => {
      cookieValue.current = zone;
      expect(await getToday()).toBe("2026-10-16");
    },
  );
});
