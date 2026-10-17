import "./load-env";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

// Runs before `next build` on Vercel. Preview deploys share the environment's
// database settings, so only production deploys may change the schema.
async function main(): Promise<void> {
  const target = process.env.VERCEL_ENV;
  if (target !== "production") {
    process.stdout.write(`Skipping database migrations (VERCEL_ENV=${target ?? "unset"}).\n`);
    return;
  }

  // DDL through Neon's transaction pooler can fail, so the direct URL comes first.
  const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL_UNPOOLED or DATABASE_URL must be set to migrate.");

  const pool = new Pool({ connectionString: url, max: 1, connectionTimeoutMillis: 10_000 });
  try {
    // The same journal table drizzle-kit uses, so local `pnpm db:migrate` runs stay in step.
    await migrate(drizzle({ client: pool }), { migrationsFolder: "drizzle" });
    process.stdout.write("Database migrations applied.\n");
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  // A failed migration fails the deploy, so the new code never runs on an old schema.
  // Schema statements carry no user data, so the message is safe to show in build logs.
  const detail = error instanceof Error ? `${error.name}: ${error.message}`.slice(0, 300) : "unknown error";
  process.stderr.write(`Migration failed: ${detail}\n`);
  process.exitCode = 1;
});
