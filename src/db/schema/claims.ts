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
import { brands, type FaultCategory, products, warrantyPolicies } from "./catalog";
import { createdAtColumn, idColumn, moneyMinor, utcTimestamp } from "./columns";
import { tenants, users } from "./identity";
import { serialUnits, warrantyRegistrations } from "./registry";

export const CLAIM_STATUSES = [
  "SUBMITTED",
  "NEEDS_INFO",
  "IN_TRIAGE",
  "APPROVED_REPAIR",
  "APPROVED_REPLACE",
  "APPROVED_REFUND",
  "DECLINED",
  "IN_REPAIR",
  "RMA_IN_TRANSIT",
  "RESOLVED",
  "CLOSED",
] as const;

export type ClaimStatus = (typeof CLAIM_STATUSES)[number];

export const CLAIM_RESOLUTIONS = [
  "NONE",
  "REPAIR",
  "REPLACE",
  "REFUND",
  "DECLINED",
] as const;

export type ClaimResolution = (typeof CLAIM_RESOLUTIONS)[number];

export interface PolicySnapshot {
  policyId: string;
  policyName: string;
  durationMonths: number;
  doaWindowDays: number;
  repairExtensionMonths: number;
  coveredFaults: FaultCategory[];
  withinCoverageWindow: boolean;
  withinDoaWindow: boolean;
  faultCoveredByPolicy: boolean;
}

export interface DuplicateSignal {
  code:
    | "DUPLICATE_ACTIVE_CLAIM"
    | "PRIOR_SERIAL_CLAIM"
    | "OUT_OF_COVERAGE_WINDOW"
    | "UNCOVERED_FAULT_CATEGORY"
    | "RAPID_CONTACT_VELOCITY"
    | "PENDING_OFFLINE_REGISTRATION";
  severity: "HIGH" | "MEDIUM" | "INFO";
  detail: string;
}

export interface AiClaimSummary {
  provider: "openai-compatible" | "deterministic-fallback";
  generatedAt: string;
  evidenceSummary: string;
  extractedReceiptRef: string | null;
  suggestedFaultCategory: FaultCategory;
  suggestedNextAction: "REQUEST_RECEIPT" | "ROUTE_REPAIR_BENCH" | "REPLACE_DOA" | "HUMAN_INSPECTION";
  draftCustomerReply: string;
  sourceCitations: string[];
  humanApprovalRequired: true;
}

export const warrantyClaims = pgTable(
  "warranty_claims",
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
      .references(() => serialUnits.id, { onDelete: "restrict" }),
    registrationId: uuid("registration_id").references(() => warrantyRegistrations.id, {
      onDelete: "set null",
    }),
    policyId: uuid("policy_id").references(() => warrantyPolicies.id, { onDelete: "set null" }),
    claimNumber: text("claim_number").notNull(),
    submittedByType: text("submitted_by_type")
      .$type<"CUSTOMER" | "DEALER" | "SUPPORT">()
      .notNull()
      .default("CUSTOMER"),
    customerName: text("customer_name").notNull(),
    customerEmail: text("customer_email").notNull(),
    customerPhone: text("customer_phone").notNull(),
    shippingPinCode: text("shipping_pin_code").notNull(),
    shippingCity: text("shipping_city").notNull(),
    shippingAddress: text("shipping_address").notNull(),
    faultCategory: text("fault_category").$type<FaultCategory>().notNull(),
    symptomSummary: text("symptom_summary").notNull(),
    customerDescription: text("customer_description").notNull(),
    purchaseDate: utcTimestamp("purchase_date").notNull(),
    status: text("status").$type<ClaimStatus>().notNull().default("SUBMITTED"),
    priority: text("priority").$type<"NORMAL" | "HIGH" | "URGENT">().notNull().default("NORMAL"),
    resolutionType: text("resolution_type").$type<ClaimResolution>().notNull().default("NONE"),
    declineReasonCode: text("decline_reason_code"),
    decisionNotes: text("decision_notes"),
    decidedByUserId: uuid("decided_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    decidedAt: utcTimestamp("decided_at"),
    refundAmountMinor: moneyMinor("refund_amount_minor"),
    replacementUnitCostMinor: moneyMinor("replacement_unit_cost_minor"),
    policySnapshot: jsonb("policy_snapshot").$type<PolicySnapshot>().notNull(),
    duplicateSignals: jsonb("duplicate_signals").$type<DuplicateSignal[]>().notNull().default([]),
    aiSummary: jsonb("ai_summary").$type<AiClaimSummary | null>(),
    slaFirstResponseDueAt: utcTimestamp("sla_first_response_due_at").notNull(),
    slaResolutionDueAt: utcTimestamp("sla_resolution_due_at").notNull(),
    firstRespondedAt: utcTimestamp("first_responded_at"),
    resolvedAt: utcTimestamp("resolved_at"),
    trackingTokenHash: text("tracking_token_hash").notNull(),
    trackingTokenPreview: text("tracking_token_preview").notNull(),
    demoPublicToken: text("demo_public_token"),
    tokenRevokedAt: utcTimestamp("token_revoked_at"),
    isDemo: boolean("is_demo").notNull().default(false),
    createdAt: createdAtColumn(),
  },
  (table) => [
    uniqueIndex("claims_tenant_number_uq").on(table.tenantId, table.claimNumber),
    uniqueIndex("claims_tracking_token_hash_uq").on(table.trackingTokenHash),
    index("claims_tenant_status_idx").on(table.tenantId, table.status),
    index("claims_tenant_serial_idx").on(table.tenantId, table.serialUnitId),
    index("claims_tenant_product_idx").on(table.tenantId, table.productId),
  ]
);

export const privateBlobs = pgTable(
  "private_blobs",
  {
    storageKey: text("storage_key").primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    mimeType: text("mime_type").notNull(),
    byteSize: integer("byte_size").notNull(),
    sha256Hex: text("sha256_hex").notNull(),
    encryptedEnvelope: text("encrypted_envelope").notNull(),
    createdAt: createdAtColumn(),
  },
  (table) => [index("private_blobs_tenant_idx").on(table.tenantId)]
);

export const claimEvidence = pgTable(
  "claim_evidence",
  {
    id: idColumn(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    claimId: uuid("claim_id").references(() => warrantyClaims.id, { onDelete: "cascade" }),
    registrationId: uuid("registration_id").references(() => warrantyRegistrations.id, {
      onDelete: "cascade",
    }),
    kind: text("kind")
      .$type<"RECEIPT" | "FAULT_PHOTO" | "SERIAL_PHOTO" | "BENCH_INSPECTION">()
      .notNull(),
    fileName: text("file_name").notNull(),
    mimeType: text("mime_type").notNull(),
    byteSize: integer("byte_size").notNull(),
    sha256Hex: text("sha256_hex").notNull(),
    storageKey: text("storage_key")
      .notNull()
      .references(() => privateBlobs.storageKey, { onDelete: "cascade" }),
    uploadedBy: text("uploaded_by").notNull(),
    createdAt: createdAtColumn(),
  },
  (table) => [
    index("evidence_tenant_claim_idx").on(table.tenantId, table.claimId),
    index("evidence_tenant_reg_idx").on(table.tenantId, table.registrationId),
  ]
);

export const claimEvents = pgTable(
  "claim_events",
  {
    id: idColumn(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    claimId: uuid("claim_id")
      .notNull()
      .references(() => warrantyClaims.id, { onDelete: "cascade" }),
    actorType: text("actor_type").$type<"CUSTOMER" | "USER" | "SYSTEM">().notNull(),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    eventType: text("event_type").notNull(),
    message: text("message").notNull(),
    visibility: text("visibility").$type<"PUBLIC" | "INTERNAL">().notNull().default("PUBLIC"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: createdAtColumn(),
  },
  (table) => [index("claim_events_tenant_claim_idx").on(table.tenantId, table.claimId)]
);
