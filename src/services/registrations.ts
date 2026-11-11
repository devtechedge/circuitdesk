import { randomBytes } from "node:crypto";
import { and, desc, eq, isNull, ne } from "drizzle-orm";
import { z } from "zod";
import type { AuthenticatedSession } from "@/auth/session";
import { getDb, type Database } from "@/db/client";
import { withTenantDb } from "@/db/tenant";
import {
  brands,
  products,
  SALES_CHANNELS,
  serialUnits,
  subscriptions,
  tenants,
  usageCounters,
  warrantyPolicies,
  warrantyRegistrations,
} from "@/db/schema";
import { evaluateCoverageWindow, selectApplicablePolicy } from "@/domain/policy-engine";
import { AppError } from "@/lib/errors";
import { assertPermission, hasPermission } from "@/security/rbac";
import { generateOpaqueToken, hashToken } from "@/security/tokens";
import { recordAuditLog } from "./audit";

const PLAN_REG_LIMITS: Record<string, number> = {
  STARTER: 500,
  GROWTH: 2500,
  SCALE: 10000,
  ENTERPRISE: 1_000_000,
};

export const publicRegistrationSchema = z.object({
  serialNumber: z.string().trim().min(4).max(40),
  customerName: z.string().trim().min(2).max(100),
  customerEmail: z.string().trim().email().max(160),
  customerPhone: z.string().trim().min(7).max(24),
  customerPinCode: z.string().trim().min(4).max(12),
  customerCity: z.string().trim().min(2).max(80),
  regionCode: z.string().trim().toUpperCase().min(2).max(8).default("IN"),
  salesChannel: z.enum(SALES_CHANNELS).default("D2C_WEB"),
  sourceMethod: z.enum(["QR", "ORDER_LOOKUP", "DEALER_RECEIPT"]).default("QR"),
  orderReference: z.string().trim().max(80).optional(),
  dealerName: z.string().trim().max(120).optional(),
  purchaseDate: z.string().min(4),
  consentAccepted: z.literal(true, {
    error: "Consent to warranty processing and retention terms is required.",
  }),
});

export async function getBrandPortalContext(brandSlug: string, dbOverride?: Database) {
  const db = dbOverride ?? (await getDb());
  const found = await db
    .select({
      brand: brands,
      tenantIsDemo: tenants.isDemo,
    })
    .from(brands)
    .innerJoin(tenants, eq(brands.tenantId, tenants.id))
    .where(eq(brands.slug, brandSlug.trim().toLowerCase()))
    .limit(1);

  return found[0] ?? null;
}

export async function submitPublicWarrantyRegistration(
  params: {
    brandSlug: string;
    input: z.infer<typeof publicRegistrationSchema>;
    ipHash?: string;
  },
  dbOverride?: Database
) {
  const parsed = publicRegistrationSchema.parse(params.input);
  const portal = await getBrandPortalContext(params.brandSlug, dbOverride);
  if (!portal) {
    throw new AppError(404, "BRAND_PORTAL_NOT_FOUND", "Warranty portal not found.");
  }

  const purchaseDate = new Date(parsed.purchaseDate);
  if (Number.isNaN(purchaseDate.getTime()) || purchaseDate.getTime() > Date.now() + 86_400_000) {
    throw new AppError(422, "INVALID_PURCHASE_DATE", "Valid past or current purchase date is required.");
  }

  const normalizedSerial = parsed.serialNumber.toUpperCase();

  return withTenantDb(
    portal.brand.tenantId,
    async (tx) => {
      const [unit] = await tx
        .select()
        .from(serialUnits)
        .where(
          and(
            eq(serialUnits.tenantId, portal.brand.tenantId),
            eq(serialUnits.brandId, portal.brand.id),
            eq(serialUnits.serialNumber, normalizedSerial)
          )
        )
        .limit(1);

      if (!unit) {
        throw new AppError(
          404,
          "SERIAL_NOT_RECOGNIZED",
          "Serial number was not found in this brand's official registry."
        );
      }

      const existingReg = await tx
        .select({ id: warrantyRegistrations.id, status: warrantyRegistrations.status })
        .from(warrantyRegistrations)
        .where(
          and(
            eq(warrantyRegistrations.tenantId, portal.brand.tenantId),
            eq(warrantyRegistrations.serialUnitId, unit.id),
            ne(warrantyRegistrations.status, "REJECTED")
          )
        )
        .limit(1);

      if (existingReg.length > 0) {
        throw new AppError(
          409,
          "SERIAL_ALREADY_REGISTERED",
          "This serial number already has an active or pending warranty registration."
        );
      }

      // Check monthly registration plan quota
      const now = new Date();
      const periodYm = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
      const [sub] = await tx
        .select({ planCode: subscriptions.planCode, status: subscriptions.status })
        .from(subscriptions)
        .where(eq(subscriptions.tenantId, portal.brand.tenantId))
        .limit(1);

      if (sub && (sub.status === "CANCELED" || sub.status === "FAILED")) {
        throw new AppError(403, "SUBSCRIPTION_INACTIVE", "Brand portal subscription is inactive.");
      }

      const [usage] = await tx
        .select()
        .from(usageCounters)
        .where(
          and(
            eq(usageCounters.tenantId, portal.brand.tenantId),
            eq(usageCounters.periodYm, periodYm)
          )
        )
        .limit(1);

      const regLimit = PLAN_REG_LIMITS[sub?.planCode ?? "STARTER"] ?? 500;
      if ((usage?.registrationsCount ?? 0) >= regLimit) {
        throw new AppError(
          403,
          "PLAN_REGISTRATION_QUOTA_EXCEEDED",
          "Monthly warranty registration limit reached for this brand's plan."
        );
      }

      const policies = await tx
        .select()
        .from(warrantyPolicies)
        .where(
          and(
            eq(warrantyPolicies.tenantId, portal.brand.tenantId),
            eq(warrantyPolicies.productId, unit.productId)
          )
        );

      const chosenPolicy = selectApplicablePolicy(policies, {
        productId: unit.productId,
        regionCode: parsed.regionCode,
        salesChannel: parsed.salesChannel,
      });

      if (!chosenPolicy) {
        throw new AppError(
          422,
          "NO_APPLICABLE_POLICY",
          "No active warranty policy is configured for this product SKU."
        );
      }

      const evaluated = evaluateCoverageWindow({
        policy: chosenPolicy,
        purchaseDate,
        salesChannel: parsed.salesChannel,
      });

      const status = evaluated.requiresManualReview ? "PENDING_REVIEW" : "ACTIVE";
      const token = generateOpaqueToken("cd_cert");
      const regNum = `REG-${portal.brand.slug.toUpperCase().slice(0, 4)}-${now.getUTCFullYear()}-${randomBytes(3)
        .toString("hex")
        .toUpperCase()}`;

      const [created] = await tx
        .insert(warrantyRegistrations)
        .values({
          tenantId: portal.brand.tenantId,
          brandId: portal.brand.id,
          productId: unit.productId,
          serialUnitId: unit.id,
          policyId: chosenPolicy.id,
          registrationNumber: regNum,
          customerName: parsed.customerName,
          customerEmail: parsed.customerEmail.toLowerCase(),
          customerPhone: parsed.customerPhone,
          customerPinCode: parsed.customerPinCode,
          customerCity: parsed.customerCity,
          regionCode: parsed.regionCode,
          salesChannel: parsed.salesChannel,
          sourceMethod: parsed.sourceMethod,
          orderReference: parsed.orderReference || null,
          dealerName: parsed.dealerName || null,
          purchaseDate,
          coverageStartDate: evaluated.coverageStartDate,
          coverageEndDate: evaluated.coverageEndDate,
          status,
          reviewNotes: evaluated.requiresManualReview
            ? "Offline/dealer purchase queued for human receipt verification."
            : null,
          consentAcceptedAt: now,
          consentVersion: "dpdp-2026.1",
          certificateTokenHash: token.hash,
          certificateTokenPreview: token.preview,
          isDemo: portal.tenantIsDemo,
        })
        .returning();

      await tx
        .update(serialUnits)
        .set({ status: "REGISTERED" })
        .where(eq(serialUnits.id, unit.id));

      await tx
        .insert(usageCounters)
        .values({
          tenantId: portal.brand.tenantId,
          periodYm,
          registrationsCount: 1,
          claimsCount: 0,
          aiSummariesCount: 0,
        })
        .onConflictDoUpdate({
          target: [usageCounters.tenantId, usageCounters.periodYm],
          set: {
            registrationsCount: (usage?.registrationsCount ?? 0) + 1,
            updatedAt: now,
          },
        });

      await recordAuditLog(
        {
          tenantId: portal.brand.tenantId,
          actorRole: "PORTAL",
          action: "PORTAL_WARRANTY_REGISTERED",
          entityType: "REGISTRATION",
          entityId: created!.id,
          ipHash: params.ipHash,
          summary: `Registered serial ${unit.serialMasked} (${created!.registrationNumber}) with status ${status}.`,
        },
        tx
      );

      return {
        registration: created!,
        rawCertificateToken: token.raw,
        certificatePath: `/w/${portal.brand.slug}/certificate/${token.raw}`,
      };
    },
    dbOverride
  );
}

export async function getCertificateBySecureToken(
  params: { brandSlug: string; rawToken: string },
  dbOverride?: Database
) {
  if (!params.rawToken.startsWith("cd_cert_")) {
    return null;
  }
  const portal = await getBrandPortalContext(params.brandSlug, dbOverride);
  if (!portal) return null;

  const tokenHash = hashToken(params.rawToken);
  return withTenantDb(
    portal.brand.tenantId,
    async (tx) => {
      const rows = await tx
        .select({
          registrationNumber: warrantyRegistrations.registrationNumber,
          customerName: warrantyRegistrations.customerName,
          customerCity: warrantyRegistrations.customerCity,
          salesChannel: warrantyRegistrations.salesChannel,
          purchaseDate: warrantyRegistrations.purchaseDate,
          coverageStartDate: warrantyRegistrations.coverageStartDate,
          coverageEndDate: warrantyRegistrations.coverageEndDate,
          status: warrantyRegistrations.status,
          reviewNotes: warrantyRegistrations.reviewNotes,
          serialMasked: serialUnits.serialMasked,
          productSku: products.sku,
          productName: products.name,
          policyName: warrantyPolicies.name,
          coveredFaults: warrantyPolicies.coveredFaults,
          exclusionsNote: warrantyPolicies.exclusionsNote,
          isDemo: warrantyRegistrations.isDemo,
        })
        .from(warrantyRegistrations)
        .innerJoin(serialUnits, eq(warrantyRegistrations.serialUnitId, serialUnits.id))
        .innerJoin(products, eq(warrantyRegistrations.productId, products.id))
        .innerJoin(warrantyPolicies, eq(warrantyRegistrations.policyId, warrantyPolicies.id))
        .where(
          and(
            eq(warrantyRegistrations.tenantId, portal.brand.tenantId),
            eq(warrantyRegistrations.brandId, portal.brand.id),
            eq(warrantyRegistrations.certificateTokenHash, tokenHash),
            isNull(warrantyRegistrations.tokenRevokedAt),
            ne(warrantyRegistrations.status, "ERASED")
          )
        )
        .limit(1);

      const cert = rows[0];
      if (!cert) return null;

      return {
        brand: {
          name: portal.brand.name,
          slug: portal.brand.slug,
          supportEmail: portal.brand.supportEmail,
          hideCircuitdeskBadge: portal.brand.hideCircuitdeskBadge,
        },
        certificate: cert,
      };
    },
    dbOverride
  );
}

export async function listTenantRegistrations(
  session: AuthenticatedSession,
  dbOverride?: Database
) {
  const canUnmask = hasPermission(session.role, "serial:unmask");
  return withTenantDb(
    session.tenantId,
    async (tx) => {
      const rows = await tx
        .select({
          id: warrantyRegistrations.id,
          registrationNumber: warrantyRegistrations.registrationNumber,
          customerName: warrantyRegistrations.customerName,
          customerEmail: warrantyRegistrations.customerEmail,
          customerPinCode: warrantyRegistrations.customerPinCode,
          customerCity: warrantyRegistrations.customerCity,
          salesChannel: warrantyRegistrations.salesChannel,
          dealerName: warrantyRegistrations.dealerName,
          orderReference: warrantyRegistrations.orderReference,
          purchaseDate: warrantyRegistrations.purchaseDate,
          coverageEndDate: warrantyRegistrations.coverageEndDate,
          status: warrantyRegistrations.status,
          reviewNotes: warrantyRegistrations.reviewNotes,
          certificateTokenPreview: warrantyRegistrations.certificateTokenPreview,
          demoPublicToken: warrantyRegistrations.demoPublicToken,
          tokenRevokedAt: warrantyRegistrations.tokenRevokedAt,
          serialNumber: serialUnits.serialNumber,
          serialMasked: serialUnits.serialMasked,
          sku: products.sku,
          productName: products.name,
          brandSlug: brands.slug,
          createdAt: warrantyRegistrations.createdAt,
        })
        .from(warrantyRegistrations)
        .innerJoin(serialUnits, eq(warrantyRegistrations.serialUnitId, serialUnits.id))
        .innerJoin(products, eq(warrantyRegistrations.productId, products.id))
        .innerJoin(brands, eq(warrantyRegistrations.brandId, brands.id))
        .where(eq(warrantyRegistrations.tenantId, session.tenantId))
        .orderBy(desc(warrantyRegistrations.createdAt))
        .limit(200);

      return rows.map((r) => ({
        ...r,
        serialNumber: undefined,
        serialDisplay: canUnmask ? r.serialNumber : r.serialMasked,
      }));
    },
    dbOverride
  );
}

export async function reviewOrRevokeRegistration(
  session: AuthenticatedSession,
  params: {
    registrationId: string;
    action: "APPROVE" | "REJECT" | "REVOKE_TOKEN";
    notes?: string;
    ipHash?: string;
  },
  dbOverride?: Database
) {
  assertPermission(session.role, "registrations:review");

  return withTenantDb(
    session.tenantId,
    async (tx) => {
      const [existing] = await tx
        .select()
        .from(warrantyRegistrations)
        .where(
          and(
            eq(warrantyRegistrations.id, params.registrationId),
            eq(warrantyRegistrations.tenantId, session.tenantId)
          )
        )
        .limit(1);

      if (!existing) {
        throw new AppError(404, "REGISTRATION_NOT_FOUND", "Registration not found.");
      }

      const now = new Date();
      const patch =
        params.action === "APPROVE"
          ? { status: "ACTIVE" as const, reviewNotes: params.notes?.trim() || "Approved after receipt check." }
          : params.action === "REJECT"
            ? {
                status: "REJECTED" as const,
                reviewNotes: params.notes?.trim() || "Rejected during offline receipt review.",
                tokenRevokedAt: now,
              }
            : {
                status: "REVOKED" as const,
                tokenRevokedAt: now,
                reviewNotes: params.notes?.trim() || "Certificate token revoked by operator.",
              };

      const [updated] = await tx
        .update(warrantyRegistrations)
        .set(patch)
        .where(eq(warrantyRegistrations.id, existing.id))
        .returning();

      await recordAuditLog(
        {
          tenantId: session.tenantId,
          actorUserId: session.userId,
          actorRole: session.role,
          action: `REGISTRATION_${params.action}`,
          entityType: "REGISTRATION",
          entityId: existing.id,
          ipHash: params.ipHash,
          summary: `Updated registration ${existing.registrationNumber} -> ${updated!.status}.`,
        },
        tx
      );

      return updated!;
    },
    dbOverride
  );
}
