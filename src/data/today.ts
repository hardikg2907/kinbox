import "server-only";
import { cookies } from "next/headers";
import { isValidTimeZone, todayIn } from "@/domain/dates";
import type { IsoDate } from "@/domain/types";
import { TIME_ZONE_COOKIE } from "@/lib/time-zone";

function decodeZone(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/** Today in the Owner's own time zone, from the browser's cookie; UTC when it is missing or bad. */
export async function getToday(): Promise<IsoDate> {
  const raw = (await cookies()).get(TIME_ZONE_COOKIE)?.value;
  const zone = raw === undefined ? "UTC" : decodeZone(raw);
  return todayIn(isValidTimeZone(zone) ? zone : "UTC", new Date());
}
