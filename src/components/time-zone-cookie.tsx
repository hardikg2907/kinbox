"use client";

import { useEffect } from "react";
import { TIME_ZONE_COOKIE } from "@/lib/time-zone";

// "Watched today" must mean the phone's today, not the server's UTC date.
export function TimeZoneCookie() {
  useEffect(() => {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!zone) return;
    const current = document.cookie
      .split("; ")
      .find((part) => part.startsWith(`${TIME_ZONE_COOKIE}=`))
      ?.slice(TIME_ZONE_COOKIE.length + 1);
    if (current === encodeURIComponent(zone)) return;
    const secure = location.protocol === "https:" ? "; secure" : "";
    document.cookie = `${TIME_ZONE_COOKIE}=${encodeURIComponent(zone)}; path=/; max-age=31536000; samesite=lax${secure}`;
  }, []);
  return null;
}
