import { eq } from "drizzle-orm";
import type { AuthenticatedSession } from "@/auth/session";
import { createManagedPgliteDb, getDb, type Database } from "@/db/client";
import { memberships, tenants, users } from "@/db/schema";
import { seedSyntheticDemo } from "@/demo/seed";

let activeManaged: { db: Database; close: () => Promise<void> } | null = null;

export async function getTestDatabase(): Promise<Database> {
  if (process.env.DATABASE_URL?.trim()) {
    const db = await getDb();
    await seedSyntheticDemo(db);
    return db;
  }
  if (activeManaged) {
    await activeManaged.close();
    activeManaged = null;
  }
  activeManaged = await createManagedPgliteDb();
  await seedSyntheticDemo(activeManaged.db);
  return activeManaged.db;
}

export async function closeTestDatabase(): Promise<void> {
  if (activeManaged) {
    await activeManaged.close();
    activeManaged = null;
  }
}

export async function sessionForEmail(
  db: Database,
  email: string
): Promise<AuthenticatedSession> {
  const rows = await db
    .select({
      userId: users.id,
      email: users.email,
      fullName: users.fullName,
      tenantId: tenants.id,
      tenantSlug: tenants.slug,
      tenantName: tenants.name,
      tenantCurrency: tenants.defaultCurrency,
      isDemoTenant: tenants.isDemo,
      role: memberships.role,
      serviceCentreId: memberships.serviceCentreId,
    })
    .from(users)
    .innerJoin(memberships, eq(memberships.userId, users.id))
    .innerJoin(tenants, eq(memberships.tenantId, tenants.id))
    .where(eq(users.email, email))
    .limit(1);

  const r = rows[0];
  if (!r) {
    throw new Error(`Test persona not found: ${email}`);
  }
  return {
    sessionId: "00000000-0000-4000-8000-000000000001",
    ...r,
  };
}
