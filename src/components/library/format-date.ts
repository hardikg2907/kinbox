import type { IsoDate } from "@/domain/types";

// An ISO date is a calendar day, not an instant: read and print it in UTC so it never shifts a day.
const formatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/** "12 Oct 2026" */
export function formatWatchDate(date: IsoDate): string {
  return formatter.format(new Date(`${date}T00:00:00Z`));
}
