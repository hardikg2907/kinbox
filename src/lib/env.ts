import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  DATABASE_URL_UNPOOLED: z.url({ protocol: /^postgres(ql)?$/ }).optional(),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.url({ protocol: /^https?$/ }),
  TMDB_API_READ_TOKEN: z.string().min(20).optional(),
  // Lets tests and offline development use the bundled fixtures even when a token is set.
  TMDB_FAKE: z.enum(["0", "1"]).default("0"),
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

// Parsed on first use rather than at import, so `next build` can collect pages
// without database credentials; instrumentation.ts calls it at server start.
export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const names = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new Error(`Invalid or missing environment variables: ${names}`);
  }
  if (parsed.data.NODE_ENV === "production" && !parsed.data.TMDB_API_READ_TOKEN) {
    throw new Error("TMDB_API_READ_TOKEN is required in production");
  }
  cached = parsed.data;
  return cached;
}

export function useTmdbFake(): boolean {
  const { TMDB_FAKE, TMDB_API_READ_TOKEN, NODE_ENV } = env();
  if (NODE_ENV === "production") return false;
  return TMDB_FAKE === "1" || !TMDB_API_READ_TOKEN;
}
