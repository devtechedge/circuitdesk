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
import { createdAtColumn, idColumn, utcTimestamp } from "./columns";

export const ROLES = [
  "OWNER",
  "ADMIN",
  "OPERATIONS",
  "SUPPORT",
  "TECHNICIAN",
  "ANALYST",
  "READ_ONLY",
] as const;

export type Role = (typeof ROLES)[number];

export const CURRENCIES = ["INR", "USD"] as const;
export type CurrencyCode = (typeof CURRENCIES)[number];

export const tenants = pgTable(
  "tenants",
  {
    id: idColumn(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    primaryCountry: text("primary_country").notNull().default("IN"),
    defaultCurrency: text("default_currency").$type<CurrencyCode>().notNull().default("INR"),
    gstin: text("gstin"),
    supportEmail: text("support_email").notNull(),
    isDemo: boolean("is_demo").notNull().default(false),
    recallApprovalRequired: boolean("recall_approval_required").notNull().default(true),
    retentionDays: integer("retention_days").notNull().default(1095),
    onboardingCompletedSteps: jsonb("onboarding_completed_steps")
      .$type<string[]>()
      .notNull()
      .default([]),
    createdAt: createdAtColumn(),
  },
  (table) => [uniqueIndex("tenants_slug_uq").on(table.slug)]
);

export const users = pgTable(
  "users",
  {
    id: idColumn(),
    email: text("email").notNull(),
    fullName: text("full_name").notNull(),
    passwordHash: text("password_hash").notNull(),
    isDemo: boolean("is_demo").notNull().default(false),
    disabledAt: utcTimestamp("disabled_at"),
    createdAt: createdAtColumn(),
  },
  (table) => [uniqueIndex("users_email_uq").on(table.email)]
);

export const memberships = pgTable(
  "memberships",
  {
    id: idColumn(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").$type<Role>().notNull(),
    serviceCentreId: uuid("service_centre_id"),
    createdAt: createdAtColumn(),
  },
  (table) => [
    uniqueIndex("memberships_tenant_user_uq").on(table.tenantId, table.userId),
    index("memberships_user_idx").on(table.userId),
  ]
);

export const sessions = pgTable(
  "sessions",
  {
    id: idColumn(),
    tokenHash: text("token_hash").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    ipHash: text("ip_hash").notNull(),
    userAgent: text("user_agent").notNull().default(""),
    expiresAt: utcTimestamp("expires_at").notNull(),
    revokedAt: utcTimestamp("revoked_at"),
    createdAt: createdAtColumn(),
  },
  (table) => [
    uniqueIndex("sessions_token_hash_uq").on(table.tokenHash),
    index("sessions_tenant_user_idx").on(table.tenantId, table.userId),
  ]
);

export const invitations = pgTable(
  "invitations",
  {
    id: idColumn(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: text("role").$type<Role>().notNull(),
    tokenHash: text("token_hash").notNull(),
    invitedByUserId: uuid("invited_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: utcTimestamp("expires_at").notNull(),
    acceptedAt: utcTimestamp("accepted_at"),
    createdAt: createdAtColumn(),
  },
  (table) => [
    uniqueIndex("invitations_token_hash_uq").on(table.tokenHash),
    index("invitations_tenant_idx").on(table.tenantId),
  ]
);

export const apiKeys = pgTable(
  "api_keys",
  {
    id: idColumn(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    keyPrefix: text("key_prefix").notNull(),
    keyHash: text("key_hash").notNull(),
    scopes: jsonb("scopes").$type<string[]>().notNull().default(["serials:read", "claims:read"]),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    lastUsedAt: utcTimestamp("last_used_at"),
    revokedAt: utcTimestamp("revoked_at"),
    createdAt: createdAtColumn(),
  },
  (table) => [
    uniqueIndex("api_keys_hash_uq").on(table.keyHash),
    index("api_keys_tenant_idx").on(table.tenantId),
  ]
);
