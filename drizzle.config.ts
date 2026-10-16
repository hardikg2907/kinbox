import { loadEnvConfig } from "@next/env";
import { defineConfig } from "drizzle-kit";

// Same files and order as `next dev`, so migrations hit the database the app uses.
loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");

// Migrations use the direct (unpooled) URL when there is one; DDL through a
// transaction pooler can fail.
const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  casing: "snake_case",
  dbCredentials: { url },
  strict: true,
  verbose: true,
});
