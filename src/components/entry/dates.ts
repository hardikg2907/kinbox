import { isIsoDate, todayIn } from "@/domain/dates";
import type { IsoDate } from "@/domain/types";

// Dates are calendar days, not moments: parsing them as UTC midnight and
// formatting in UTC keeps a day from shifting with the viewer's time zone.
const DISPLAY = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export function formatIsoDate(date: IsoDate): string {
  return isIsoDate(date) ? DISPLAY.format(new Date(`${date}T00:00:00Z`)) : date;
}

/** The viewer's own calendar day. Call it from event handlers, never during render. */
export function localToday(): IsoDate {
  return todayIn(Intl.DateTimeFormat().resolvedOptions().timeZone, new Date());
}
