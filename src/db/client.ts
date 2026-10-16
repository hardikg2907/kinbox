import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "@/lib/env";
import * as schema from "./schema";

export type Database = NodePgDatabase<typeof schema>;

// One pool per server instance. Dev hot reloads re-run this module, so the pool
// lives on globalThis to avoid leaking connections on every edit.
const globalForDb = globalThis as unknown as { kinboxPool?: Pool; kinboxDb?: Database };

function createDb(): Database {
  const pool = new Pool({
    connectionString: env().DATABASE_URL,
    // Serverless functions run one request at a time; a small pool keeps Neon's
    // pooled endpoint from filling up when many instances start at once.
    max: 5,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 5_000,
  });
  globalForDb.kinboxPool = pool;
  return drizzle({ client: pool, schema, casing: "snake_case" });
}

export function db(): Database {
  globalForDb.kinboxDb ??= createDb();
  return globalForDb.kinboxDb;
}

export async function closeDb(): Promise<void> {
  await globalForDb.kinboxPool?.end();
  globalForDb.kinboxPool = undefined;
  globalForDb.kinboxDb = undefined;
}
