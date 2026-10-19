"use client";

import { useEffect } from "react";
import { WIDE_COOKIE, WIDE_QUERY } from "@/lib/viewport";

export function writeWideCookie(wide: boolean): void {
  const value = wide ? "1" : "0";
  if (document.cookie.split("; ").includes(`${WIDE_COOKIE}=${value}`)) return;
  const secure = location.protocol === "https:" ? "; secure" : "";
  document.cookie = `${WIDE_COOKIE}=${value}; path=/; max-age=31536000; samesite=lax${secure}`;
}

// Tells the server whether the screen is wide, now and whenever that changes (a window resized, a
// tablet turned).
export function ViewportCookie() {
  useEffect(() => {
    const query = window.matchMedia(WIDE_QUERY);
    const write = () => writeWideCookie(query.matches);
    write();
    query.addEventListener("change", write);
    return () => query.removeEventListener("change", write);
  }, []);
  return null;
}
