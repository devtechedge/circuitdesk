import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import type { AuthenticatedSession } from "@/auth/session";
import type { Database } from "@/db/client";
import { withTenantDb } from "@/db/tenant";
import { productionBatches, products, serialUnits } from "@/db/schema";
import { previewSerialCsvImport } from "@/domain/serial-csv";
import { AppError } from "@/lib/errors";
import { assertPermission, hasPermission } from "@/security/rbac";
import { maskImei, maskSerialNumber } from "@/security/serial-mask";
import { recordAuditLog } from "./audit";

export const createBatchSchema = z.object({
  productId: z.string().uuid(),
  batchCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9][A-Z0-9_-]{3,39}$/),
  lotNumber: z.string().trim().min(2).max(60),
  supplierName: z.string().trim().min(2).max(120),
  factoryCode: z.string().trim().min(2).max(60),
  manufacturedAt: z.string().min(4),
  notes: z.string().trim().max(400).default(""),
});

export async function listBatchesAndSerials(
  session: AuthenticatedSession,
  options?: { limit?: number; batchId?: string },
  dbOverride?: Database
) {
  const canUnmask = hasPermission(session.role, "serial:unmask");
  const limit = Math.min(Math.max(options?.limit ?? 100, 1), 300);

  return withTenantDb(
    session.tenantId,
    async (tx) => {
      const batches = await tx
        .select()
        .from(productionBatches)
        .where(eq(productionBatches.tenantId, session.tenantId))
        .orderBy(desc(productionBatches.createdAt));

      const tenantProducts = await tx
        .select({ id: products.id, sku: products.sku, name: products.name, brandId: products.brandId })
        .from(products)
        .where(eq(products.tenantId, session.tenantId));

      const whereClause = options?.batchId
        ? and(
            eq(serialUnits.tenantId, session.tenantId),
            eq(serialUnits.batchId, options.batchId)
          )
        : eq(serialUnits.tenantId, session.tenantId);

      const rawSerials = await tx
        .select()
        .from(serialUnits)
        .where(whereClause)
        .orderBy(desc(serialUnits.createdAt))
        .limit(limit);

      const skuByProductId = new Map(tenantProducts.map((p) => [p.id, p.sku]));
      const batchById = new Map(batches.map((b) => [b.id, b.batchCode]));

      const serials = rawSerials.map((unit) => ({
        id: unit.id,
        productId: unit.productId,
        sku: skuByProductId.get(unit.productId) ?? "UNKNOWN",
        batchId: unit.batchId,
        batchCode: unit.batchId ? batchById.get(unit.batchId) ?? null : null,
        serialDisplay: canUnmask ? unit.serialNumber : unit.serialMasked,
        serialMasked: unit.serialMasked,
        imeiDisplay: canUnmask ? unit.imei : maskImei(unit.imei),
        salesChannel: unit.salesChannel,
        externalOrderId: unit.externalOrderId,
        soldAt: unit.soldAt,
        status: unit.status,
        createdAt: unit.createdAt,
      }));

      return { batches, products: tenantProducts, serials, canUnmask };
    },
    dbOverride
  );
}

export async function createProductionBatch(
  session: AuthenticatedSession,
  input: z.infer<typeof createBatchSchema>,
  ipHash?: string,
  dbOverride?: Database
) {
  assertPermission(session.role, "serials:write");
  const parsed = createBatchSchema.parse(input);
  const mfgDate = new Date(parsed.manufacturedAt);
  if (Number.isNaN(mfgDate.getTime())) {
    throw new AppError(422, "INVALID_DATE", "Invalid manufacturedAt date.");
  }

  return withTenantDb(
    session.tenantId,
    async (tx) => {
      const [prod] = await tx
        .select({ id: products.id })
        .from(products)
        .where(and(eq(products.id, parsed.productId), eq(products.tenantId, session.tenantId)))
        .limit(1);

      if (!prod) {
        throw new AppError(404, "PRODUCT_NOT_FOUND", "Product SKU not found.");
      }

      const [dup] = await tx
        .select({ id: productionBatches.id })
        .from(productionBatches)
        .where(
          and(
            eq(productionBatches.tenantId, session.tenantId),
            eq(productionBatches.batchCode, parsed.batchCode)
          )
        )
        .limit(1);

      if (dup) {
        throw new AppError(409, "BATCH_EXISTS", `Batch "${parsed.batchCode}" already exists.`);
      }

      const [created] = await tx
        .insert(productionBatches)
        .values({
          tenantId: session.tenantId,
          productId: parsed.productId,
          batchCode: parsed.batchCode,
          lotNumber: parsed.lotNumber,
          supplierName: parsed.supplierName,
          factoryCode: parsed.factoryCode,
          manufacturedAt: mfgDate,
          notes: parsed.notes,
          isDemo: session.isDemoTenant,
        })
        .returning();

      await recordAuditLog(
        {
          tenantId: session.tenantId,
          actorUserId: session.userId,
          actorRole: session.role,
          action: "BATCH_CREATED",
          entityType: "BATCH",
          entityId: created!.id,
          ipHash,
          summary: `Created batch ${created!.batchCode} (supplier ${created!.supplierName}).`,
        },
        tx
      );

      return created!;
    },
    dbOverride
  );
}

export async function previewOrCommitSerialCsv(
  session: AuthenticatedSession,
  params: { csvText: string; dryRun: boolean; ipHash?: string },
  dbOverride?: Database
) {
  assertPermission(session.role, "serials:write");

  return withTenantDb(
    session.tenantId,
    async (tx) => {
      const tenantProducts = await tx
        .select({ id: products.id, sku: products.sku, brandId: products.brandId })
        .from(products)
        .where(eq(products.tenantId, session.tenantId));

      const existingUnits = await tx
        .select({ serialNumber: serialUnits.serialNumber })
        .from(serialUnits)
        .where(eq(serialUnits.tenantId, session.tenantId));

      const tenantBatches = await tx
        .select({ id: productionBatches.id, batchCode: productionBatches.batchCode, unitCount: productionBatches.unitCount })
        .from(productionBatches)
        .where(eq(productionBatches.tenantId, session.tenantId));

      const knownSkus = new Set(tenantProducts.map((p) => p.sku.toUpperCase()));
      const existingSerials = new Set(existingUnits.map((u) => u.serialNumber.toUpperCase()));

      const preview = previewSerialCsvImport({
        csvText: params.csvText,
        knownSkus,
        existingSerials,
      });

      if (params.dryRun || preview.validRows.length === 0) {
        return {
          dryRun: params.dryRun,
          importedCount: 0,
          totalRows: preview.totalRows,
          validRows: preview.validRows,
          errors: preview.errors,
        };
      }

      const productBySku = new Map(tenantProducts.map((p) => [p.sku.toUpperCase(), p]));
      const batchByCode = new Map(tenantBatches.map((b) => [b.batchCode.toUpperCase(), b]));
      const batchDelta = new Map<string, number>();

      for (const row of preview.validRows) {
        const prod = productBySku.get(row.sku)!;
        const matchedBatch = row.batchCode ? batchByCode.get(row.batchCode) : undefined;

        await tx.insert(serialUnits).values({
          tenantId: session.tenantId,
          brandId: prod.brandId,
          productId: prod.id,
          batchId: matchedBatch?.id ?? null,
          serialNumber: row.serialNumber,
          imei: row.imei,
          serialMasked: maskSerialNumber(row.serialNumber),
          salesChannel: row.salesChannel,
          externalOrderId: row.externalOrderId,
          soldAt: row.soldAt,
          status: row.soldAt || row.externalOrderId ? "SOLD" : "IN_STOCK",
          isDemo: session.isDemoTenant,
        });

        if (matchedBatch) {
          batchDelta.set(matchedBatch.id, (batchDelta.get(matchedBatch.id) ?? 0) + 1);
        }
      }

      for (const [batchId, added] of batchDelta.entries()) {
        const current = tenantBatches.find((b) => b.id === batchId)?.unitCount ?? 0;
        await tx
          .update(productionBatches)
          .set({ unitCount: current + added })
          .where(eq(productionBatches.id, batchId));
      }

      await recordAuditLog(
        {
          tenantId: session.tenantId,
          actorUserId: session.userId,
          actorRole: session.role,
          action: "SERIAL_CSV_IMPORTED",
          entityType: "SERIAL_REGISTRY",
          entityId: session.tenantId,
          ipHash: params.ipHash,
          summary: `Imported ${preview.validRows.length} serialized unit(s) via CSV (${preview.errors.length} rejected row(s)).`,
        },
        tx
      );

      return {
        dryRun: false,
        importedCount: preview.validRows.length,
        totalRows: preview.totalRows,
        validRows: preview.validRows,
        errors: preview.errors,
      };
    },
    dbOverride
  );
}
