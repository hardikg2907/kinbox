import { attachDatabasePool } from "@vercel/functions";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "@/lib/env";
import { describeError } from "@/lib/log";
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
  // Neon suspends an idle compute, which drops idle clients. Without a listener that error
  // would crash the process; pg discards the dead client on its own.
  pool.on("error", (error) => {
    console.error(`[db.pool] ${describeError(error)}`);
  });
  // Releases idle clients before a Fluid instance suspends.
  attachDatabasePool(pool);
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
