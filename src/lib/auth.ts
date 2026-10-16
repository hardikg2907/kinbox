import "server-only";
import { nextCookies } from "better-auth/next-js";
import { createAuth } from "@/lib/auth-config";

type Auth = ReturnType<typeof createAuth>;

let instance: Auth | undefined;

// Built on first use so `next build` can import routes without secrets present.
export function auth(): Auth {
  // nextCookies() must stay last so it sees cookies set by earlier plugins.
  instance ??= createAuth([nextCookies()]);
  return instance;
}
