# Data Model Specification

All monetary amounts are stored as 64-bit safe integers in minor currency units (`paise` for `INR`, `cents` for `USD`). All timestamps are UTC (`timestamptz`). Every tenant-owned table carries a non-null `tenant_id` foreign key indexed as the leading column of composite indexes.

## 1. Identity, Tenancy and RBAC (`src/db/schema/identity.ts`)

- `tenants`: `id`, `slug` (unique), `name`, `primary_country` (`IN` default), `default_currency` (`INR` | `USD`), `gstin`, `is_demo`, `recall_approval_required` (`true`), `retention_days` (`1095`), `created_at`.
- `users`: `id`, `email` (citext/lowercase unique), `full_name`, `password_hash` (`scrypt`), `created_at`, `disabled_at`.
- `memberships`: `id`, `tenant_id`, `user_id`, `role` (`OWNER` | `ADMIN` | `OPERATIONS` | `SUPPORT` | `TECHNICIAN` | `ANALYST` | `READ_ONLY`), `service_centre_id` (nullable for bench technicians), unique `(tenant_id, user_id)`.
- `sessions`: `id`, `token_hash` (SHA-256 unique), `user_id`, `tenant_id`, `ip_hash`, `user_agent`, `expires_at`, `revoked_at`, `created_at`.
- `invitations`: `id`, `tenant_id`, `email`, `role`, `token_hash`, `invited_by_user_id`, `expires_at`, `accepted_at`.
- `api_keys`: `id`, `tenant_id`, `name`, `key_prefix`, `key_hash` (SHA-256 unique), `scopes`, `last_used_at`, `revoked_at`, `created_at`.

## 2. Brands, Products and Policies (`src/db/schema/catalog.ts`)

- `brands`: `id`, `tenant_id`, `slug` (unique), `name`, `support_email`, `support_whatsapp`, `accent_hex`, `hide_circuitdesk_badge` (`boolean`), `portal_headline`, `created_at`.
- `products`: `id`, `tenant_id`, `brand_id`, `sku`, `name`, `category` (`AUDIO` | `WEARABLE` | `CHARGING_ACCESSORY` | `SMART_APPLIANCE` | `PERIPHERAL`), `hsn_code`, `unit_cost_minor`, `retail_price_minor`, `currency`, `active`, `created_at`. Unique `(tenant_id, sku)`.
- `warranty_policies`: `id`, `tenant_id`, `product_id`, `name`, `region_code` (`IN`, `EU`, `US`, `GLOBAL`), `sales_channel` (`ALL` | `D2C_WEB` | `MARKETPLACE` | `AUTHORISED_DEALER` | `OFFLINE_RETAIL`), `duration_months`, `doa_window_days`, `repair_extension_months`, `requires_receipt`, `offline_review_required`, `covered_faults` (JSON array), `exclusions_note`, `replace_cost_threshold_minor`, `active`.

## 3. Batches, Serials and Registrations (`src/db/schema/registry.ts`)

- `production_batches`: `id`, `tenant_id`, `product_id`, `batch_code`, `lot_number`, `supplier_name`, `factory_code`, `manufactured_at`, `unit_count`, `notes`. Unique `(tenant_id, batch_code)`.
- `serial_units`: `id`, `tenant_id`, `brand_id`, `product_id`, `batch_id`, `serial_number`, `imei` (nullable), `serial_masked`, `sales_channel`, `external_order_id`, `sold_at`, `status` (`IN_STOCK` | `SOLD` | `REGISTERED` | `CLAIMED` | `REPLACED` | `SCRAPPED`), `is_demo`. Unique `(tenant_id, serial_number)`.
- `warranty_registrations`: `id`, `tenant_id`, `brand_id`, `product_id`, `serial_unit_id`, `policy_id`, `registration_number`, `customer_name`, `customer_email`, `customer_phone`, `customer_pin_code`, `customer_city`, `region_code`, `sales_channel`, `order_reference`, `dealer_name`, `purchase_date`, `coverage_start_date`, `coverage_end_date`, `status` (`ACTIVE` | `PENDING_REVIEW` | `REJECTED` | `EXPIRED` | `REVOKED` | `ERASED`), `review_notes`, `consent_accepted_at`, `consent_version`, `certificate_token_hash` (SHA-256 unique), `certificate_token_preview`, `token_revoked_at`, `is_demo`, `created_at`.

## 4. Claims, Private Evidence and Event History (`src/db/schema/claims.ts`)

- `warranty_claims`: `id`, `tenant_id`, `brand_id`, `product_id`, `serial_unit_id`, `registration_id`, `policy_id`, `claim_number` (unique per tenant), `submitted_by_type` (`CUSTOMER` | `DEALER` | `SUPPORT`), `customer_name`, `customer_email`, `customer_phone`, `shipping_pin_code`, `shipping_city`, `shipping_address`, `fault_category` (`DOA` | `BATTERY` | `CHARGING` | `CONNECTIVITY` | `PHYSICAL_DAMAGE` | `MISSING_PARTS` | `SOFTWARE_FIRMWARE`), `symptom_summary`, `customer_description`, `purchase_date`, `status` (`SUBMITTED` | `NEEDS_INFO` | `IN_TRIAGE` | `APPROVED_REPAIR` | `APPROVED_REPLACE` | `APPROVED_REFUND` | `DECLINED` | `IN_REPAIR` | `RMA_IN_TRANSIT` | `RESOLVED` | `CLOSED`), `resolution_type` (`NONE` | `REPAIR` | `REPLACE` | `REFUND` | `DECLINED`), `decline_reason_code`, `decision_notes`, `decided_by_user_id`, `decided_at`, `refund_amount_minor`, `policy_snapshot` (JSONB), `duplicate_signals` (JSONB), `ai_summary` (JSONB nullable), `sla_first_response_due_at`, `sla_resolution_due_at`, `first_responded_at`, `resolved_at`, `tracking_token_hash` (SHA-256 unique), `token_revoked_at`, `is_demo`, `created_at`.
- `claim_evidence`: `id`, `tenant_id`, `claim_id`, `registration_id` (nullable), `kind` (`RECEIPT` | `FAULT_PHOTO` | `SERIAL_PHOTO` | `BENCH_INSPECTION`), `file_name`, `mime_type`, `byte_size`, `sha256_hex`, `storage_key`, `uploaded_by`, `created_at`.
- `claim_events`: `id`, `tenant_id`, `claim_id`, `actor_type` (`CUSTOMER` | `USER` | `SYSTEM`), `actor_user_id`, `event_type`, `message`, `visibility` (`PUBLIC` | `INTERNAL`), `metadata` (JSONB), `created_at`.

## 5. Service Network, Repairs, Parts and RMAs (`src/db/schema/repairs.ts`)

- `service_centres`: `id`, `tenant_id`, `name`, `code`, `city`, `state`, `pin_prefixes` (JSON array of 3-digit or 6-digit prefixes), `supported_categories` (JSON array), `centre_type` (`OWNED_BENCH` | `AUTHORISED_PARTNER`), `gstin`, `contact_phone`, `max_active_repairs`, `active_repairs_count`, `active`.
- `spare_parts`: `id`, `tenant_id`, `product_id` (nullable for universal parts), `service_centre_id`, `part_sku`, `name`, `hsn_code`, `unit_cost_minor`, `quantity_on_hand`, `reorder_threshold`, `supplier_name`.
- `repair_orders`: `id`, `tenant_id`, `claim_id`, `service_centre_id`, `assigned_technician_id`, `job_number`, `routing_reason`, `stage` (`ROUTED` | `RECEIVED` | `DIAGNOSING` | `AWAITING_PARTS` | `REPAIRING` | `QA_TESTING` | `DISPATCHED` | `UNREPAIRABLE`), `inspection_notes`, `diagnosis_code`, `qa_passed`, `qa_checklist` (JSONB), `labour_cost_minor`, `parts_cost_minor`, `freight_cost_minor`, `asc_taxable_invoice_minor`, `asc_gst_minor`, `return_tracking_number`, `return_carrier`, `sla_due_at`, `completed_at`, `is_demo`, `created_at`.
- `repair_part_usages`: `id`, `tenant_id`, `repair_order_id`, `spare_part_id`, `quantity`, `unit_cost_minor`, `created_at`.
- `rma_orders`: `id`, `tenant_id`, `claim_id`, `rma_number`, `direction` (`INBOUND_DEFECTIVE` | `OUTBOUND_REPLACEMENT` | `RETURN_TO_VENDOR`), `carrier_mode` (`MANUAL` | `CARRIER_API`), `carrier_name`, `tracking_number`, `inbound_condition`, `inspection_result`, `disposition` (`PENDING` | `REPAIR_RETURN` | `REFURBISH_STOCK` | `SCRAP_EWASTE` | `RETURN_TO_VENDOR`), `replacement_serial_id`, `ewaste_manifest_ref`, `supplier_recovery_minor`, `status` (`ISSUED` | `IN_TRANSIT` | `RECEIVED` | `INSPECTED` | `CLOSED`), `created_at`.

## 6. Billing, Usage, Integrations, Notifications and Audit (`src/db/schema/operations.ts`)

- `subscriptions`: `id`, `tenant_id` (unique), `plan_code` (`STARTER` | `GROWTH` | `SCALE` | `ENTERPRISE`), `billing_currency` (`INR` | `USD`), `provider` (`DEMO` | `STRIPE` | `RAZORPAY`), `status` (`TRIALING` | `ACTIVE` | `PAST_DUE` | `FAILED` | `CANCELED`), `monthly_amount_minor`, `external_customer_id`, `external_subscription_id`, `current_period_start`, `current_period_end`, `cancel_at_period_end`, `updated_at`.
- `usage_counters`: `id`, `tenant_id`, `period_ym` (`YYYY-MM`), `registrations_count`, `claims_count`, `ai_summaries_count`, unique `(tenant_id, period_ym)`.
- `billing_invoices`: `id`, `tenant_id`, `provider`, `external_invoice_id`, `amount_minor`, `tax_minor`, `currency`, `status`, `issued_at`.
- `webhook_events`: `id`, `provider` (`STRIPE` | `RAZORPAY` | `SHOPIFY` | `WOOCOMMERCE` | `WHATSAPP`), `external_event_id`, `tenant_id` (nullable), `payload_sha256`, `status`, `processed_at`, unique `(provider, external_event_id)`.
- `integration_connections`: `id`, `tenant_id`, `provider` (`SHOPIFY` | `WOOCOMMERCE` | `MARKETPLACE_CSV` | `WHATSAPP` | `EMAIL` | `OUTBOUND_WEBHOOK`), `status`, `display_name`, `external_domain`, `encrypted_secret` (AES-256-GCM envelope), `secret_fingerprint`, `config` (JSONB), `last_synced_at`.
- `automation_rules`: `id`, `tenant_id`, `name`, `trigger_event`, `condition_json`, `action_type` (`TAG_PRIORITY` | `NOTIFY_CHANNEL` | `ASSIGN_BENCH` | `SLA_ESCALATE`), `action_config`, `enabled`.
- `notification_logs`: `id`, `tenant_id`, `claim_id` (nullable), `channel` (`EMAIL` | `WHATSAPP` | `WEBHOOK`), `recipient_masked`, `template_name`, `delivery_status` (`DEV_SINK` | `SENT_UNCONFIRMED` | `DELIVERED_CONFIRMED` | `FAILED`), `provider_message_id`, `created_at`.
- `recall_campaigns`: `id`, `tenant_id`, `batch_id`, `title`, `reason`, `affected_count`, `status` (`DRAFT` | `APPROVED` | `SENT`), `approved_by_user_id`, `approved_at`, `created_at`.
- `audit_logs`: `id`, `tenant_id`, `actor_user_id`, `actor_role`, `action`, `entity_type`, `entity_id`, `ip_hash`, `summary`, `metadata` (JSONB), `created_at`.
- `marketing_leads`: `id`, `kind` (`DEMO_REQUEST` | `CONTACT` | `MIGRATION_HELP`), `name`, `work_email`, `company`, `monthly_units_band`, `channels`, `message`, `created_at`.
- `rate_limits`: `key`, `count`, `window_start`, `updated_at`.
