import { env } from "@/lib/env";

// Fail at server start, not on the first request, when configuration is wrong.
export function register(): void {
  env();
}
