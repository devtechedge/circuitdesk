import "dotenv/config";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { rlsDdl } from "../src/db/ddl";

const url = process.env.DATABASE_URL_UNPOOLED?.trim() || process.env.DATABASE_URL?.trim();

if (!url) {
  console.error("DATABASE_URL_UNPOOLED or DATABASE_URL is required to run migrations.");
  process.exit(1);
}

const parsed = new URL(url);
const dbName = parsed.pathname.replace(/^\//, "");
console.log(`Applying CircuitDesk migrations + RLS policies to database "${dbName}" on ${parsed.hostname}...`);

const pool = new Pool({ connectionString: url, max: 1 });
const db = drizzle(pool);

try {
  await migrate(db, {
    migrationsFolder: fileURLToPath(new URL("../drizzle", import.meta.url)),
  });
  if (rlsDdl.trim().length > 0) {
    await pool.query(rlsDdl);
  }
  console.log("Migrations and Row-Level Security policies applied successfully.");
} finally {
  await pool.end();
}

export {};
