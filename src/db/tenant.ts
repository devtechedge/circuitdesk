import { sql } from "drizzle-orm";
import { getDb, type Database, type Transaction } from "./client";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function assertValidUuid(value: string, label = "identifier"): string {
  if (!UUID_REGEX.test(value)) {
    throw new Error(`Invalid ${label} format.`);
  }
  return value;
}

/**
 * Runs work inside a PostgreSQL transaction with `app.current_tenant_id` pinned
 * locally (`set_config(..., true)`) so PgBouncer transaction pooling and
 * PostgreSQL Row-Level Security policies enforce tenant isolation cleanly.
 */
export async function withTenantDb<T>(
  tenantId: string,
  fn: (tx: Transaction) => Promise<T>,
  dbOverride?: Database
): Promise<T> {
  assertValidUuid(tenantId, "tenantId");
  const db = dbOverride ?? (await getDb());
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`);
    return fn(tx);
  });
}
