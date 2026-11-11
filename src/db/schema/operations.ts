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
import { warrantyClaims } from "./claims";
import { createdAtColumn, idColumn, moneyMinor, updatedAtColumn, utcTimestamp } from "./columns";
import { type CurrencyCode, type Role, tenants, users } from "./identity";
import { productionBatches } from "./registry";

export const PLAN_CODES = ["STARTER", "GROWTH", "SCALE", "ENTERPRISE"] as const;
export type PlanCode = (typeof PLAN_CODES)[number];

export const SUBSCRIPTION_STATUSES = [
  "TRIALING",
  "ACTIVE",
  "PAST_DUE",
  "FAILED",
  "CANCELED",
] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export const BILLING_PROVIDERS = ["DEMO", "STRIPE", "RAZORPAY"] as const;
export type BillingProvider = (typeof BILLING_PROVIDERS)[number];

export const AUTOMATION_ACTIONS = [
  "TAG_PRIORITY",
  "NOTIFY_CHANNEL",
  "ASSIGN_BENCH",
  "SLA_ESCALATE",
] as const;
export type AutomationAction = (typeof AUTOMATION_ACTIONS)[number];

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: idColumn(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    planCode: text("plan_code").$type<PlanCode>().notNull().default("STARTER"),
    billingCurrency: text("billing_currency").$type<CurrencyCode>().notNull().default("INR"),
    provider: text("provider").$type<BillingProvider>().notNull().default("DEMO"),
    status: text("status").$type<SubscriptionStatus>().notNull().default("TRIALING"),
    monthlyAmountMinor: moneyMinor("monthly_amount_minor"),
    externalCustomerId: text("external_customer_id"),
    externalSubscriptionId: text("external_subscription_id"),
    currentPeriodStart: utcTimestamp("current_period_start").notNull(),
    currentPeriodEnd: utcTimestamp("current_period_end").notNull(),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    isNonChargingDemo: boolean("is_non_charging_demo").notNull().default(true),
    updatedAt: updatedAtColumn(),
    createdAt: createdAtColumn(),
  },
  (table) => [uniqueIndex("subscriptions_tenant_uq").on(table.tenantId)]
);

export const usageCounters = pgTable(
  "usage_counters",
  {
    id: idColumn(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    periodYm: text("period_ym").notNull(),
    registrationsCount: integer("registrations_count").notNull().default(0),
    claimsCount: integer("claims_count").notNull().default(0),
    aiSummariesCount: integer("ai_summaries_count").notNull().default(0),
    updatedAt: updatedAtColumn(),
  },
  (table) => [uniqueIndex("usage_tenant_period_uq").on(table.tenantId, table.periodYm)]
);

export const billingInvoices = pgTable(
  "billing_invoices",
  {
    id: idColumn(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    provider: text("provider").$type<BillingProvider>().notNull(),
    externalInvoiceId: text("external_invoice_id").notNull(),
    amountMinor: moneyMinor("amount_minor"),
    taxMinor: moneyMinor("tax_minor"),
    currency: text("currency").$type<CurrencyCode>().notNull(),
    status: text("status").$type<"DRAFT" | "PAID" | "OPEN" | "VOID" | "FAILED">().notNull(),
    isDemoSimulated: boolean("is_demo_simulated").notNull().default(true),
    issuedAt: utcTimestamp("issued_at").notNull(),
    createdAt: createdAtColumn(),
  },
  (table) => [
    uniqueIndex("invoices_provider_ext_uq").on(table.provider, table.externalInvoiceId),
    index("invoices_tenant_idx").on(table.tenantId),
  ]
);

export const webhookEvents = pgTable(
  "webhook_events",
  {
    id: idColumn(),
    provider: text("provider")
      .$type<"STRIPE" | "RAZORPAY" | "SHOPIFY" | "WOOCOMMERCE" | "WHATSAPP">()
      .notNull(),
    externalEventId: text("external_event_id").notNull(),
    tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "set null" }),
    eventType: text("event_type").notNull(),
    payloadSha256: text("payload_sha256").notNull(),
    status: text("status").$type<"PROCESSED" | "IGNORED" | "FAILED">().notNull(),
    processedAt: utcTimestamp("processed_at").notNull(),
    createdAt: createdAtColumn(),
  },
  (table) => [uniqueIndex("webhooks_provider_event_uq").on(table.provider, table.externalEventId)]
);

export const integrationConnections = pgTable(
  "integration_connections",
  {
    id: idColumn(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    provider: text("provider")
      .$type<
        | "SHOPIFY"
        | "WOOCOMMERCE"
        | "MARKETPLACE_CSV"
        | "WHATSAPP"
        | "EMAIL"
        | "OUTBOUND_WEBHOOK"
      >()
      .notNull(),
    status: text("status")
      .$type<"CONNECTED" | "DISCONNECTED" | "DEV_SINK" | "PENDING_APP_REVIEW">()
      .notNull(),
    displayName: text("display_name").notNull(),
    externalDomain: text("external_domain"),
    encryptedSecret: text("encrypted_secret"),
    secretFingerprint: text("secret_fingerprint"),
    config: jsonb("config").$type<Record<string, unknown>>().notNull().default({}),
    lastSyncedAt: utcTimestamp("last_synced_at"),
    createdAt: createdAtColumn(),
  },
  (table) => [
    uniqueIndex("integrations_tenant_provider_uq").on(table.tenantId, table.provider),
    index("integrations_tenant_idx").on(table.tenantId),
  ]
);

export const automationRules = pgTable(
  "automation_rules",
  {
    id: idColumn(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    triggerEvent: text("trigger_event")
      .$type<"CLAIM_SUBMITTED" | "REPAIR_DISPATCHED" | "SLA_75_PERCENT" | "BATCH_SPIKE">()
      .notNull(),
    conditionJson: jsonb("condition_json").$type<Record<string, unknown>>().notNull().default({}),
    actionType: text("action_type").$type<AutomationAction>().notNull(),
    actionConfig: jsonb("action_config").$type<Record<string, unknown>>().notNull().default({}),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: createdAtColumn(),
  },
  (table) => [index("automations_tenant_idx").on(table.tenantId)]
);

export const notificationLogs = pgTable(
  "notification_logs",
  {
    id: idColumn(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    claimId: uuid("claim_id").references(() => warrantyClaims.id, { onDelete: "set null" }),
    channel: text("channel").$type<"EMAIL" | "WHATSAPP" | "WEBHOOK">().notNull(),
    recipientMasked: text("recipient_masked").notNull(),
    templateName: text("template_name").notNull(),
    subject: text("subject").notNull(),
    deliveryStatus: text("delivery_status")
      .$type<"DEV_SINK" | "SENT_UNCONFIRMED" | "DELIVERED_CONFIRMED" | "FAILED">()
      .notNull(),
    providerMessageId: text("provider_message_id"),
    createdAt: createdAtColumn(),
  },
  (table) => [index("notifications_tenant_idx").on(table.tenantId)]
);

export const recallCampaigns = pgTable(
  "recall_campaigns",
  {
    id: idColumn(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    batchId: uuid("batch_id")
      .notNull()
      .references(() => productionBatches.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    reason: text("reason").notNull(),
    affectedCount: integer("affected_count").notNull().default(0),
    status: text("status")
      .$type<"DRAFT_AWAITING_APPROVAL" | "APPROVED_READY" | "DISPATCHED">()
      .notNull()
      .default("DRAFT_AWAITING_APPROVAL"),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    approvedByUserId: uuid("approved_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    approvedAt: utcTimestamp("approved_at"),
    createdAt: createdAtColumn(),
  },
  (table) => [index("recalls_tenant_idx").on(table.tenantId)]
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: idColumn(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    actorRole: text("actor_role").$type<Role | "SYSTEM" | "PORTAL">().notNull(),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    ipHash: text("ip_hash").notNull().default("system"),
    summary: text("summary").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: createdAtColumn(),
  },
  (table) => [index("audit_tenant_created_idx").on(table.tenantId, table.createdAt)]
);

export const marketingLeads = pgTable("marketing_leads", {
  id: idColumn(),
  kind: text("kind")
    .$type<"DEMO_REQUEST" | "CONTACT" | "MIGRATION_HELP">()
    .notNull()
    .default("DEMO_REQUEST"),
  name: text("name").notNull(),
  workEmail: text("work_email").notNull(),
  company: text("company").notNull(),
  monthlyUnitsBand: text("monthly_units_band").notNull(),
  channels: text("channels").notNull(),
  message: text("message").notNull().default(""),
  ipHash: text("ip_hash").notNull(),
  createdAt: createdAtColumn(),
});

export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull().default(1),
  windowStart: utcTimestamp("window_start").notNull(),
  updatedAt: updatedAtColumn(),
});
