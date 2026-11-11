import { randomBytes } from "node:crypto";
import { and, desc, eq, gt, inArray, isNull } from "drizzle-orm";
import { z } from "zod";
import type { AuthenticatedSession } from "@/auth/session";
import type { Database } from "@/db/client";
import { withTenantDb } from "@/db/tenant";
import {
  automationRules,
  brands,
  claimEvents,
  claimEvidence,
  FAULT_CATEGORIES,
  products,
  repairOrders,
  rmaOrders,
  serialUnits,
  serviceCentres,
  subscriptions,
  usageCounters,
  warrantyClaims,
  warrantyPolicies,
  warrantyRegistrations,
} from "@/db/schema";
import { evaluateClaimSignals } from "@/domain/claim-signals";
import { routeServiceCentreByPinAndSkill } from "@/domain/pin-routing";
import { evaluateCoverageWindow, selectApplicablePolicy } from "@/domain/policy-engine";
import { computeClaimSlaDeadlines } from "@/domain/sla";
import { AppError } from "@/lib/errors";
import { assertPermission, hasPermission } from "@/security/rbac";
import { generateOpaqueToken, hashToken } from "@/security/tokens";
import { createSignedEvidenceUrl, storePrivateEvidence } from "@/storage/private-blobs";
import { recordAuditLog } from "./audit";
import { getBrandPortalContext } from "./registrations";

const PLAN_CLAIM_LIMITS: Record<string, number> = {
  STARTER: 50,
  GROWTH: 300,
  SCALE: 1500,
  ENTERPRISE: 100_000,
};

export const DECLINE_REASON_CODES = [
  "OUT_OF_WARRANTY_WINDOW",
  "PHYSICAL_OR_LIQUID_DAMAGE",
  "UNAUTHORIZED_MODIFICATION",
  "UNVERIFIED_PROOF_OF_PURCHASE",
  "DUPLICATE_CLAIM",
] as const;

export const publicClaimSchema = z.object({
  serialNumber: z.string().trim().min(4).max(40),
  submittedByType: z.enum(["CUSTOMER", "DEALER"]).default("CUSTOMER"),
  customerName: z.string().trim().min(2).max(100),
  customerEmail: z.string().trim().email().max(160),
  customerPhone: z.string().trim().min(7).max(24),
  shippingPinCode: z.string().trim().min(4).max(12),
  shippingCity: z.string().trim().min(2).max(80),
  shippingAddress: z.string().trim().min(6).max(300),
  faultCategory: z.enum(FAULT_CATEGORIES),
  symptomSummary: z.string().trim().min(6).max(160),
  customerDescription: z.string().trim().min(10).max(2000),
  purchaseDate: z.string().min(4),
});

export const humanAdjudicationSchema = z.object({
  decision: z.enum([
    "REQUEST_INFO",
    "APPROVE_REPAIR",
    "APPROVE_REPLACE",
    "APPROVE_REFUND",
    "DECLINE",
    "CLOSE",
  ]),
  decisionNotes: z.string().trim().min(4).max(1000),
  declineReasonCode: z.enum(DECLINE_REASON_CODES).optional(),
  refundAmountMinor: z.number().int().min(0).max(500_000_000).optional(),
  preferredServiceCentreId: z.string().uuid().optional(),
});

export async function submitPublicWarrantyClaim(
  params: {
    brandSlug: string;
    input: z.infer<typeof publicClaimSchema>;
    evidenceFile?: {
      fileName: string;
      mimeType: string;
      bytes: Buffer;
      kind: "RECEIPT" | "FAULT_PHOTO" | "SERIAL_PHOTO";
    } | null;
    ipHash?: string;
  },
  dbOverride?: Database
) {
  const parsed = publicClaimSchema.parse(params.input);
  const portal = await getBrandPortalContext(params.brandSlug, dbOverride);
  if (!portal) {
    throw new AppError(404, "BRAND_PORTAL_NOT_FOUND", "Brand warranty portal not found.");
  }

  const purchaseDate = new Date(parsed.purchaseDate);
  if (Number.isNaN(purchaseDate.getTime())) {
    throw new AppError(422, "INVALID_PURCHASE_DATE", "Valid purchase date is required.");
  }

  const normalizedSerial = parsed.serialNumber.toUpperCase();
  const normalizedEmail = parsed.customerEmail.toLowerCase();

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
          "Serial number not found in this brand's warranty registry."
        );
      }

      const now = new Date();
      const periodYm = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;

      const [sub] = await tx
        .select({ planCode: subscriptions.planCode, status: subscriptions.status })
        .from(subscriptions)
        .where(eq(subscriptions.tenantId, portal.brand.tenantId))
        .limit(1);

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

      const claimLimit = PLAN_CLAIM_LIMITS[sub?.planCode ?? "STARTER"] ?? 50;
      if ((usage?.claimsCount ?? 0) >= claimLimit) {
        throw new AppError(
          403,
          "PLAN_CLAIM_QUOTA_EXCEEDED",
          "Monthly warranty claims limit reached for this brand's plan."
        );
      }

      const [registration] = await tx
        .select()
        .from(warrantyRegistrations)
        .where(
          and(
            eq(warrantyRegistrations.tenantId, portal.brand.tenantId),
            eq(warrantyRegistrations.serialUnitId, unit.id)
          )
        )
        .orderBy(desc(warrantyRegistrations.createdAt))
        .limit(1);

      const policies = await tx
        .select()
        .from(warrantyPolicies)
        .where(
          and(
            eq(warrantyPolicies.tenantId, portal.brand.tenantId),
            eq(warrantyPolicies.productId, unit.productId)
          )
        );

      const policy = selectApplicablePolicy(policies, {
        productId: unit.productId,
        regionCode: registration?.regionCode ?? "IN",
        salesChannel: registration?.salesChannel ?? unit.salesChannel,
      });

      if (!policy) {
        throw new AppError(422, "POLICY_MISSING", "No active warranty policy found for SKU.");
      }

      const priorSerialClaims = await tx
        .select({ status: warrantyClaims.status })
        .from(warrantyClaims)
        .where(
          and(
            eq(warrantyClaims.tenantId, portal.brand.tenantId),
            eq(warrantyClaims.serialUnitId, unit.id)
          )
        );

      const openStatuses = new Set([
        "SUBMITTED",
        "NEEDS_INFO",
        "IN_TRIAGE",
        "APPROVED_REPAIR",
        "IN_REPAIR",
        "RMA_IN_TRANSIT",
      ]);
      const openClaimsOnSameSerial = priorSerialClaims.filter((c) =>
        openStatuses.has(c.status)
      ).length;
      const priorResolvedClaimsOnSameSerial = priorSerialClaims.filter(
        (c) => c.status === "RESOLVED" || c.status === "CLOSED"
      ).length;

      const thirtyDaysAgo = new Date(now.getTime() - 30 * 86_400_000);
      const recentContactClaims = await tx
        .select({ id: warrantyClaims.id })
        .from(warrantyClaims)
        .where(
          and(
            eq(warrantyClaims.tenantId, portal.brand.tenantId),
            eq(warrantyClaims.customerEmail, normalizedEmail),
            gt(warrantyClaims.createdAt, thirtyDaysAgo)
          )
        );

      const effectivePurchaseDate = registration?.purchaseDate ?? purchaseDate;
      const coverage = evaluateCoverageWindow({
        policy,
        purchaseDate: effectivePurchaseDate,
        evaluatedAt: now,
        salesChannel: registration?.salesChannel ?? unit.salesChannel,
        faultCategory: parsed.faultCategory,
        priorCompletedRepairsCount: priorResolvedClaimsOnSameSerial,
      });

      const duplicateSignals = evaluateClaimSignals({
        policySnapshot: coverage.snapshot,
        openClaimsOnSameSerial,
        priorResolvedClaimsOnSameSerial,
        recentClaimsFromSameEmail30d: recentContactClaims.length + 1,
        registrationStatus: registration?.status ?? null,
      });

      // Evaluate safe non-rejecting workflow automations (e.g. DOA priority tagging)
      const rules = await tx
        .select()
        .from(automationRules)
        .where(
          and(
            eq(automationRules.tenantId, portal.brand.tenantId),
            eq(automationRules.triggerEvent, "CLAIM_SUBMITTED"),
            eq(automationRules.enabled, true)
          )
        );

      let priority: "NORMAL" | "HIGH" | "URGENT" = coverage.snapshot.withinDoaWindow
        ? "HIGH"
        : "NORMAL";
      for (const rule of rules) {
        if (rule.actionType === "TAG_PRIORITY") {
          const condFault = rule.conditionJson.faultCategory;
          if (!condFault || condFault === parsed.faultCategory) {
            const p = rule.actionConfig.priority;
            if (p === "URGENT" || p === "HIGH") priority = p;
          }
        }
      }

      const sla = computeClaimSlaDeadlines({
        createdAt: now,
        priority,
        withinDoaWindow: coverage.snapshot.withinDoaWindow,
      });

      const token = generateOpaqueToken("cd_trk");
      const claimNumber = `CLM-${portal.brand.slug.toUpperCase().slice(0, 4)}-${now.getUTCFullYear()}-${randomBytes(3)
        .toString("hex")
        .toUpperCase()}`;

      const [created] = await tx
        .insert(warrantyClaims)
        .values({
          tenantId: portal.brand.tenantId,
          brandId: portal.brand.id,
          productId: unit.productId,
          serialUnitId: unit.id,
          registrationId: registration?.id ?? null,
          policyId: policy.id,
          claimNumber,
          submittedByType: parsed.submittedByType,
          customerName: parsed.customerName,
          customerEmail: normalizedEmail,
          customerPhone: parsed.customerPhone,
          shippingPinCode: parsed.shippingPinCode,
          shippingCity: parsed.shippingCity,
          shippingAddress: parsed.shippingAddress,
          faultCategory: parsed.faultCategory,
          symptomSummary: parsed.symptomSummary,
          customerDescription: parsed.customerDescription,
          purchaseDate: effectivePurchaseDate,
          status: "IN_TRIAGE",
          priority,
          resolutionType: "NONE",
          policySnapshot: coverage.snapshot,
          duplicateSignals,
          slaFirstResponseDueAt: sla.firstResponseDueAt,
          slaResolutionDueAt: sla.resolutionDueAt,
          trackingTokenHash: token.hash,
          trackingTokenPreview: token.preview,
          isDemo: portal.tenantIsDemo,
        })
        .returning();

      if (params.evidenceFile) {
        await storePrivateEvidence(
          {
            tenantId: portal.brand.tenantId,
            claimId: created!.id,
            registrationId: registration?.id ?? null,
            kind: params.evidenceFile.kind,
            fileName: params.evidenceFile.fileName,
            mimeType: params.evidenceFile.mimeType,
            bytes: params.evidenceFile.bytes,
            uploadedBy: normalizedEmail,
          },
          tx
        );
      }

      await tx.insert(claimEvents).values({
        tenantId: portal.brand.tenantId,
        claimId: created!.id,
        actorType: "CUSTOMER",
        eventType: "CLAIM_SUBMITTED",
        message: `Claim submitted under fault category ${parsed.faultCategory}; queued for human triage.`,
        visibility: "PUBLIC",
      });

      await tx
        .update(serialUnits)
        .set({ status: "CLAIMED" })
        .where(eq(serialUnits.id, unit.id));

      await tx
        .insert(usageCounters)
        .values({
          tenantId: portal.brand.tenantId,
          periodYm,
          registrationsCount: 0,
          claimsCount: 1,
          aiSummariesCount: 0,
        })
        .onConflictDoUpdate({
          target: [usageCounters.tenantId, usageCounters.periodYm],
          set: {
            claimsCount: (usage?.claimsCount ?? 0) + 1,
            updatedAt: now,
          },
        });

      await recordAuditLog(
        {
          tenantId: portal.brand.tenantId,
          actorRole: "PORTAL",
          action: "PORTAL_CLAIM_SUBMITTED",
          entityType: "CLAIM",
          entityId: created!.id,
          ipHash: params.ipHash,
          summary: `Submitted claim ${created!.claimNumber} (${parsed.faultCategory}) for ${unit.serialMasked}.`,
        },
        tx
      );

      return {
        claim: created!,
        rawTrackingToken: token.raw,
        trackingPath: `/w/${portal.brand.slug}/track/${token.raw}`,
      };
    },
    dbOverride
  );
}

export async function getPublicClaimTracker(
  params: { brandSlug: string; rawToken: string },
  dbOverride?: Database
) {
  if (!params.rawToken.startsWith("cd_trk_")) {
    return null;
  }
  const portal = await getBrandPortalContext(params.brandSlug, dbOverride);
  if (!portal) return null;

  const tokenHash = hashToken(params.rawToken);
  return withTenantDb(
    portal.brand.tenantId,
    async (tx) => {
      const claimRows = await tx
        .select({
          id: warrantyClaims.id,
          claimNumber: warrantyClaims.claimNumber,
          faultCategory: warrantyClaims.faultCategory,
          symptomSummary: warrantyClaims.symptomSummary,
          status: warrantyClaims.status,
          resolutionType: warrantyClaims.resolutionType,
          declineReasonCode: warrantyClaims.declineReasonCode,
          decisionNotes: warrantyClaims.decisionNotes,
          slaResolutionDueAt: warrantyClaims.slaResolutionDueAt,
          createdAt: warrantyClaims.createdAt,
          serialMasked: serialUnits.serialMasked,
          productSku: products.sku,
          productName: products.name,
          isDemo: warrantyClaims.isDemo,
        })
        .from(warrantyClaims)
        .innerJoin(serialUnits, eq(warrantyClaims.serialUnitId, serialUnits.id))
        .innerJoin(products, eq(warrantyClaims.productId, products.id))
        .where(
          and(
            eq(warrantyClaims.tenantId, portal.brand.tenantId),
            eq(warrantyClaims.brandId, portal.brand.id),
            eq(warrantyClaims.trackingTokenHash, tokenHash),
            isNull(warrantyClaims.tokenRevokedAt)
          )
        )
        .limit(1);

      const claim = claimRows[0];
      if (!claim) return null;

      const events = await tx
        .select({
          id: claimEvents.id,
          eventType: claimEvents.eventType,
          message: claimEvents.message,
          createdAt: claimEvents.createdAt,
        })
        .from(claimEvents)
        .where(
          and(
            eq(claimEvents.tenantId, portal.brand.tenantId),
            eq(claimEvents.claimId, claim.id),
            eq(claimEvents.visibility, "PUBLIC")
          )
        )
        .orderBy(desc(claimEvents.createdAt));

      const [repair] = await tx
        .select({
          jobNumber: repairOrders.jobNumber,
          stage: repairOrders.stage,
          centreName: serviceCentres.name,
          centreCity: serviceCentres.city,
          returnCarrier: repairOrders.returnCarrier,
          returnTrackingNumber: repairOrders.returnTrackingNumber,
          slaDueAt: repairOrders.slaDueAt,
        })
        .from(repairOrders)
        .innerJoin(serviceCentres, eq(repairOrders.serviceCentreId, serviceCentres.id))
        .where(
          and(
            eq(repairOrders.tenantId, portal.brand.tenantId),
            eq(repairOrders.claimId, claim.id)
          )
        )
        .limit(1);

      const [rma] = await tx
        .select({
          rmaNumber: rmaOrders.rmaNumber,
          carrierMode: rmaOrders.carrierMode,
          carrierName: rmaOrders.carrierName,
          trackingNumber: rmaOrders.trackingNumber,
          status: rmaOrders.status,
        })
        .from(rmaOrders)
        .where(
          and(eq(rmaOrders.tenantId, portal.brand.tenantId), eq(rmaOrders.claimId, claim.id))
        )
        .limit(1);

      return {
        brand: {
          name: portal.brand.name,
          slug: portal.brand.slug,
          supportEmail: portal.brand.supportEmail,
          hideCircuitdeskBadge: portal.brand.hideCircuitdeskBadge,
        },
        claim,
        repair: repair ?? null,
        rma: rma ?? null,
        events,
      };
    },
    dbOverride
  );
}

export async function listTenantClaims(session: AuthenticatedSession, dbOverride?: Database) {
  const canUnmask = hasPermission(session.role, "serial:unmask");
  return withTenantDb(
    session.tenantId,
    async (tx) => {
      const rows = await tx
        .select({
          id: warrantyClaims.id,
          claimNumber: warrantyClaims.claimNumber,
          customerName: warrantyClaims.customerName,
          customerEmail: warrantyClaims.customerEmail,
          shippingPinCode: warrantyClaims.shippingPinCode,
          shippingCity: warrantyClaims.shippingCity,
          faultCategory: warrantyClaims.faultCategory,
          symptomSummary: warrantyClaims.symptomSummary,
          status: warrantyClaims.status,
          priority: warrantyClaims.priority,
          resolutionType: warrantyClaims.resolutionType,
          duplicateSignals: warrantyClaims.duplicateSignals,
          slaFirstResponseDueAt: warrantyClaims.slaFirstResponseDueAt,
          slaResolutionDueAt: warrantyClaims.slaResolutionDueAt,
          firstRespondedAt: warrantyClaims.firstRespondedAt,
          resolvedAt: warrantyClaims.resolvedAt,
          demoPublicToken: warrantyClaims.demoPublicToken,
          createdAt: warrantyClaims.createdAt,
          serialNumber: serialUnits.serialNumber,
          serialMasked: serialUnits.serialMasked,
          sku: products.sku,
          productName: products.name,
          brandSlug: brands.slug,
        })
        .from(warrantyClaims)
        .innerJoin(serialUnits, eq(warrantyClaims.serialUnitId, serialUnits.id))
        .innerJoin(products, eq(warrantyClaims.productId, products.id))
        .innerJoin(brands, eq(warrantyClaims.brandId, brands.id))
        .where(eq(warrantyClaims.tenantId, session.tenantId))
        .orderBy(desc(warrantyClaims.createdAt))
        .limit(200);

      return rows.map((row) => ({
        ...row,
        serialNumber: undefined,
        serialDisplay: canUnmask ? row.serialNumber : row.serialMasked,
      }));
    },
    dbOverride
  );
}

export async function getTenantClaimDetail(
  session: AuthenticatedSession,
  claimId: string,
  dbOverride?: Database
) {
  const canUnmask = hasPermission(session.role, "serial:unmask");
  return withTenantDb(
    session.tenantId,
    async (tx) => {
      const found = await tx
        .select({
          claim: warrantyClaims,
          serialNumber: serialUnits.serialNumber,
          serialMasked: serialUnits.serialMasked,
          product: products,
          brand: brands,
        })
        .from(warrantyClaims)
        .innerJoin(serialUnits, eq(warrantyClaims.serialUnitId, serialUnits.id))
        .innerJoin(products, eq(warrantyClaims.productId, products.id))
        .innerJoin(brands, eq(warrantyClaims.brandId, brands.id))
        .where(
          and(eq(warrantyClaims.id, claimId), eq(warrantyClaims.tenantId, session.tenantId))
        )
        .limit(1);

      const entry = found[0];
      if (!entry) {
        throw new AppError(404, "CLAIM_NOT_FOUND", "Claim not found in this workspace.");
      }

      const evidenceRows = await tx
        .select()
        .from(claimEvidence)
        .where(
          and(
            eq(claimEvidence.tenantId, session.tenantId),
            eq(claimEvidence.claimId, entry.claim.id)
          )
        )
        .orderBy(desc(claimEvidence.createdAt));

      const events = await tx
        .select()
        .from(claimEvents)
        .where(
          and(
            eq(claimEvents.tenantId, session.tenantId),
            eq(claimEvents.claimId, entry.claim.id)
          )
        )
        .orderBy(desc(claimEvents.createdAt));

      const repairs = await tx
        .select()
        .from(repairOrders)
        .where(
          and(
            eq(repairOrders.tenantId, session.tenantId),
            eq(repairOrders.claimId, entry.claim.id)
          )
        );

      const rmas = await tx
        .select()
        .from(rmaOrders)
        .where(
          and(eq(rmaOrders.tenantId, session.tenantId), eq(rmaOrders.claimId, entry.claim.id))
        );

      const centres = await tx
        .select()
        .from(serviceCentres)
        .where(eq(serviceCentres.tenantId, session.tenantId));

      return {
        claim: entry.claim,
        serialDisplay: canUnmask ? entry.serialNumber : entry.serialMasked,
        product: entry.product,
        brand: entry.brand,
        evidence: evidenceRows.map((ev) => ({
          ...ev,
          signedDownloadUrl: createSignedEvidenceUrl({
            tenantId: session.tenantId,
            evidenceId: ev.id,
          }),
        })),
        events,
        repairs,
        rmas,
        centres,
      };
    },
    dbOverride
  );
}

export async function adjudicateClaimByHuman(
  session: AuthenticatedSession,
  claimId: string,
  input: z.infer<typeof humanAdjudicationSchema>,
  ipHash?: string,
  dbOverride?: Database
) {
  assertPermission(session.role, "claims:adjudicate");
  const parsed = humanAdjudicationSchema.parse(input);

  if (parsed.decision === "DECLINE" && !parsed.declineReasonCode) {
    throw new AppError(
      422,
      "DECLINE_REASON_REQUIRED",
      "Declining a warranty claim requires an explicit structured decline reason code."
    );
  }

  return withTenantDb(
    session.tenantId,
    async (tx) => {
      const [claim] = await tx
        .select()
        .from(warrantyClaims)
        .where(and(eq(warrantyClaims.id, claimId), eq(warrantyClaims.tenantId, session.tenantId)))
        .limit(1);

      if (!claim) {
        throw new AppError(404, "CLAIM_NOT_FOUND", "Claim not found.");
      }

      const [prod] = await tx
        .select()
        .from(products)
        .where(eq(products.id, claim.productId))
        .limit(1);

      const now = new Date();
      const firstRespondedAt = claim.firstRespondedAt ?? now;

      if (parsed.decision === "REQUEST_INFO") {
        const [updated] = await tx
          .update(warrantyClaims)
          .set({
            status: "NEEDS_INFO",
            decisionNotes: parsed.decisionNotes,
            firstRespondedAt,
          })
          .where(eq(warrantyClaims.id, claim.id))
          .returning();

        await tx.insert(claimEvents).values({
          tenantId: session.tenantId,
          claimId: claim.id,
          actorType: "USER",
          actorUserId: session.userId,
          eventType: "INFO_REQUESTED",
          message: `Support requested additional evidence: ${parsed.decisionNotes}`,
          visibility: "PUBLIC",
        });

        await recordAuditLog(
          {
            tenantId: session.tenantId,
            actorUserId: session.userId,
            actorRole: session.role,
            action: "CLAIM_REQUEST_INFO",
            entityType: "CLAIM",
            entityId: claim.id,
            ipHash,
            summary: `Requested additional evidence on ${claim.claimNumber}.`,
          },
          tx
        );
        return { claim: updated!, repairOrder: null, rmaOrder: null };
      }

      if (parsed.decision === "APPROVE_REPAIR") {
        const centres = await tx
          .select()
          .from(serviceCentres)
          .where(eq(serviceCentres.tenantId, session.tenantId));

        const chosenOverride = parsed.preferredServiceCentreId
          ? centres.find((c) => c.id === parsed.preferredServiceCentreId && c.active)
          : undefined;

        const routed = chosenOverride
          ? {
              selected: chosenOverride,
              routingReason: `Operator-assigned service centre (${chosenOverride.name})`,
            }
          : routeServiceCentreByPinAndSkill({
              centres,
              customerPinCode: claim.shippingPinCode,
              productCategory: prod?.category ?? "AUDIO",
            });

        if (!routed.selected) {
          throw new AppError(
            422,
            "NO_ELIGIBLE_SERVICE_CENTRE",
            routed.routingReason
          );
        }

        const jobNumber = `JOB-${routed.selected.code.slice(0, 3)}-${now.getUTCFullYear()}-${randomBytes(2)
          .toString("hex")
          .toUpperCase()}`;

        const [createdRepair] = await tx
          .insert(repairOrders)
          .values({
            tenantId: session.tenantId,
            claimId: claim.id,
            serviceCentreId: routed.selected.id,
            jobNumber,
            routingReason: routed.routingReason,
            stage: "ROUTED",
            slaDueAt: claim.slaResolutionDueAt,
            isDemo: session.isDemoTenant,
          })
          .returning();

        await tx
          .update(serviceCentres)
          .set({ activeRepairsCount: routed.selected.activeRepairsCount + 1 })
          .where(eq(serviceCentres.id, routed.selected.id));

        const rmaNum = `RMA-${now.getUTCFullYear()}-${randomBytes(3).toString("hex").toUpperCase()}`;
        const [createdRma] = await tx
          .insert(rmaOrders)
          .values({
            tenantId: session.tenantId,
            claimId: claim.id,
            rmaNumber: rmaNum,
            direction: "INBOUND_DEFECTIVE",
            carrierMode: "MANUAL",
            carrierName: `Inbound to ${routed.selected.name} (${routed.selected.city})`,
            disposition: "REPAIR_RETURN",
            status: "ISSUED",
            isDemo: session.isDemoTenant,
          })
          .returning();

        const [updated] = await tx
          .update(warrantyClaims)
          .set({
            status: "IN_REPAIR",
            resolutionType: "REPAIR",
            decisionNotes: parsed.decisionNotes,
            decidedByUserId: session.userId,
            decidedAt: now,
            firstRespondedAt,
          })
          .where(eq(warrantyClaims.id, claim.id))
          .returning();

        await tx.insert(claimEvents).values({
          tenantId: session.tenantId,
          claimId: claim.id,
          actorType: "USER",
          actorUserId: session.userId,
          eventType: "APPROVED_REPAIR",
          message: `Approved for repair (${jobNumber}). ${routed.routingReason}.`,
          visibility: "PUBLIC",
        });

        await recordAuditLog(
          {
            tenantId: session.tenantId,
            actorUserId: session.userId,
            actorRole: session.role,
            action: "CLAIM_APPROVED_REPAIR",
            entityType: "CLAIM",
            entityId: claim.id,
            ipHash,
            summary: `Approved ${claim.claimNumber} for bench repair ${jobNumber}.`,
          },
          tx
        );

        return { claim: updated!, repairOrder: createdRepair!, rmaOrder: createdRma! };
      }

      if (parsed.decision === "APPROVE_REPLACE") {
        const [replacementStock] = await tx
          .select()
          .from(serialUnits)
          .where(
            and(
              eq(serialUnits.tenantId, session.tenantId),
              eq(serialUnits.productId, claim.productId),
              inArray(serialUnits.status, ["IN_STOCK"])
            )
          )
          .limit(1);

        if (replacementStock) {
          await tx
            .update(serialUnits)
            .set({ status: "SOLD", soldAt: now })
            .where(eq(serialUnits.id, replacementStock.id));
        }

        await tx
          .update(serialUnits)
          .set({ status: "REPLACED" })
          .where(eq(serialUnits.id, claim.serialUnitId));

        const rmaNum = `RMA-${now.getUTCFullYear()}-${randomBytes(3).toString("hex").toUpperCase()}`;
        const [createdRma] = await tx
          .insert(rmaOrders)
          .values({
            tenantId: session.tenantId,
            claimId: claim.id,
            rmaNumber: rmaNum,
            direction: "OUTBOUND_REPLACEMENT",
            carrierMode: "MANUAL",
            carrierName: "Warranty Replacement Challan (Zero GST per CBIC 195/2023)",
            replacementSerialId: replacementStock?.id ?? null,
            disposition: "RETURN_TO_VENDOR",
            supplierRecoveryMinor: prod?.unitCostMinor ?? 0,
            status: "ISSUED",
            isDemo: session.isDemoTenant,
          })
          .returning();

        const [updated] = await tx
          .update(warrantyClaims)
          .set({
            status: "APPROVED_REPLACE",
            resolutionType: "REPLACE",
            decisionNotes: parsed.decisionNotes,
            decidedByUserId: session.userId,
            decidedAt: now,
            firstRespondedAt,
            replacementUnitCostMinor: prod?.unitCostMinor ?? 0,
          })
          .where(eq(warrantyClaims.id, claim.id))
          .returning();

        await tx.insert(claimEvents).values({
          tenantId: session.tenantId,
          claimId: claim.id,
          actorType: "USER",
          actorUserId: session.userId,
          eventType: "APPROVED_REPLACE",
          message: `Approved zero-cost warranty replacement (${rmaNum}).`,
          visibility: "PUBLIC",
        });

        await recordAuditLog(
          {
            tenantId: session.tenantId,
            actorUserId: session.userId,
            actorRole: session.role,
            action: "CLAIM_APPROVED_REPLACE",
            entityType: "CLAIM",
            entityId: claim.id,
            ipHash,
            summary: `Approved replacement ${rmaNum} on ${claim.claimNumber}.`,
          },
          tx
        );

        return { claim: updated!, repairOrder: null, rmaOrder: createdRma! };
      }

      if (parsed.decision === "APPROVE_REFUND") {
        const refundMinor = parsed.refundAmountMinor ?? prod?.retailPriceMinor ?? 0;
        const [updated] = await tx
          .update(warrantyClaims)
          .set({
            status: "APPROVED_REFUND",
            resolutionType: "REFUND",
            refundAmountMinor: refundMinor,
            decisionNotes: parsed.decisionNotes,
            decidedByUserId: session.userId,
            decidedAt: now,
            firstRespondedAt,
            resolvedAt: now,
          })
          .where(eq(warrantyClaims.id, claim.id))
          .returning();

        await tx.insert(claimEvents).values({
          tenantId: session.tenantId,
          claimId: claim.id,
          actorType: "USER",
          actorUserId: session.userId,
          eventType: "APPROVED_REFUND",
          message: `Approved refund authorization: ${parsed.decisionNotes}`,
          visibility: "PUBLIC",
        });

        await recordAuditLog(
          {
            tenantId: session.tenantId,
            actorUserId: session.userId,
            actorRole: session.role,
            action: "CLAIM_APPROVED_REFUND",
            entityType: "CLAIM",
            entityId: claim.id,
            ipHash,
            summary: `Authorized refund (${refundMinor} minor units) on ${claim.claimNumber}.`,
          },
          tx
        );

        return { claim: updated!, repairOrder: null, rmaOrder: null };
      }

      if (parsed.decision === "DECLINE") {
        const [updated] = await tx
          .update(warrantyClaims)
          .set({
            status: "DECLINED",
            resolutionType: "DECLINED",
            declineReasonCode: parsed.declineReasonCode!,
            decisionNotes: parsed.decisionNotes,
            decidedByUserId: session.userId,
            decidedAt: now,
            firstRespondedAt,
            resolvedAt: now,
          })
          .where(eq(warrantyClaims.id, claim.id))
          .returning();

        await tx.insert(claimEvents).values({
          tenantId: session.tenantId,
          claimId: claim.id,
          actorType: "USER",
          actorUserId: session.userId,
          eventType: "CLAIM_DECLINED",
          message: `Claim declined (${parsed.declineReasonCode}): ${parsed.decisionNotes}`,
          visibility: "PUBLIC",
        });

        await recordAuditLog(
          {
            tenantId: session.tenantId,
            actorUserId: session.userId,
            actorRole: session.role,
            action: "CLAIM_DECLINED_HUMAN",
            entityType: "CLAIM",
            entityId: claim.id,
            ipHash,
            summary: `Declined ${claim.claimNumber} (${parsed.declineReasonCode}).`,
          },
          tx
        );

        return { claim: updated!, repairOrder: null, rmaOrder: null };
      }

      // CLOSE
      const [updated] = await tx
        .update(warrantyClaims)
        .set({
          status: "CLOSED",
          decisionNotes: parsed.decisionNotes,
          resolvedAt: claim.resolvedAt ?? now,
        })
        .where(eq(warrantyClaims.id, claim.id))
        .returning();

      await tx.insert(claimEvents).values({
        tenantId: session.tenantId,
        claimId: claim.id,
        actorType: "USER",
        actorUserId: session.userId,
        eventType: "CLAIM_CLOSED",
        message: `Claim closed: ${parsed.decisionNotes}`,
        visibility: "PUBLIC",
      });

      await recordAuditLog(
        {
          tenantId: session.tenantId,
          actorUserId: session.userId,
          actorRole: session.role,
          action: "CLAIM_CLOSED",
          entityType: "CLAIM",
          entityId: claim.id,
          ipHash,
          summary: `Closed claim ${claim.claimNumber}.`,
        },
        tx
      );

      return { claim: updated!, repairOrder: null, rmaOrder: null };
    },
    dbOverride
  );
}
