import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { brands, products, type SalesChannel, warrantyPolicies } from "./catalog";
import { createdAtColumn, idColumn, utcTimestamp } from "./columns";
import { tenants } from "./identity";

export const SERIAL_STATUSES = [
  "IN_STOCK",
  "SOLD",
  "REGISTERED",
  "CLAIMED",
  "REPLACED",
  "SCRAPPED",
] as const;

export type SerialStatus = (typeof SERIAL_STATUSES)[number];

export const REGISTRATION_STATUSES = [
  "ACTIVE",
  "PENDING_REVIEW",
  "REJECTED",
  "EXPIRED",
  "REVOKED",
  "ERASED",
] as const;

export type RegistrationStatus = (typeof REGISTRATION_STATUSES)[number];

export const productionBatches = pgTable(
  "production_batches",
  {
    id: idColumn(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    batchCode: text("batch_code").notNull(),
    lotNumber: text("lot_number").notNull(),
    supplierName: text("supplier_name").notNull(),
    factoryCode: text("factory_code").notNull(),
    manufacturedAt: utcTimestamp("manufactured_at").notNull(),
    unitCount: integer("unit_count").notNull().default(0),
    notes: text("notes").notNull().default(""),
    isDemo: boolean("is_demo").notNull().default(false),
    createdAt: createdAtColumn(),
  },
  (table) => [
    uniqueIndex("batches_tenant_code_uq").on(table.tenantId, table.batchCode),
    index("batches_tenant_product_idx").on(table.tenantId, table.productId),
  ]
);

export const serialUnits = pgTable(
  "serial_units",
  {
    id: idColumn(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    brandId: uuid("brand_id")
      .notNull()
      .references(() => brands.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    batchId: uuid("batch_id").references(() => productionBatches.id, { onDelete: "set null" }),
    serialNumber: text("serial_number").notNull(),
    imei: text("imei"),
    serialMasked: text("serial_masked").notNull(),
    salesChannel: text("sales_channel").$type<SalesChannel>().notNull().default("D2C_WEB"),
    externalOrderId: text("external_order_id"),
    soldAt: utcTimestamp("sold_at"),
    status: text("status").$type<SerialStatus>().notNull().default("IN_STOCK"),
    isDemo: boolean("is_demo").notNull().default(false),
    createdAt: createdAtColumn(),
  },
  (table) => [
    uniqueIndex("serials_tenant_serial_uq").on(table.tenantId, table.serialNumber),
    index("serials_tenant_batch_idx").on(table.tenantId, table.batchId),
    index("serials_tenant_product_idx").on(table.tenantId, table.productId),
  ]
);

export const warrantyRegistrations = pgTable(
  "warranty_registrations",
  {
    id: idColumn(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    brandId: uuid("brand_id")
      .notNull()
      .references(() => brands.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    serialUnitId: uuid("serial_unit_id")
      .notNull()
      .references(() => serialUnits.id, { onDelete: "cascade" }),
    policyId: uuid("policy_id")
      .notNull()
      .references(() => warrantyPolicies.id, { onDelete: "restrict" }),
    registrationNumber: text("registration_number").notNull(),
    customerName: text("customer_name").notNull(),
    customerEmail: text("customer_email").notNull(),
    customerPhone: text("customer_phone").notNull(),
    customerPinCode: text("customer_pin_code").notNull(),
    customerCity: text("customer_city").notNull(),
    regionCode: text("region_code").notNull().default("IN"),
    salesChannel: text("sales_channel").$type<SalesChannel>().notNull(),
    sourceMethod: text("source_method").notNull().default("QR"),
    orderReference: text("order_reference"),
    dealerName: text("dealer_name"),
    purchaseDate: utcTimestamp("purchase_date").notNull(),
    coverageStartDate: utcTimestamp("coverage_start_date").notNull(),
    coverageEndDate: utcTimestamp("coverage_end_date").notNull(),
    status: text("status").$type<RegistrationStatus>().notNull(),
    reviewNotes: text("review_notes"),
    consentAcceptedAt: utcTimestamp("consent_accepted_at").notNull(),
    consentVersion: text("consent_version").notNull().default("dpdp-2026.1"),
    certificateTokenHash: text("certificate_token_hash").notNull(),
    certificateTokenPreview: text("certificate_token_preview").notNull(),
    /** Demo/seed-only deterministic token or newly-minted display reference; real portals deliver raw token once */
    demoPublicToken: text("demo_public_token"),
    tokenRevokedAt: utcTimestamp("token_revoked_at"),
    isDemo: boolean("is_demo").notNull().default(false),
    createdAt: createdAtColumn(),
  },
  (table) => [
    uniqueIndex("registrations_tenant_number_uq").on(table.tenantId, table.registrationNumber),
    uniqueIndex("registrations_cert_token_hash_uq").on(table.certificateTokenHash),
    index("registrations_tenant_status_idx").on(table.tenantId, table.status),
    index("registrations_tenant_email_idx").on(table.tenantId, table.customerEmail),
  ]
);
