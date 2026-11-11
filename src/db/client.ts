import type { PgliteDatabase } from "drizzle-orm/pglite";
import { getEnv, isDemoMode } from "@/env";
import { bootstrapPglite } from "./bootstrap";
import * as schema from "./schema";

export type Database = PgliteDatabase<typeof schema>;
export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
export type DbExecutor = Database | Transaction;
export type DbSource = "postgres" | "pglite";

type AutoSeeder = (db: Database) => Promise<void>;

const globalRef = globalThis as typeof globalThis & {
  __circuitdeskDb?: Promise<Database>;
  __circuitdeskDbSource?: DbSource;
  __circuitdeskAutoSeeder?: AutoSeeder;
};

export function registerAutoSeeder(seeder: AutoSeeder): void {
  globalRef.__circuitdeskAutoSeeder = seeder;
}

function activeSource(): DbSource {
  const url = getEnv().DATABASE_URL;
  return url && url.trim().length > 0 ? "postgres" : "pglite";
}

export function dbSource(): DbSource {
  return globalRef.__circuitdeskDbSource ?? activeSource();
}

async function createPostgres(url: string): Promise<Database> {
  const { drizzle } = await import("drizzle-orm/node-postgres");
  const { Pool } = await import("pg");
  const pool = new Pool({
    connectionString: url,
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
  return drizzle(pool, { schema }) as unknown as Database;
}

export async function createIsolatedPgliteDb(): Promise<Database> {
  const { db } = await createManagedPgliteDb();
  return db;
}

export async function createManagedPgliteDb(): Promise<{
  db: Database;
  close: () => Promise<void>;
}> {
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const client = new PGlite();
  await client.waitReady;
  await bootstrapPglite(client);
  return {
    db: drizzle(client, { schema }),
    close: () => client.close(),
  };
}

async function createPgliteWithOptionalSeed(): Promise<Database> {
  const db = await createIsolatedPgliteDb();
  if (isDemoMode() && process.env.SKIP_AUTO_SEED !== "1") {
    if (!globalRef.__circuitdeskAutoSeeder) {
      const { seedSyntheticDemo } = await import("@/demo/seed");
      globalRef.__circuitdeskAutoSeeder = seedSyntheticDemo;
    }
    await globalRef.__circuitdeskAutoSeeder(db);
  }
  return db;
}

async function createDb(): Promise<Database> {
  const source = activeSource();
  globalRef.__circuitdeskDbSource = source;
  if (source === "postgres") {
    return createPostgres(getEnv().DATABASE_URL!.trim());
  }
  return createPgliteWithOptionalSeed();
}

export function resetDbForTests(): void {
  globalRef.__circuitdeskDb = undefined;
  globalRef.__circuitdeskDbSource = undefined;
}

export function getDb(): Promise<Database> {
  if (typeof window !== "undefined") {
    throw new Error("@/db/client is server-only and must never be imported in browser code.");
  }
  globalRef.__circuitdeskDb ??= createDb().catch((error) => {
    globalRef.__circuitdeskDb = undefined;
    throw error;
  });
  return globalRef.__circuitdeskDb;
}
