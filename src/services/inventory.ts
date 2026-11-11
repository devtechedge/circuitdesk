import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import type { AuthenticatedSession } from "@/auth/session";
import type { Database } from "@/db/client";
import { withTenantDb } from "@/db/tenant";
import { PRODUCT_CATEGORIES, products, serviceCentres, spareParts } from "@/db/schema";
import { AppError } from "@/lib/errors";
import { assertPermission } from "@/security/rbac";
import { recordAuditLog } from "./audit";

export const createServiceCentreSchema = z.object({
  name: z.string().trim().min(3).max(120),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9][A-Z0-9-]{2,20}$/),
  city: z.string().trim().min(2).max(80),
  state: z.string().trim().min(2).max(80),
  pinPrefixes: z.array(z.string().trim().regex(/^[0-9A-Za-z]{2,8}$/)).min(1),
  supportedCategories: z.array(z.enum(PRODUCT_CATEGORIES)).min(1),
  centreType: z.enum(["OWNED_BENCH", "AUTHORISED_PARTNER"]).default("AUTHORISED_PARTNER"),
  gstin: z.string().trim().max(20).optional(),
  contactPhone: z.string().trim().min(7).max(24),
  maxActiveRepairs: z.number().int().min(1).max(1000).default(40),
});

export const createSparePartSchema = z.object({
  serviceCentreId: z.string().uuid(),
  productId: z.string().uuid().optional(),
  partSku: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9][A-Z0-9_-]{2,31}$/),
  name: z.string().trim().min(2).max(120),
  hsnCode: z.string().trim().regex(/^\d{4,8}$/).default("85189000"),
  unitCostMinor: z.number().int().min(0).max(100_000_000),
  quantityOnHand: z.number().int().min(0).max(100_000),
  reorderThreshold: z.number().int().min(0).max(10_000).default(5),
  supplierName: z.string().trim().min(2).max(120),
});

export async function listServiceNetworkAndInventory(
  session: AuthenticatedSession,
  dbOverride?: Database
) {
  return withTenantDb(
    session.tenantId,
    async (tx) => {
      const centres = await tx
        .select()
        .from(serviceCentres)
        .where(eq(serviceCentres.tenantId, session.tenantId))
        .orderBy(desc(serviceCentres.createdAt));

      const parts = await tx
        .select({
          part: spareParts,
          centreName: serviceCentres.name,
          centreCode: serviceCentres.code,
          productSku: products.sku,
        })
        .from(spareParts)
        .innerJoin(serviceCentres, eq(spareParts.serviceCentreId, serviceCentres.id))
        .leftJoin(products, eq(spareParts.productId, products.id))
        .where(eq(spareParts.tenantId, session.tenantId))
        .orderBy(desc(spareParts.createdAt));

      const lowStockParts = parts.filter((p) => p.part.quantityOnHand <= p.part.reorderThreshold);

      return { centres, parts, lowStockParts };
    },
    dbOverride
  );
}

export async function createServiceCentre(
  session: AuthenticatedSession,
  input: z.infer<typeof createServiceCentreSchema>,
  ipHash?: string,
  dbOverride?: Database
) {
  assertPermission(session.role, "inventory:write");
  const parsed = createServiceCentreSchema.parse(input);

  return withTenantDb(
    session.tenantId,
    async (tx) => {
      const [created] = await tx
        .insert(serviceCentres)
        .values({
          tenantId: session.tenantId,
          name: parsed.name,
          code: parsed.code,
          city: parsed.city,
          state: parsed.state,
          pinPrefixes: parsed.pinPrefixes,
          supportedCategories: parsed.supportedCategories,
          centreType: parsed.centreType,
          gstin: parsed.gstin || null,
          contactPhone: parsed.contactPhone,
          maxActiveRepairs: parsed.maxActiveRepairs,
        })
        .returning();

      await recordAuditLog(
        {
          tenantId: session.tenantId,
          actorUserId: session.userId,
          actorRole: session.role,
          action: "SERVICE_CENTRE_CREATED",
          entityType: "SERVICE_CENTRE",
          entityId: created!.id,
          ipHash,
          summary: `Added service centre ${created!.code} (${created!.city}, PIN prefixes ${parsed.pinPrefixes.join(", ")}).`,
        },
        tx
      );

      return created!;
    },
    dbOverride
  );
}

export async function createOrRestockSparePart(
  session: AuthenticatedSession,
  input: z.infer<typeof createSparePartSchema>,
  ipHash?: string,
  dbOverride?: Database
) {
  assertPermission(session.role, "inventory:write");
  const parsed = createSparePartSchema.parse(input);

  return withTenantDb(
    session.tenantId,
    async (tx) => {
      const [centre] = await tx
        .select({ id: serviceCentres.id, code: serviceCentres.code })
        .from(serviceCentres)
        .where(
          and(
            eq(serviceCentres.id, parsed.serviceCentreId),
            eq(serviceCentres.tenantId, session.tenantId)
          )
        )
        .limit(1);

      if (!centre) {
        throw new AppError(404, "CENTRE_NOT_FOUND", "Service centre not found.");
      }

      const [existing] = await tx
        .select()
        .from(spareParts)
        .where(
          and(
            eq(spareParts.tenantId, session.tenantId),
            eq(spareParts.serviceCentreId, centre.id),
            eq(spareParts.partSku, parsed.partSku)
          )
        )
        .limit(1);

      if (existing) {
        const [updated] = await tx
          .update(spareParts)
          .set({
            quantityOnHand: existing.quantityOnHand + parsed.quantityOnHand,
            unitCostMinor: parsed.unitCostMinor,
            reorderThreshold: parsed.reorderThreshold,
          })
          .where(eq(spareParts.id, existing.id))
          .returning();

        await recordAuditLog(
          {
            tenantId: session.tenantId,
            actorUserId: session.userId,
            actorRole: session.role,
            action: "SPARE_PART_RESTOCKED",
            entityType: "SPARE_PART",
            entityId: existing.id,
            ipHash,
            summary: `Restocked +${parsed.quantityOnHand} of ${existing.partSku} at ${centre.code}.`,
          },
          tx
        );
        return updated!;
      }

      const [created] = await tx
        .insert(spareParts)
        .values({
          tenantId: session.tenantId,
          serviceCentreId: centre.id,
          productId: parsed.productId ?? null,
          partSku: parsed.partSku,
          name: parsed.name,
          hsnCode: parsed.hsnCode,
          unitCostMinor: parsed.unitCostMinor,
          quantityOnHand: parsed.quantityOnHand,
          reorderThreshold: parsed.reorderThreshold,
          supplierName: parsed.supplierName,
        })
        .returning();

      await recordAuditLog(
        {
          tenantId: session.tenantId,
          actorUserId: session.userId,
          actorRole: session.role,
          action: "SPARE_PART_CREATED",
          entityType: "SPARE_PART",
          entityId: created!.id,
          ipHash,
          summary: `Created spare part ${created!.partSku} (${created!.quantityOnHand} units) at ${centre.code}.`,
        },
        tx
      );
      return created!;
    },
    dbOverride
  );
}
