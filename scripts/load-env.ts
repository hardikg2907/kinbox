import { loadEnvConfig } from "@next/env";

// Scripts run outside Next.js, so load the same .env files `next dev` would.
loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");
