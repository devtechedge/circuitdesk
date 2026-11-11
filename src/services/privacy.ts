import { and, eq } from "drizzle-orm";
import type { AuthenticatedSession } from "@/auth/session";
import type { Database } from "@/db/client";
import { withTenantDb } from "@/db/tenant";
import {
  productionBatches,
  recallCampaigns,
  serialUnits,
  warrantyClaims,
  warrantyRegistrations,
} from "@/db/schema";
import { AppError } from "@/lib/errors";
import { assertPermission } from "@/security/rbac";
import { maskEmail } from "@/security/serial-mask";
import { recordAuditLog } from "./audit";

export async function exportDataPrincipalRecord(
  params: {
    session: AuthenticatedSession;
    customerEmail: string;
    ipHash?: string;
  },
  dbOverride?: Database
) {
  assertPermission(params.session.role, "privacy:execute");
  const normalizedEmail = params.customerEmail.trim().toLowerCase();

  return withTenantDb(
    params.session.tenantId,
    async (tx) => {
      const registrations = await tx
        .select({
          registrationNumber: warrantyRegistrations.registrationNumber,
          purchaseDate: warrantyRegistrations.purchaseDate,
          coverageEndDate: warrantyRegistrations.coverageEndDate,
          status: warrantyRegistrations.status,
          salesChannel: warrantyRegistrations.salesChannel,
          consentVersion: warrantyRegistrations.consentVersion,
          consentAcceptedAt: warrantyRegistrations.consentAcceptedAt,
          city: warrantyRegistrations.customerCity,
          pinCode: warrantyRegistrations.customerPinCode,
        })
        .from(warrantyRegistrations)
        .where(
          and(
            eq(warrantyRegistrations.tenantId, params.session.tenantId),
            eq(warrantyRegistrations.customerEmail, normalizedEmail)
          )
        );

      const claims = await tx
        .select({
          claimNumber: warrantyClaims.claimNumber,
          faultCategory: warrantyClaims.faultCategory,
          status: warrantyClaims.status,
          resolutionType: warrantyClaims.resolutionType,
          createdAt: warrantyClaims.createdAt,
        })
        .from(warrantyClaims)
        .where(
          and(
            eq(warrantyClaims.tenantId, params.session.tenantId),
            eq(warrantyClaims.customerEmail, normalizedEmail)
          )
        );

      await recordAuditLog(
        {
          tenantId: params.session.tenantId,
          actorUserId: params.session.userId,
          actorRole: params.session.role,
          action: "DPDP_DATA_EXPORTED",
          entityType: "DATA_PRINCIPAL",
          entityId: maskEmail(normalizedEmail),
          ipHash: params.ipHash,
          summary: `Exported DPDP data principal dossier (${registrations.length} registrations, ${claims.length} claims).`,
        },
        tx
      );

      return {
        exportedAt: new Date().toISOString(),
        dataPrincipalEmail: normalizedEmail,
        registrations,
        claims,
      };
    },
    dbOverride
  );
}

export async function eraseDataPrincipalPii(
  params: {
    session: AuthenticatedSession;
    customerEmail: string;
    ipHash?: string;
  },
  dbOverride?: Database
): Promise<{ erasedRegistrations: number; erasedClaims: number }> {
  assertPermission(params.session.role, "privacy:execute");
  const normalizedEmail = params.customerEmail.trim().toLowerCase();
  const now = new Date();
  const redactedEmail = `erased+${now.getTime()}@redacted.invalid`;

  return withTenantDb(
    params.session.tenantId,
    async (tx) => {
      const regUpdated = await tx
        .update(warrantyRegistrations)
        .set({
          customerName: "[ERASED-DPDP]",
          customerEmail: redactedEmail,
          customerPhone: "[ERASED]",
          status: "ERASED",
          demoPublicToken: null,
          tokenRevokedAt: now,
        })
        .where(
          and(
            eq(warrantyRegistrations.tenantId, params.session.tenantId),
            eq(warrantyRegistrations.customerEmail, normalizedEmail)
          )
        )
        .returning({ id: warrantyRegistrations.id });

      const claimUpdated = await tx
        .update(warrantyClaims)
        .set({
          customerName: "[ERASED-DPDP]",
          customerEmail: redactedEmail,
          customerPhone: "[ERASED]",
          shippingAddress: "[ERASED-DPDP]",
          demoPublicToken: null,
          tokenRevokedAt: now,
        })
        .where(
          and(
            eq(warrantyClaims.tenantId, params.session.tenantId),
            eq(warrantyClaims.customerEmail, normalizedEmail)
          )
        )
        .returning({ id: warrantyClaims.id });

      await recordAuditLog(
        {
          tenantId: params.session.tenantId,
          actorUserId: params.session.userId,
          actorRole: params.session.role,
          action: "DPDP_PII_ERASED",
          entityType: "DATA_PRINCIPAL",
          entityId: maskEmail(normalizedEmail),
          ipHash: params.ipHash,
          summary: `Erased PII and revoked portal tokens across ${regUpdated.length} registrations and ${claimUpdated.length} claims.`,
        },
        tx
      );

      return {
        erasedRegistrations: regUpdated.length,
        erasedClaims: claimUpdated.length,
      };
    },
    dbOverride
  );
}

export async function createRecallDraft(
  params: {
    session: AuthenticatedSession;
    batchId: string;
    title: string;
    reason: string;
    ipHash?: string;
  },
  dbOverride?: Database
) {
  assertPermission(params.session.role, "catalog:write");

  return withTenantDb(
    params.session.tenantId,
    async (tx) => {
      const batchRows = await tx
        .select()
        .from(productionBatches)
        .where(
          and(
            eq(productionBatches.id, params.batchId),
            eq(productionBatches.tenantId, params.session.tenantId)
          )
        )
        .limit(1);

      const batch = batchRows[0];
      if (!batch) {
        throw new AppError(404, "BATCH_NOT_FOUND", "Production batch not found.");
      }

      const units = await tx
        .select({ id: serialUnits.id })
        .from(serialUnits)
        .where(
          and(
            eq(serialUnits.tenantId, params.session.tenantId),
            eq(serialUnits.batchId, batch.id)
          )
        );

      const inserted = await tx
        .insert(recallCampaigns)
        .values({
          tenantId: params.session.tenantId,
          batchId: batch.id,
          title: params.title.trim(),
          reason: params.reason.trim(),
          affectedCount: units.length,
          status: "DRAFT_AWAITING_APPROVAL",
          createdByUserId: params.session.userId,
        })
        .returning();

      const campaign = inserted[0]!;
      await recordAuditLog(
        {
          tenantId: params.session.tenantId,
          actorUserId: params.session.userId,
          actorRole: params.session.role,
          action: "RECALL_DRAFT_CREATED",
          entityType: "RECALL_CAMPAIGN",
          entityId: campaign.id,
          ipHash: params.ipHash,
          summary: `Drafted recall audience for batch ${batch.batchCode} (${units.length} serialized units); awaiting human Owner/Admin approval.`,
        },
        tx
      );

      return campaign;
    },
    dbOverride
  );
}

export async function approveRecallCampaign(
  params: {
    session: AuthenticatedSession;
    campaignId: string;
    ipHash?: string;
  },
  dbOverride?: Database
) {
  assertPermission(params.session.role, "recall:approve");

  return withTenantDb(
    params.session.tenantId,
    async (tx) => {
      const updated = await tx
        .update(recallCampaigns)
        .set({
          status: "APPROVED_READY",
          approvedByUserId: params.session.userId,
          approvedAt: new Date(),
        })
        .where(
          and(
            eq(recallCampaigns.id, params.campaignId),
            eq(recallCampaigns.tenantId, params.session.tenantId)
          )
        )
        .returning();

      const row = updated[0];
      if (!row) {
        throw new AppError(404, "RECALL_NOT_FOUND", "Recall campaign not found.");
      }

      await recordAuditLog(
        {
          tenantId: params.session.tenantId,
          actorUserId: params.session.userId,
          actorRole: params.session.role,
          action: "RECALL_HUMAN_APPROVED",
          entityType: "RECALL_CAMPAIGN",
          entityId: row.id,
          ipHash: params.ipHash,
          summary: `Human Owner/Admin approved recall audience "${row.title}".`,
        },
        tx
      );

      return row;
    },
    dbOverride
  );
}
