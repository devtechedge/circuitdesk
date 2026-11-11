import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import type { AuthenticatedSession } from "@/auth/session";
import type { Database } from "@/db/client";
import { withTenantDb } from "@/db/tenant";
import { RMA_DISPOSITIONS, RMA_STATUSES, rmaOrders, warrantyClaims } from "@/db/schema";
import { AppError } from "@/lib/errors";
import { assertPermission } from "@/security/rbac";
import { recordAuditLog } from "./audit";

export const updateRmaSchema = z.object({
  rmaId: z.string().uuid(),
  carrierName: z.string().trim().min(2).max(120).optional(),
  trackingNumber: z.string().trim().max(80).optional(),
  inboundCondition: z.string().trim().max(400).optional(),
  inspectionResult: z.string().trim().max(400).optional(),
  disposition: z.enum(RMA_DISPOSITIONS),
  ewasteManifestRef: z.string().trim().max(80).optional(),
  supplierRecoveryMinor: z.number().int().min(0).max(500_000_000).default(0),
  status: z.enum(RMA_STATUSES),
});

export async function listTenantRmas(session: AuthenticatedSession, dbOverride?: Database) {
  return withTenantDb(
    session.tenantId,
    async (tx) => {
      return tx
        .select({
          rma: rmaOrders,
          claimNumber: warrantyClaims.claimNumber,
          customerCity: warrantyClaims.shippingCity,
        })
        .from(rmaOrders)
        .innerJoin(warrantyClaims, eq(rmaOrders.claimId, warrantyClaims.id))
        .where(eq(rmaOrders.tenantId, session.tenantId))
        .orderBy(desc(rmaOrders.createdAt))
        .limit(150);
    },
    dbOverride
  );
}

export async function updateRmaDisposition(
  session: AuthenticatedSession,
  input: z.infer<typeof updateRmaSchema>,
  ipHash?: string,
  dbOverride?: Database
) {
  assertPermission(session.role, "inventory:write");
  const parsed = updateRmaSchema.parse(input);

  if (parsed.disposition === "SCRAP_EWASTE" && !parsed.ewasteManifestRef?.trim()) {
    throw new AppError(
      422,
      "EWASTE_MANIFEST_REQUIRED",
      "E-Waste recycler manifest reference is required when scrapping hardware (India E-Waste Rules 2022)."
    );
  }

  return withTenantDb(
    session.tenantId,
    async (tx) => {
      const [existing] = await tx
        .select()
        .from(rmaOrders)
        .where(and(eq(rmaOrders.id, parsed.rmaId), eq(rmaOrders.tenantId, session.tenantId)))
        .limit(1);

      if (!existing) {
        throw new AppError(404, "RMA_NOT_FOUND", "RMA order not found.");
      }

      const [updated] = await tx
        .update(rmaOrders)
        .set({
          carrierName: parsed.carrierName ?? existing.carrierName,
          trackingNumber: parsed.trackingNumber ?? existing.trackingNumber,
          inboundCondition: parsed.inboundCondition ?? existing.inboundCondition,
          inspectionResult: parsed.inspectionResult ?? existing.inspectionResult,
          disposition: parsed.disposition,
          ewasteManifestRef: parsed.ewasteManifestRef || existing.ewasteManifestRef,
          supplierRecoveryMinor: parsed.supplierRecoveryMinor,
          status: parsed.status,
        })
        .where(eq(rmaOrders.id, existing.id))
        .returning();

      await recordAuditLog(
        {
          tenantId: session.tenantId,
          actorUserId: session.userId,
          actorRole: session.role,
          action: "RMA_UPDATED",
          entityType: "RMA",
          entityId: existing.id,
          ipHash,
          summary: `Updated RMA ${existing.rmaNumber} -> ${parsed.status} (${parsed.disposition}).`,
        },
        tx
      );

      return updated!;
    },
    dbOverride
  );
}
