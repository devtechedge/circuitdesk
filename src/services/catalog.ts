import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import type { AuthenticatedSession } from "@/auth/session";
import type { Database } from "@/db/client";
import { withTenantDb } from "@/db/tenant";
import {
  brands,
  FAULT_CATEGORIES,
  PRODUCT_CATEGORIES,
  products,
  SALES_CHANNELS,
  subscriptions,
  warrantyPolicies,
} from "@/db/schema";
import { AppError } from "@/lib/errors";
import { assertPermission } from "@/security/rbac";
import { recordAuditLog } from "./audit";

const BRAND_LIMITS: Record<string, number> = {
  STARTER: 1,
  GROWTH: 3,
  SCALE: 10,
  ENTERPRISE: 100,
};

export const createBrandSchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9][a-z0-9-]{1,38}$/, "Brand slug must be lowercase alphanumeric with hyphens."),
  supportEmail: z.string().trim().email().max(160),
  supportWhatsapp: z.string().trim().max(24).optional(),
  accentHex: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .default("#fb923c"),
  portalHeadline: z.string().trim().min(8).max(160),
});

export const createProductSchema = z.object({
  brandId: z.string().uuid(),
  sku: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9][A-Z0-9_-]{2,31}$/, "SKU must be 3-32 uppercase alphanumeric characters."),
  name: z.string().trim().min(2).max(120),
  category: z.enum(PRODUCT_CATEGORIES),
  hsnCode: z.string().trim().regex(/^\d{4,8}$/, "HSN code must be 4-8 digits."),
  unitCostMinor: z.number().int().min(0).max(500_000_000),
  retailPriceMinor: z.number().int().min(0).max(500_000_000),
});

export const createPolicySchema = z.object({
  productId: z.string().uuid(),
  name: z.string().trim().min(3).max(120),
  regionCode: z.string().trim().toUpperCase().min(2).max(8).default("IN"),
  salesChannel: z.enum(SALES_CHANNELS).default("ALL"),
  durationMonths: z.number().int().min(1).max(120),
  doaWindowDays: z.number().int().min(0).max(90),
  repairExtensionMonths: z.number().int().min(0).max(24).default(0),
  requiresReceipt: z.boolean().default(true),
  offlineReviewRequired: z.boolean().default(true),
  coveredFaults: z.array(z.enum(FAULT_CATEGORIES)).min(1),
  exclusionsNote: z.string().trim().min(4).max(400),
  replaceCostThresholdMinor: z.number().int().min(0).max(500_000_000),
});

export async function listCatalogOverview(
  session: AuthenticatedSession,
  dbOverride?: Database
) {
  return withTenantDb(
    session.tenantId,
    async (tx) => {
      const tenantBrands = await tx
        .select()
        .from(brands)
        .where(eq(brands.tenantId, session.tenantId))
        .orderBy(desc(brands.createdAt));

      const tenantProducts = await tx
        .select()
        .from(products)
        .where(eq(products.tenantId, session.tenantId))
        .orderBy(desc(products.createdAt));

      const tenantPolicies = await tx
        .select()
        .from(warrantyPolicies)
        .where(eq(warrantyPolicies.tenantId, session.tenantId))
        .orderBy(desc(warrantyPolicies.createdAt));

      return {
        brands: tenantBrands,
        products: tenantProducts,
        policies: tenantPolicies,
      };
    },
    dbOverride
  );
}

export async function createBrand(
  session: AuthenticatedSession,
  input: z.infer<typeof createBrandSchema>,
  ipHash?: string,
  dbOverride?: Database
) {
  assertPermission(session.role, "catalog:write");
  const parsed = createBrandSchema.parse(input);

  return withTenantDb(
    session.tenantId,
    async (tx) => {
      const existingBrands = await tx
        .select({ id: brands.id })
        .from(brands)
        .where(eq(brands.tenantId, session.tenantId));

      const [sub] = await tx
        .select({ planCode: subscriptions.planCode })
        .from(subscriptions)
        .where(eq(subscriptions.tenantId, session.tenantId))
        .limit(1);

      const maxBrands = BRAND_LIMITS[sub?.planCode ?? "STARTER"] ?? 1;
      if (existingBrands.length >= maxBrands) {
        throw new AppError(
          403,
          "PLAN_BRAND_LIMIT_REACHED",
          `Current plan (${sub?.planCode ?? "STARTER"}) permits up to ${maxBrands} brand(s). Upgrade plan to add more brands.`
        );
      }

      const [slugTaken] = await tx
        .select({ id: brands.id })
        .from(brands)
        .where(eq(brands.slug, parsed.slug))
        .limit(1);

      if (slugTaken) {
        throw new AppError(409, "BRAND_SLUG_TAKEN", "Brand portal slug is already in use.");
      }

      const [created] = await tx
        .insert(brands)
        .values({
          tenantId: session.tenantId,
          slug: parsed.slug,
          name: parsed.name,
          supportEmail: parsed.supportEmail.toLowerCase(),
          supportWhatsapp: parsed.supportWhatsapp || null,
          accentHex: parsed.accentHex,
          portalHeadline: parsed.portalHeadline,
        })
        .returning();

      await recordAuditLog(
        {
          tenantId: session.tenantId,
          actorUserId: session.userId,
          actorRole: session.role,
          action: "BRAND_CREATED",
          entityType: "BRAND",
          entityId: created!.id,
          ipHash,
          summary: `Created brand "${created!.name}" (/w/${created!.slug}).`,
        },
        tx
      );

      return created!;
    },
    dbOverride
  );
}

export async function createProduct(
  session: AuthenticatedSession,
  input: z.infer<typeof createProductSchema>,
  ipHash?: string,
  dbOverride?: Database
) {
  assertPermission(session.role, "catalog:write");
  const parsed = createProductSchema.parse(input);

  return withTenantDb(
    session.tenantId,
    async (tx) => {
      const [brand] = await tx
        .select({ id: brands.id })
        .from(brands)
        .where(and(eq(brands.id, parsed.brandId), eq(brands.tenantId, session.tenantId)))
        .limit(1);

      if (!brand) {
        throw new AppError(404, "BRAND_NOT_FOUND", "Brand not found in this workspace.");
      }

      const [dup] = await tx
        .select({ id: products.id })
        .from(products)
        .where(and(eq(products.tenantId, session.tenantId), eq(products.sku, parsed.sku)))
        .limit(1);

      if (dup) {
        throw new AppError(409, "SKU_EXISTS", `SKU "${parsed.sku}" already exists.`);
      }

      const [created] = await tx
        .insert(products)
        .values({
          tenantId: session.tenantId,
          brandId: parsed.brandId,
          sku: parsed.sku,
          name: parsed.name,
          category: parsed.category,
          hsnCode: parsed.hsnCode,
          unitCostMinor: parsed.unitCostMinor,
          retailPriceMinor: parsed.retailPriceMinor,
          currency: session.tenantCurrency,
        })
        .returning();

      await recordAuditLog(
        {
          tenantId: session.tenantId,
          actorUserId: session.userId,
          actorRole: session.role,
          action: "PRODUCT_CREATED",
          entityType: "PRODUCT",
          entityId: created!.id,
          ipHash,
          summary: `Added hardware SKU ${created!.sku} (${created!.name}).`,
        },
        tx
      );

      return created!;
    },
    dbOverride
  );
}

export async function createWarrantyPolicy(
  session: AuthenticatedSession,
  input: z.infer<typeof createPolicySchema>,
  ipHash?: string,
  dbOverride?: Database
) {
  assertPermission(session.role, "catalog:write");
  const parsed = createPolicySchema.parse(input);

  return withTenantDb(
    session.tenantId,
    async (tx) => {
      const [product] = await tx
        .select({ id: products.id, sku: products.sku })
        .from(products)
        .where(and(eq(products.id, parsed.productId), eq(products.tenantId, session.tenantId)))
        .limit(1);

      if (!product) {
        throw new AppError(404, "PRODUCT_NOT_FOUND", "Product SKU not found in this workspace.");
      }

      const [created] = await tx
        .insert(warrantyPolicies)
        .values({
          tenantId: session.tenantId,
          productId: parsed.productId,
          name: parsed.name,
          regionCode: parsed.regionCode,
          salesChannel: parsed.salesChannel,
          durationMonths: parsed.durationMonths,
          doaWindowDays: parsed.doaWindowDays,
          repairExtensionMonths: parsed.repairExtensionMonths,
          requiresReceipt: parsed.requiresReceipt,
          offlineReviewRequired: parsed.offlineReviewRequired,
          coveredFaults: parsed.coveredFaults,
          exclusionsNote: parsed.exclusionsNote,
          replaceCostThresholdMinor: parsed.replaceCostThresholdMinor,
        })
        .returning();

      await recordAuditLog(
        {
          tenantId: session.tenantId,
          actorUserId: session.userId,
          actorRole: session.role,
          action: "POLICY_CREATED",
          entityType: "WARRANTY_POLICY",
          entityId: created!.id,
          ipHash,
          summary: `Created ${created!.durationMonths}m warranty policy "${created!.name}" for SKU ${product.sku}.`,
        },
        tx
      );

      return created!;
    },
    dbOverride
  );
}
