import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { createdAtColumn, idColumn, moneyMinor } from "./columns";
import { type CurrencyCode, tenants } from "./identity";

export const PRODUCT_CATEGORIES = [
  "AUDIO",
  "WEARABLE",
  "CHARGING_ACCESSORY",
  "SMART_APPLIANCE",
  "PERIPHERAL",
] as const;

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

export const SALES_CHANNELS = [
  "ALL",
  "D2C_WEB",
  "MARKETPLACE",
  "AUTHORISED_DEALER",
  "OFFLINE_RETAIL",
] as const;

export type SalesChannel = (typeof SALES_CHANNELS)[number];

export const FAULT_CATEGORIES = [
  "DOA",
  "BATTERY",
  "CHARGING",
  "CONNECTIVITY",
  "PHYSICAL_DAMAGE",
  "MISSING_PARTS",
  "SOFTWARE_FIRMWARE",
] as const;

export type FaultCategory = (typeof FAULT_CATEGORIES)[number];

export const brands = pgTable(
  "brands",
  {
    id: idColumn(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    supportEmail: text("support_email").notNull(),
    supportWhatsapp: text("support_whatsapp"),
    accentHex: text("accent_hex").notNull().default("#fb923c"),
    portalHeadline: text("portal_headline")
      .notNull()
      .default("Register your hardware, verify coverage, or track a warranty repair."),
    hideCircuitdeskBadge: boolean("hide_circuitdesk_badge").notNull().default(false),
    createdAt: createdAtColumn(),
  },
  (table) => [
    uniqueIndex("brands_slug_uq").on(table.slug),
    index("brands_tenant_idx").on(table.tenantId),
  ]
);

export const products = pgTable(
  "products",
  {
    id: idColumn(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    brandId: uuid("brand_id")
      .notNull()
      .references(() => brands.id, { onDelete: "cascade" }),
    sku: text("sku").notNull(),
    name: text("name").notNull(),
    category: text("category").$type<ProductCategory>().notNull(),
    hsnCode: text("hsn_code").notNull().default("8518"),
    unitCostMinor: moneyMinor("unit_cost_minor"),
    retailPriceMinor: moneyMinor("retail_price_minor"),
    currency: text("currency").$type<CurrencyCode>().notNull().default("INR"),
    active: boolean("active").notNull().default(true),
    createdAt: createdAtColumn(),
  },
  (table) => [
    uniqueIndex("products_tenant_sku_uq").on(table.tenantId, table.sku),
    index("products_tenant_brand_idx").on(table.tenantId, table.brandId),
  ]
);

export const warrantyPolicies = pgTable(
  "warranty_policies",
  {
    id: idColumn(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    regionCode: text("region_code").notNull().default("IN"),
    salesChannel: text("sales_channel").$type<SalesChannel>().notNull().default("ALL"),
    durationMonths: integer("duration_months").notNull().default(12),
    doaWindowDays: integer("doa_window_days").notNull().default(7),
    repairExtensionMonths: integer("repair_extension_months").notNull().default(0),
    requiresReceipt: boolean("requires_receipt").notNull().default(true),
    offlineReviewRequired: boolean("offline_review_required").notNull().default(true),
    coveredFaults: jsonb("covered_faults")
      .$type<FaultCategory[]>()
      .notNull()
      .default(["DOA", "BATTERY", "CHARGING", "CONNECTIVITY", "SOFTWARE_FIRMWARE"]),
    exclusionsNote: text("exclusions_note")
      .notNull()
      .default("Excludes liquid ingress, unauthorized modification, and accidental drop damage."),
    replaceCostThresholdMinor: moneyMinor("replace_cost_threshold_minor"),
    active: boolean("active").notNull().default(true),
    createdAt: createdAtColumn(),
  },
  (table) => [index("policies_tenant_product_idx").on(table.tenantId, table.productId)]
);
