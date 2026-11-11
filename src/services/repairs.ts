import { and, desc, eq, gte, sql } from "drizzle-orm";
import { z } from "zod";
import type { AuthenticatedSession } from "@/auth/session";
import type { Database } from "@/db/client";
import { withTenantDb } from "@/db/tenant";
import {
  claimEvents,
  products,
  REPAIR_STAGES,
  repairOrders,
  repairPartUsages,
  serialUnits,
  serviceCentres,
  spareParts,
  tenants,
  warrantyClaims,
} from "@/db/schema";
import { computeAscGstSplit } from "@/domain/money";
import { AppError } from "@/lib/errors";
import { assertPermission, hasPermission } from "@/security/rbac";
import { recordAuditLog } from "./audit";

export const updateRepairStageSchema = z.object({
  stage: z.enum(REPAIR_STAGES),
  inspectionNotes: z.string().trim().max(1000).default(""),
  diagnosisCode: z.string().trim().min(2).max(60).default("BENCH_DIAGNOSED"),
  qaChecklist: z.object({
    powerOn: z.boolean(),
    chargeTest: z.boolean(),
    burnIn: z.boolean(),
    enclosureSeal: z.boolean(),
  }),
  labourCostMinor: z.number().int().min(0).max(100_000_000).default(0),
  freightCostMinor: z.number().int().min(0).max(100_000_000).default(0),
  returnCarrier: z.string().trim().max(80).optional(),
  returnTrackingNumber: z.string().trim().max(80).optional(),
});

export const consumePartSchema = z.object({
  sparePartId: z.string().uuid(),
  quantity: z.number().int().min(1).max(20),
});

export async function listTenantRepairs(session: AuthenticatedSession, dbOverride?: Database) {
  const canUnmask = hasPermission(session.role, "serial:unmask");
  return withTenantDb(
    session.tenantId,
    async (tx) => {
      const baseWhere =
        session.role === "TECHNICIAN" && session.serviceCentreId
          ? and(
              eq(repairOrders.tenantId, session.tenantId),
              eq(repairOrders.serviceCentreId, session.serviceCentreId)
            )
          : eq(repairOrders.tenantId, session.tenantId);

      const rows = await tx
        .select({
          repair: repairOrders,
          centreName: serviceCentres.name,
          centreCity: serviceCentres.city,
          centreCode: serviceCentres.code,
          centreType: serviceCentres.centreType,
          claimNumber: warrantyClaims.claimNumber,
          faultCategory: warrantyClaims.faultCategory,
          symptomSummary: warrantyClaims.symptomSummary,
          sku: products.sku,
          productName: products.name,
          serialNumber: serialUnits.serialNumber,
          serialMasked: serialUnits.serialMasked,
        })
        .from(repairOrders)
        .innerJoin(serviceCentres, eq(repairOrders.serviceCentreId, serviceCentres.id))
        .innerJoin(warrantyClaims, eq(repairOrders.claimId, warrantyClaims.id))
        .innerJoin(products, eq(warrantyClaims.productId, products.id))
        .innerJoin(serialUnits, eq(warrantyClaims.serialUnitId, serialUnits.id))
        .where(baseWhere)
        .orderBy(desc(repairOrders.createdAt))
        .limit(150);

      return rows.map((r) => ({
        ...r,
        serialNumber: undefined,
        serialDisplay: canUnmask ? r.serialNumber : r.serialMasked,
      }));
    },
    dbOverride
  );
}

export async function getTenantRepairDetail(
  session: AuthenticatedSession,
  repairId: string,
  dbOverride?: Database
) {
  const canUnmask = hasPermission(session.role, "serial:unmask");
  return withTenantDb(
    session.tenantId,
    async (tx) => {
      const found = await tx
        .select({
          repair: repairOrders,
          centre: serviceCentres,
          claim: warrantyClaims,
          product: products,
          serialNumber: serialUnits.serialNumber,
          serialMasked: serialUnits.serialMasked,
        })
        .from(repairOrders)
        .innerJoin(serviceCentres, eq(repairOrders.serviceCentreId, serviceCentres.id))
        .innerJoin(warrantyClaims, eq(repairOrders.claimId, warrantyClaims.id))
        .innerJoin(products, eq(warrantyClaims.productId, products.id))
        .innerJoin(serialUnits, eq(warrantyClaims.serialUnitId, serialUnits.id))
        .where(and(eq(repairOrders.id, repairId), eq(repairOrders.tenantId, session.tenantId)))
        .limit(1);

      const entry = found[0];
      if (!entry) {
        throw new AppError(404, "REPAIR_NOT_FOUND", "Repair job not found.");
      }

      if (
        session.role === "TECHNICIAN" &&
        session.serviceCentreId &&
        entry.repair.serviceCentreId !== session.serviceCentreId
      ) {
        throw new AppError(
          403,
          "BENCH_ASSIGNMENT_DENIED",
          "Technicians can only access repair jobs assigned to their service centre."
        );
      }

      const usages = await tx
        .select({
          usage: repairPartUsages,
          partSku: spareParts.partSku,
          partName: spareParts.name,
        })
        .from(repairPartUsages)
        .innerJoin(spareParts, eq(repairPartUsages.sparePartId, spareParts.id))
        .where(
          and(
            eq(repairPartUsages.tenantId, session.tenantId),
            eq(repairPartUsages.repairOrderId, entry.repair.id)
          )
        );

      const centreParts = await tx
        .select()
        .from(spareParts)
        .where(
          and(
            eq(spareParts.tenantId, session.tenantId),
            eq(spareParts.serviceCentreId, entry.centre.id)
          )
        );

      return {
        repair: entry.repair,
        centre: entry.centre,
        claim: entry.claim,
        product: entry.product,
        serialDisplay: canUnmask ? entry.serialNumber : entry.serialMasked,
        usages,
        centreParts,
      };
    },
    dbOverride
  );
}

export async function consumeSparePartOnRepair(
  session: AuthenticatedSession,
  repairId: string,
  input: z.infer<typeof consumePartSchema>,
  ipHash?: string,
  dbOverride?: Database
) {
  assertPermission(session.role, "repairs:execute");
  const parsed = consumePartSchema.parse(input);

  return withTenantDb(
    session.tenantId,
    async (tx) => {
      const [repair] = await tx
        .select()
        .from(repairOrders)
        .where(and(eq(repairOrders.id, repairId), eq(repairOrders.tenantId, session.tenantId)))
        .limit(1);

      if (!repair) {
        throw new AppError(404, "REPAIR_NOT_FOUND", "Repair order not found.");
      }

      if (
        session.role === "TECHNICIAN" &&
        session.serviceCentreId &&
        repair.serviceCentreId !== session.serviceCentreId
      ) {
        throw new AppError(403, "BENCH_ASSIGNMENT_DENIED", "Wrong service centre bench.");
      }

      // Atomic stock decrement guarded by quantity_on_hand >= quantity
      const decremented = await tx
        .update(spareParts)
        .set({
          quantityOnHand: sql`${spareParts.quantityOnHand} - ${parsed.quantity}`,
        })
        .where(
          and(
            eq(spareParts.id, parsed.sparePartId),
            eq(spareParts.tenantId, session.tenantId),
            eq(spareParts.serviceCentreId, repair.serviceCentreId),
            gte(spareParts.quantityOnHand, parsed.quantity)
          )
        )
        .returning();

      const part = decremented[0];
      if (!part) {
        throw new AppError(
          409,
          "INSUFFICIENT_PART_STOCK",
          "Spare part is out of stock or belongs to a different service centre."
        );
      }

      const lineCostMinor = part.unitCostMinor * parsed.quantity;

      const [usage] = await tx
        .insert(repairPartUsages)
        .values({
          tenantId: session.tenantId,
          repairOrderId: repair.id,
          sparePartId: part.id,
          quantity: parsed.quantity,
          unitCostMinor: part.unitCostMinor,
        })
        .returning();

      await tx
        .update(repairOrders)
        .set({
          partsCostMinor: repair.partsCostMinor + lineCostMinor,
        })
        .where(eq(repairOrders.id, repair.id));

      await recordAuditLog(
        {
          tenantId: session.tenantId,
          actorUserId: session.userId,
          actorRole: session.role,
          action: "REPAIR_PART_CONSUMED",
          entityType: "REPAIR_ORDER",
          entityId: repair.id,
          ipHash,
          summary: `Consumed ${parsed.quantity}x ${part.partSku} on ${repair.jobNumber} (${part.quantityOnHand} remaining).`,
        },
        tx
      );

      return { usage: usage!, remainingStock: part.quantityOnHand };
    },
    dbOverride
  );
}

export async function updateRepairBenchStage(
  session: AuthenticatedSession,
  repairId: string,
  input: z.infer<typeof updateRepairStageSchema>,
  ipHash?: string,
  dbOverride?: Database
) {
  assertPermission(session.role, "repairs:execute");
  const parsed = updateRepairStageSchema.parse(input);

  const allQaChecks =
    parsed.qaChecklist.powerOn &&
    parsed.qaChecklist.chargeTest &&
    parsed.qaChecklist.burnIn &&
    parsed.qaChecklist.enclosureSeal;

  if (parsed.stage === "DISPATCHED" && !allQaChecks) {
    throw new AppError(
      422,
      "QA_CHECKLIST_INCOMPLETE",
      "All four bench QA checks (Power-On, Charge, Burn-In, Enclosure Seal) must pass before dispatch."
    );
  }

  return withTenantDb(
    session.tenantId,
    async (tx) => {
      const [repair] = await tx
        .select()
        .from(repairOrders)
        .where(and(eq(repairOrders.id, repairId), eq(repairOrders.tenantId, session.tenantId)))
        .limit(1);

      if (!repair) {
        throw new AppError(404, "REPAIR_NOT_FOUND", "Repair order not found.");
      }

      if (
        session.role === "TECHNICIAN" &&
        session.serviceCentreId &&
        repair.serviceCentreId !== session.serviceCentreId
      ) {
        throw new AppError(403, "BENCH_ASSIGNMENT_DENIED", "Wrong service centre bench.");
      }

      const [centre] = await tx
        .select()
        .from(serviceCentres)
        .where(eq(serviceCentres.id, repair.serviceCentreId))
        .limit(1);

      const [tenantRow] = await tx
        .select({ gstin: tenants.gstin })
        .from(tenants)
        .where(eq(tenants.id, session.tenantId))
        .limit(1);

      const isTerminal = parsed.stage === "DISPATCHED" || parsed.stage === "UNREPAIRABLE";
      const now = new Date();

      let ascTaxableInvoiceMinor = 0;
      let ascGstMinor = 0;
      if (centre?.centreType === "AUTHORISED_PARTNER") {
        const taxable = parsed.labourCostMinor + repair.partsCostMinor;
        const gstSplit = computeAscGstSplit({
          taxableMinor: taxable,
          oemGstin: tenantRow?.gstin,
          ascGstin: centre.gstin,
        });
        ascTaxableInvoiceMinor = gstSplit.taxableMinor;
        ascGstMinor = gstSplit.totalGstMinor;
      }

      const [updated] = await tx
        .update(repairOrders)
        .set({
          stage: parsed.stage,
          inspectionNotes: parsed.inspectionNotes,
          diagnosisCode: parsed.diagnosisCode,
          qaChecklist: parsed.qaChecklist,
          qaPassed: allQaChecks,
          labourCostMinor: parsed.labourCostMinor,
          freightCostMinor: parsed.freightCostMinor,
          ascTaxableInvoiceMinor,
          ascGstMinor,
          returnCarrier: parsed.returnCarrier || repair.returnCarrier,
          returnTrackingNumber: parsed.returnTrackingNumber || repair.returnTrackingNumber,
          completedAt: isTerminal ? repair.completedAt ?? now : null,
        })
        .where(eq(repairOrders.id, repair.id))
        .returning();

      if (parsed.stage === "DISPATCHED" && !repair.completedAt) {
        if (centre && centre.activeRepairsCount > 0) {
          await tx
            .update(serviceCentres)
            .set({ activeRepairsCount: centre.activeRepairsCount - 1 })
            .where(eq(serviceCentres.id, centre.id));
        }

        await tx
          .update(warrantyClaims)
          .set({ status: "RESOLVED", resolvedAt: now })
          .where(eq(warrantyClaims.id, repair.claimId));

        await tx.insert(claimEvents).values({
          tenantId: session.tenantId,
          claimId: repair.claimId,
          actorType: "USER",
          actorUserId: session.userId,
          eventType: "REPAIR_DISPATCHED",
          message: `Bench QA passed on ${repair.jobNumber}; repaired device dispatched${
            parsed.returnTrackingNumber ? ` (${parsed.returnTrackingNumber})` : ""
          }.`,
          visibility: "PUBLIC",
        });
      }

      await recordAuditLog(
        {
          tenantId: session.tenantId,
          actorUserId: session.userId,
          actorRole: session.role,
          action: "REPAIR_STAGE_UPDATED",
          entityType: "REPAIR_ORDER",
          entityId: repair.id,
          ipHash,
          summary: `Updated ${repair.jobNumber} stage -> ${parsed.stage}.`,
        },
        tx
      );

      return updated!;
    },
    dbOverride
  );
}
