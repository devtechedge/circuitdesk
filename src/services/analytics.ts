import { and, eq, gte } from "drizzle-orm";
import type { AuthenticatedSession } from "@/auth/session";
import type { Database } from "@/db/client";
import { withTenantDb } from "@/db/tenant";
import {
  type FaultCategory,
  productionBatches,
  products,
  repairOrders,
  repairPartUsages,
  rmaOrders,
  serialUnits,
  serviceCentres,
  spareParts,
  tenants,
  warrantyClaims,
  warrantyRegistrations,
} from "@/db/schema";
import {
  renderAscReimbursementGstCsv,
  renderOemWarrantyReplacementGstCsv,
} from "@/domain/gst-export";
import { assertPermission } from "@/security/rbac";

export type AnalyticsWindow = "30d" | "90d" | "365d" | "all";

function resolveStartDate(window: AnalyticsWindow, now: Date): Date | null {
  if (window === "30d") return new Date(now.getTime() - 30 * 86_400_000);
  if (window === "90d") return new Date(now.getTime() - 90 * 86_400_000);
  if (window === "365d") return new Date(now.getTime() - 365 * 86_400_000);
  return null;
}

export async function computeTenantAnalytics(
  session: AuthenticatedSession,
  options?: { window?: AnalyticsWindow; includeDemoRowsInDemoWorkspace?: boolean },
  dbOverride?: Database
) {
  assertPermission(session.role, "analytics:read");
  const windowKey: AnalyticsWindow = options?.window ?? "90d";
  const now = new Date();
  const startDate = resolveStartDate(windowKey, now);

  // Live workspaces ALWAYS exclude demo rows; demo workspaces only show demo rows when explicitly viewing the synthetic dataset
  const allowDemo =
    session.isDemoTenant && (options?.includeDemoRowsInDemoWorkspace ?? true);

  return withTenantDb(
    session.tenantId,
    async (tx) => {
      const allSerials = await tx
        .select()
        .from(serialUnits)
        .where(eq(serialUnits.tenantId, session.tenantId));

      const allRegs = await tx
        .select()
        .from(warrantyRegistrations)
        .where(eq(warrantyRegistrations.tenantId, session.tenantId));

      const allClaims = await tx
        .select()
        .from(warrantyClaims)
        .where(eq(warrantyClaims.tenantId, session.tenantId));

      const allRepairs = await tx
        .select()
        .from(repairOrders)
        .where(eq(repairOrders.tenantId, session.tenantId));

      const allRmas = await tx
        .select()
        .from(rmaOrders)
        .where(eq(rmaOrders.tenantId, session.tenantId));

      const tenantProducts = await tx
        .select()
        .from(products)
        .where(eq(products.tenantId, session.tenantId));

      const tenantBatches = await tx
        .select()
        .from(productionBatches)
        .where(eq(productionBatches.tenantId, session.tenantId));

      const centres = await tx
        .select()
        .from(serviceCentres)
        .where(eq(serviceCentres.tenantId, session.tenantId));

      const partUsages = await tx
        .select({
          quantity: repairPartUsages.quantity,
          unitCostMinor: repairPartUsages.unitCostMinor,
          partSku: spareParts.partSku,
          partName: spareParts.name,
        })
        .from(repairPartUsages)
        .innerJoin(spareParts, eq(repairPartUsages.sparePartId, spareParts.id))
        .where(eq(repairPartUsages.tenantId, session.tenantId));

      const inScopeSerials = allSerials.filter((s) => (allowDemo ? true : !s.isDemo));
      const inScopeRegs = allRegs.filter(
        (r) =>
          (allowDemo ? true : !r.isDemo) &&
          (!startDate || r.createdAt.getTime() >= startDate.getTime())
      );
      const inScopeClaims = allClaims.filter(
        (c) =>
          (allowDemo ? true : !c.isDemo) &&
          (!startDate || c.createdAt.getTime() >= startDate.getTime())
      );
      const inScopeRepairs = allRepairs.filter(
        (r) =>
          (allowDemo ? true : !r.isDemo) &&
          (!startDate || r.createdAt.getTime() >= startDate.getTime())
      );
      const inScopeRmas = allRmas.filter((r) => (allowDemo ? true : !r.isDemo));

      const shippedOrRegisteredUnits = Math.max(
        inScopeSerials.filter((s) => s.status !== "IN_STOCK").length,
        inScopeRegs.length
      );

      const claimsPer1000Units =
        shippedOrRegisteredUnits > 0
          ? Number(((inScopeClaims.length / shippedOrRegisteredUnits) * 1000).toFixed(1))
          : 0;

      const faultCounts: Record<FaultCategory, number> = {
        DOA: 0,
        BATTERY: 0,
        CHARGING: 0,
        CONNECTIVITY: 0,
        PHYSICAL_DAMAGE: 0,
        MISSING_PARTS: 0,
        SOFTWARE_FIRMWARE: 0,
      };
      for (const c of inScopeClaims) {
        faultCounts[c.faultCategory] += 1;
      }

      const doaCount = faultCounts.DOA;
      const doaSharePct =
        inScopeClaims.length > 0 ? Number(((doaCount / inScopeClaims.length) * 100).toFixed(1)) : 0;

      // Response & resolution turnaround hours + SLA compliance
      let responseSumHours = 0;
      let responseMeasured = 0;
      let resolutionSumHours = 0;
      let resolutionMeasured = 0;
      let slaMetCount = 0;
      let slaEvaluatedCount = 0;

      for (const c of inScopeClaims) {
        if (c.firstRespondedAt) {
          responseSumHours +=
            Math.max(0, c.firstRespondedAt.getTime() - c.createdAt.getTime()) / 3_600_000;
          responseMeasured += 1;
        }
        if (c.resolvedAt) {
          resolutionSumHours +=
            Math.max(0, c.resolvedAt.getTime() - c.createdAt.getTime()) / 3_600_000;
          resolutionMeasured += 1;
          slaEvaluatedCount += 1;
          if (c.resolvedAt.getTime() <= c.slaResolutionDueAt.getTime()) {
            slaMetCount += 1;
          }
        } else if (now.getTime() > c.slaResolutionDueAt.getTime()) {
          slaEvaluatedCount += 1;
        }
      }

      const avgFirstResponseHours =
        responseMeasured > 0 ? Number((responseSumHours / responseMeasured).toFixed(1)) : null;
      const avgResolutionHours =
        resolutionMeasured > 0
          ? Number((resolutionSumHours / resolutionMeasured).toFixed(1))
          : null;
      const slaCompliancePct =
        slaEvaluatedCount > 0 ? Number(((slaMetCount / slaEvaluatedCount) * 100).toFixed(1)) : 100;

      // Fully-loaded resolution cost (parts + labour + freight + replacements + refunds - supplier recovery)
      let repairCostMinor = 0;
      for (const rep of inScopeRepairs) {
        repairCostMinor += rep.labourCostMinor + rep.partsCostMinor + rep.freightCostMinor;
      }
      let replacementAndRefundMinor = 0;
      for (const c of inScopeClaims) {
        replacementAndRefundMinor += c.replacementUnitCostMinor + c.refundAmountMinor;
      }
      let supplierRecoveryMinor = 0;
      for (const rma of inScopeRmas) {
        supplierRecoveryMinor += rma.supplierRecoveryMinor;
      }
      const grossWarrantyCostMinor = repairCostMinor + replacementAndRefundMinor;
      const netWarrantyCostMinor = Math.max(0, grossWarrantyCostMinor - supplierRecoveryMinor);

      // Repeat claims on same serial
      const claimsBySerial = new Map<string, number>();
      for (const c of inScopeClaims) {
        claimsBySerial.set(c.serialUnitId, (claimsBySerial.get(c.serialUnitId) ?? 0) + 1);
      }
      const repeatSerialsCount = Array.from(claimsBySerial.values()).filter((n) => n > 1).length;

      // Upcoming 60-day coverage expiry cohort
      const sixtyDaysAhead = new Date(now.getTime() + 60 * 86_400_000);
      const expiringSoon60dCount = allRegs.filter(
        (r) =>
          (allowDemo ? true : !r.isDemo) &&
          r.status === "ACTIVE" &&
          r.coverageEndDate.getTime() >= now.getTime() &&
          r.coverageEndDate.getTime() <= sixtyDaysAhead.getTime()
      ).length;

      // SKU Failure Leaderboard
      const serialById = new Map(inScopeSerials.map((s) => [s.id, s]));
      const skuFailureRows = tenantProducts.map((prod) => {
        const skuUnits = inScopeSerials.filter(
          (s) => s.productId === prod.id && s.status !== "IN_STOCK"
        ).length;
        const skuClaims = inScopeClaims.filter((c) => c.productId === prod.id);
        const skuCostMinor = skuClaims.reduce(
          (acc, c) => acc + c.replacementUnitCostMinor + c.refundAmountMinor,
          0
        );
        return {
          productId: prod.id,
          sku: prod.sku,
          name: prod.name,
          shippedUnits: skuUnits,
          claimsCount: skuClaims.length,
          claimsPer1000:
            skuUnits > 0 ? Number(((skuClaims.length / skuUnits) * 1000).toFixed(1)) : 0,
          directCostMinor: skuCostMinor,
        };
      });

      // Batch & Supplier Failure Leaderboard
      const batchFailureRows = tenantBatches
        .filter((b) => (allowDemo ? true : !b.isDemo))
        .map((batch) => {
          const batchClaimCount = inScopeClaims.filter((c) => {
            const unit = serialById.get(c.serialUnitId);
            return unit?.batchId === batch.id;
          }).length;
          const trackedSerialsInBatch = inScopeSerials.filter(
            (s) => s.batchId === batch.id
          ).length;
          const denominator = Math.max(batch.unitCount, trackedSerialsInBatch, 1);
          return {
            batchId: batch.id,
            batchCode: batch.batchCode,
            lotNumber: batch.lotNumber,
            supplierName: batch.supplierName,
            manufacturedAt: batch.manufacturedAt,
            batchUnits: denominator,
            claimsCount: batchClaimCount,
            failureRatePer1000: Number(((batchClaimCount / denominator) * 1000).toFixed(2)),
          };
        })
        .sort((a, b) => b.claimsCount - a.claimsCount);

      // Service Centre Load
      const centreLoad = centres.map((c) => ({
        id: c.id,
        code: c.code,
        name: c.name,
        city: c.city,
        centreType: c.centreType,
        activeRepairs: c.activeRepairsCount,
        maxCapacity: c.maxActiveRepairs,
        utilizationPct: Math.round((c.activeRepairsCount / Math.max(c.maxActiveRepairs, 1)) * 100),
      }));

      // Parts Burn Aggregation
      const partBurnMap = new Map<
        string,
        { partSku: string; partName: string; unitsConsumed: number; totalCostMinor: number }
      >();
      for (const u of partUsages) {
        const cur = partBurnMap.get(u.partSku) ?? {
          partSku: u.partSku,
          partName: u.partName,
          unitsConsumed: 0,
          totalCostMinor: 0,
        };
        cur.unitsConsumed += u.quantity;
        cur.totalCostMinor += u.quantity * u.unitCostMinor;
        partBurnMap.set(u.partSku, cur);
      }

      return {
        meta: {
          window: windowKey,
          rangeLabel: startDate
            ? `${startDate.toISOString().slice(0, 10)} to ${now.toISOString().slice(0, 10)} (UTC)`
            : `All recorded history through ${now.toISOString().slice(0, 10)} (UTC)`,
          currency: session.tenantCurrency,
          demoRowsExcluded: !allowDemo,
          datasetBadge: allowDemo
            ? "Synthetic Demo Workspace Data (Never Mixed Into Live Benchmarks)"
            : "Live Tenant Production Data (Synthetic Demo Rows Strictly Excluded)",
        },
        headline: {
          registrationsCount: inScopeRegs.length,
          shippedUnitsDenominator: shippedOrRegisteredUnits,
          claimsCount: inScopeClaims.length,
          claimsPer1000Units,
          doaCount,
          doaSharePct,
          avgFirstResponseHours,
          avgResolutionHours,
          slaCompliancePct,
          grossWarrantyCostMinor,
          supplierRecoveryMinor,
          netWarrantyCostMinor,
          repeatSerialsCount,
          expiringSoon60dCount,
        },
        faultBreakdown: faultCounts,
        skuFailures: skuFailureRows,
        batchFailures: batchFailureRows,
        centreLoad,
        partsBurn: Array.from(partBurnMap.values()),
      };
    },
    dbOverride
  );
}

export async function buildTenantGstCsvExport(
  session: AuthenticatedSession,
  registerType: "oem_replacements" | "asc_reimbursements",
  dbOverride?: Database
): Promise<{ fileName: string; csvContent: string }> {
  assertPermission(session.role, "exports:gst");

  return withTenantDb(
    session.tenantId,
    async (tx) => {
      const [tenantRow] = await tx
        .select({ gstin: tenants.gstin, slug: tenants.slug })
        .from(tenants)
        .where(eq(tenants.id, session.tenantId))
        .limit(1);

      if (registerType === "oem_replacements") {
        const rows = await tx
          .select({
            claimNumber: warrantyClaims.claimNumber,
            rmaNumber: rmaOrders.rmaNumber,
            decidedAt: warrantyClaims.decidedAt,
            createdAt: warrantyClaims.createdAt,
            sku: products.sku,
            hsnCode: products.hsnCode,
            serialMasked: serialUnits.serialMasked,
            externalOrderId: serialUnits.externalOrderId,
            replacementCostMinor: warrantyClaims.replacementUnitCostMinor,
          })
          .from(warrantyClaims)
          .innerJoin(rmaOrders, eq(rmaOrders.claimId, warrantyClaims.id))
          .innerJoin(products, eq(warrantyClaims.productId, products.id))
          .innerJoin(serialUnits, eq(warrantyClaims.serialUnitId, serialUnits.id))
          .where(
            and(
              eq(warrantyClaims.tenantId, session.tenantId),
              eq(warrantyClaims.resolutionType, "REPLACE")
            )
          );

        const csvContent = renderOemWarrantyReplacementGstCsv(
          rows.map((r) => ({
            claimNumber: r.claimNumber,
            rmaNumber: r.rmaNumber,
            decidedDateIso: (r.decidedAt ?? r.createdAt).toISOString(),
            sku: r.sku,
            hsnCode: r.hsnCode,
            defectiveSerialMasked: r.serialMasked,
            originalOrderRef: r.externalOrderId,
            replacementCostMinor: r.replacementCostMinor,
          }))
        );

        return {
          fileName: `${tenantRow?.slug ?? "tenant"}-gst-oem-warranty-replacements.csv`,
          csvContent,
        };
      }

      const ascRows = await tx
        .select({
          jobNumber: repairOrders.jobNumber,
          completedAt: repairOrders.completedAt,
          createdAt: repairOrders.createdAt,
          ascName: serviceCentres.name,
          ascGstin: serviceCentres.gstin,
          centreType: serviceCentres.centreType,
          labourCostMinor: repairOrders.labourCostMinor,
          partsCostMinor: repairOrders.partsCostMinor,
        })
        .from(repairOrders)
        .innerJoin(serviceCentres, eq(repairOrders.serviceCentreId, serviceCentres.id))
        .where(
          and(
            eq(repairOrders.tenantId, session.tenantId),
            gte(repairOrders.createdAt, new Date(0))
          )
        );

      const partnerRepairs = ascRows.filter((r) => r.centreType === "AUTHORISED_PARTNER");
      const csvContent = renderAscReimbursementGstCsv(
        partnerRepairs.map((r) => ({
          jobNumber: r.jobNumber,
          completedDateIso: (r.completedAt ?? r.createdAt).toISOString(),
          ascName: r.ascName,
          ascGstin: r.ascGstin,
          oemGstin: tenantRow?.gstin ?? null,
          taxableMinor: r.labourCostMinor + r.partsCostMinor,
        }))
      );

      return {
        fileName: `${tenantRow?.slug ?? "tenant"}-gst-asc-b2b-reimbursements.csv`,
        csvContent,
      };
    },
    dbOverride
  );
}
