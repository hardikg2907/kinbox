import type { IsoDate } from "./types";

const MAX_TIME_ZONE_LENGTH = 64;
const EARLIEST_WATCH_DATE: IsoDate = "1900-01-01";
const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isValidTimeZone(tz: string): boolean {
  if (tz.length === 0 || tz.length > MAX_TIME_ZONE_LENGTH) return false;
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function todayIn(timeZone: string, now: Date): IsoDate {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: isValidTimeZone(timeZone) ? timeZone : "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const valueOf = (type: Intl.DateTimeFormatPartTypes): string => {
    const value = parts.find((part) => part.type === type)?.value;
    if (value === undefined) throw new Error(`Date formatting returned no ${type}.`);
    return value;
  };
  return `${valueOf("year")}-${valueOf("month")}-${valueOf("day")}`;
}

export function isIsoDate(s: string): boolean {
  // The length check first keeps a huge input from reaching the pattern at all.
  if (s.length !== 10) return false;
  const match = ISO_DATE_PATTERN.exec(s);
  if (match === null) return false;

  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  // Date.UTC maps years 0 to 99 onto 1900 to 1999, so build the date with setUTCFullYear.
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

export function isValidWatchDate(s: string, today: IsoDate): boolean {
  return isIsoDate(s) && s >= EARLIEST_WATCH_DATE && s <= today;
}
