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
import { type ProductCategory, products } from "./catalog";
import { warrantyClaims } from "./claims";
import { createdAtColumn, idColumn, moneyMinor, utcTimestamp } from "./columns";
import { tenants, users } from "./identity";
import { serialUnits } from "./registry";

export const REPAIR_STAGES = [
  "ROUTED",
  "RECEIVED",
  "DIAGNOSING",
  "AWAITING_PARTS",
  "REPAIRING",
  "QA_TESTING",
  "DISPATCHED",
  "UNREPAIRABLE",
] as const;

export type RepairStage = (typeof REPAIR_STAGES)[number];

export const RMA_DISPOSITIONS = [
  "PENDING",
  "REPAIR_RETURN",
  "REFURBISH_STOCK",
  "SCRAP_EWASTE",
  "RETURN_TO_VENDOR",
] as const;

export type RmaDisposition = (typeof RMA_DISPOSITIONS)[number];

export const RMA_STATUSES = [
  "ISSUED",
  "IN_TRANSIT",
  "RECEIVED",
  "INSPECTED",
  "CLOSED",
] as const;

export type RmaStatus = (typeof RMA_STATUSES)[number];

export const serviceCentres = pgTable(
  "service_centres",
  {
    id: idColumn(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    code: text("code").notNull(),
    city: text("city").notNull(),
    state: text("state").notNull(),
    pinPrefixes: jsonb("pin_prefixes").$type<string[]>().notNull().default([]),
    supportedCategories: jsonb("supported_categories")
      .$type<ProductCategory[]>()
      .notNull()
      .default(["AUDIO", "WEARABLE", "CHARGING_ACCESSORY", "SMART_APPLIANCE", "PERIPHERAL"]),
    centreType: text("centre_type")
      .$type<"OWNED_BENCH" | "AUTHORISED_PARTNER">()
      .notNull()
      .default("AUTHORISED_PARTNER"),
    gstin: text("gstin"),
    contactPhone: text("contact_phone").notNull(),
    maxActiveRepairs: integer("max_active_repairs").notNull().default(40),
    activeRepairsCount: integer("active_repairs_count").notNull().default(0),
    active: boolean("active").notNull().default(true),
    createdAt: createdAtColumn(),
  },
  (table) => [
    uniqueIndex("centres_tenant_code_uq").on(table.tenantId, table.code),
    index("centres_tenant_idx").on(table.tenantId),
  ]
);

export const spareParts = pgTable(
  "spare_parts",
  {
    id: idColumn(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
    serviceCentreId: uuid("service_centre_id")
      .notNull()
      .references(() => serviceCentres.id, { onDelete: "cascade" }),
    partSku: text("part_sku").notNull(),
    name: text("name").notNull(),
    hsnCode: text("hsn_code").notNull().default("85189000"),
    unitCostMinor: moneyMinor("unit_cost_minor"),
    quantityOnHand: integer("quantity_on_hand").notNull().default(0),
    reorderThreshold: integer("reorder_threshold").notNull().default(5),
    supplierName: text("supplier_name").notNull(),
    createdAt: createdAtColumn(),
  },
  (table) => [
    uniqueIndex("parts_centre_sku_uq").on(table.serviceCentreId, table.partSku),
    index("parts_tenant_idx").on(table.tenantId),
  ]
);

export const repairOrders = pgTable(
  "repair_orders",
  {
    id: idColumn(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    claimId: uuid("claim_id")
      .notNull()
      .references(() => warrantyClaims.id, { onDelete: "cascade" }),
    serviceCentreId: uuid("service_centre_id")
      .notNull()
      .references(() => serviceCentres.id, { onDelete: "restrict" }),
    assignedTechnicianId: uuid("assigned_technician_id").references(() => users.id, {
      onDelete: "set null",
    }),
    jobNumber: text("job_number").notNull(),
    routingReason: text("routing_reason").notNull(),
    stage: text("stage").$type<RepairStage>().notNull().default("ROUTED"),
    inspectionNotes: text("inspection_notes").notNull().default(""),
    diagnosisCode: text("diagnosis_code").notNull().default("PENDING_BENCH"),
    qaPassed: boolean("qa_passed").notNull().default(false),
    qaChecklist: jsonb("qa_checklist")
      .$type<{ powerOn: boolean; chargeTest: boolean; burnIn: boolean; enclosureSeal: boolean }>()
      .notNull()
      .default({ powerOn: false, chargeTest: false, burnIn: false, enclosureSeal: false }),
    labourCostMinor: moneyMinor("labour_cost_minor"),
    partsCostMinor: moneyMinor("parts_cost_minor"),
    freightCostMinor: moneyMinor("freight_cost_minor"),
    ascTaxableInvoiceMinor: moneyMinor("asc_taxable_invoice_minor"),
    ascGstMinor: moneyMinor("asc_gst_minor"),
    returnTrackingNumber: text("return_tracking_number"),
    returnCarrier: text("return_carrier"),
    slaDueAt: utcTimestamp("sla_due_at").notNull(),
    completedAt: utcTimestamp("completed_at"),
    isDemo: boolean("is_demo").notNull().default(false),
    createdAt: createdAtColumn(),
  },
  (table) => [
    uniqueIndex("repairs_tenant_job_uq").on(table.tenantId, table.jobNumber),
    index("repairs_tenant_stage_idx").on(table.tenantId, table.stage),
    index("repairs_tenant_centre_idx").on(table.tenantId, table.serviceCentreId),
  ]
);

export const repairPartUsages = pgTable(
  "repair_part_usages",
  {
    id: idColumn(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    repairOrderId: uuid("repair_order_id")
      .notNull()
      .references(() => repairOrders.id, { onDelete: "cascade" }),
    sparePartId: uuid("spare_part_id")
      .notNull()
      .references(() => spareParts.id, { onDelete: "restrict" }),
    quantity: integer("quantity").notNull(),
    unitCostMinor: moneyMinor("unit_cost_minor"),
    createdAt: createdAtColumn(),
  },
  (table) => [index("part_usage_tenant_repair_idx").on(table.tenantId, table.repairOrderId)]
);

export const rmaOrders = pgTable(
  "rma_orders",
  {
    id: idColumn(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    claimId: uuid("claim_id")
      .notNull()
      .references(() => warrantyClaims.id, { onDelete: "cascade" }),
    rmaNumber: text("rma_number").notNull(),
    direction: text("direction")
      .$type<"INBOUND_DEFECTIVE" | "OUTBOUND_REPLACEMENT" | "RETURN_TO_VENDOR">()
      .notNull()
      .default("INBOUND_DEFECTIVE"),
    carrierMode: text("carrier_mode").$type<"MANUAL" | "CARRIER_API">().notNull().default("MANUAL"),
    carrierName: text("carrier_name").notNull().default("Manual Customer Drop / Courier"),
    trackingNumber: text("tracking_number"),
    inboundCondition: text("inbound_condition"),
    inspectionResult: text("inspection_result"),
    disposition: text("disposition").$type<RmaDisposition>().notNull().default("PENDING"),
    replacementSerialId: uuid("replacement_serial_id").references(() => serialUnits.id, {
      onDelete: "set null",
    }),
    ewasteManifestRef: text("ewaste_manifest_ref"),
    supplierRecoveryMinor: moneyMinor("supplier_recovery_minor"),
    status: text("status").$type<RmaStatus>().notNull().default("ISSUED"),
    isDemo: boolean("is_demo").notNull().default(false),
    createdAt: createdAtColumn(),
  },
  (table) => [
    uniqueIndex("rma_tenant_number_uq").on(table.tenantId, table.rmaNumber),
    index("rma_tenant_claim_idx").on(table.tenantId, table.claimId),
  ]
);
