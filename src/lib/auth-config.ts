import { betterAuth, type BetterAuthPlugin } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { db } from "@/db/client";
import * as schema from "@/db/schema";
import { lanOrigins } from "@/lib/dev-origins";
import { env } from "@/lib/env";
import { describeError } from "@/lib/log";

// Shared by the app and the user:create script so both hash passwords and
// store accounts the same way.
export function createAuth(plugins: BetterAuthPlugin[] = []) {
  const { BETTER_AUTH_SECRET, BETTER_AUTH_URL, NODE_ENV } = env();
  const devOrigins = NODE_ENV === "development" ? lanOrigins(new URL(BETTER_AUTH_URL).port || "3100") : [];
  return betterAuth({
    appName: "Kinbox",
    secret: BETTER_AUTH_SECRET,
    baseURL: BETTER_AUTH_URL,
    trustedOrigins: devOrigins,
    database: drizzleAdapter(db(), { provider: "pg", schema, transaction: true }),
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
    },
    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
      // Saves a database round trip on most requests; a revoked session can
      // live on for at most this long.
      cookieCache: { enabled: true, maxAge: 5 * 60 },
    },
    rateLimit: {
      enabled: true,
      // Memory storage is per serverless instance, which an attacker can spread across.
      storage: "database",
      window: 60,
      max: 100,
      customRules: {
        "/sign-in/email": { window: 60, max: 5 },
      },
    },
    advanced: {
      ipAddress: {
        // Vercel overwrites x-vercel-forwarded-for, so a client cannot spoof it; the
        // other headers are client-settable and would let anyone reset the sign-in limit.
        ipAddressHeaders:
          NODE_ENV === "production" ? ["x-vercel-forwarded-for"] : ["x-real-ip", "x-forwarded-for"],
      },
    },
    logger: {
      level: "warn",
      // Better Auth passes raw errors as extra arguments, and some carry the session
      // token or query parameters, so only a short, one-line message is kept.
      log: (level, message) => {
        const text =
          typeof message === "string" ? message.replace(/[\r\n]+/g, " ").slice(0, 200) : describeError(message);
        (level === "error" ? console.error : console.warn)(`[auth] ${level}: ${text}`);
      },
    },
    telemetry: { enabled: false },
    plugins,
  });
}
