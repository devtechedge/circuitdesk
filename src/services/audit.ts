import { desc, eq } from "drizzle-orm";
import { getDb, type Database, type DbExecutor } from "@/db/client";
import { auditLogs, type Role } from "@/db/schema";

export async function recordAuditLog(
  params: {
    tenantId: string;
    actorUserId?: string | null;
    actorRole: Role | "SYSTEM" | "PORTAL";
    action: string;
    entityType: string;
    entityId: string;
    ipHash?: string;
    summary: string;
    metadata?: Record<string, unknown>;
  },
  executor?: DbExecutor
): Promise<void> {
  const db = executor ?? (await getDb());
  await db.insert(auditLogs).values({
    tenantId: params.tenantId,
    actorUserId: params.actorUserId ?? null,
    actorRole: params.actorRole,
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId,
    ipHash: params.ipHash ?? "system",
    summary: params.summary,
    metadata: params.metadata ?? {},
  });
}

export async function listTenantAuditLogs(
  tenantId: string,
  limit = 100,
  dbOverride?: Database
) {
  const db = dbOverride ?? (await getDb());
  return db
    .select()
    .from(auditLogs)
    .where(eq(auditLogs.tenantId, tenantId))
    .orderBy(desc(auditLogs.createdAt))
    .limit(Math.min(Math.max(limit, 1), 250));
}
