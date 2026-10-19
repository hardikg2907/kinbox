"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { writeWideCookie } from "@/components/viewport-cookie";
import { WIDE_QUERY } from "@/lib/viewport";

// The server left the sidebar out because the screen was narrow when it last heard. If the screen
// is wide (a resized window, a turned tablet), it asks again with the new width.
export function RefreshWhenWide() {
  const router = useRouter();
  useEffect(() => {
    const query = window.matchMedia(WIDE_QUERY);
    const check = () => {
      if (!query.matches) return;
      writeWideCookie(true);
      router.refresh();
    };
    check();
    query.addEventListener("change", check);
    return () => query.removeEventListener("change", check);
  }, [router]);
  return null;
}
