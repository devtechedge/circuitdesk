CREATE TABLE "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"key_prefix" text NOT NULL,
	"key_hash" text NOT NULL,
	"scopes" jsonb DEFAULT '["serials:read","claims:read"]'::jsonb NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"email" text NOT NULL,
	"role" text NOT NULL,
	"token_hash" text NOT NULL,
	"invited_by_user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text NOT NULL,
	"service_centre_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_hash" text NOT NULL,
	"user_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"ip_hash" text NOT NULL,
	"user_agent" text DEFAULT '' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"primary_country" text DEFAULT 'IN' NOT NULL,
	"default_currency" text DEFAULT 'INR' NOT NULL,
	"gstin" text,
	"support_email" text NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"recall_approval_required" boolean DEFAULT true NOT NULL,
	"retention_days" integer DEFAULT 1095 NOT NULL,
	"onboarding_completed_steps" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"full_name" text NOT NULL,
	"password_hash" text NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"disabled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "brands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"support_email" text NOT NULL,
	"support_whatsapp" text,
	"accent_hex" text DEFAULT '#fb923c' NOT NULL,
	"portal_headline" text DEFAULT 'Register your hardware, verify coverage, or track a warranty repair.' NOT NULL,
	"hide_circuitdesk_badge" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"brand_id" uuid NOT NULL,
	"sku" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"hsn_code" text DEFAULT '8518' NOT NULL,
	"unit_cost_minor" bigint DEFAULT 0 NOT NULL,
	"retail_price_minor" bigint DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'INR' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "warranty_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"name" text NOT NULL,
	"region_code" text DEFAULT 'IN' NOT NULL,
	"sales_channel" text DEFAULT 'ALL' NOT NULL,
	"duration_months" integer DEFAULT 12 NOT NULL,
	"doa_window_days" integer DEFAULT 7 NOT NULL,
	"repair_extension_months" integer DEFAULT 0 NOT NULL,
	"requires_receipt" boolean DEFAULT true NOT NULL,
	"offline_review_required" boolean DEFAULT true NOT NULL,
	"covered_faults" jsonb DEFAULT '["DOA","BATTERY","CHARGING","CONNECTIVITY","SOFTWARE_FIRMWARE"]'::jsonb NOT NULL,
	"exclusions_note" text DEFAULT 'Excludes liquid ingress, unauthorized modification, and accidental drop damage.' NOT NULL,
	"replace_cost_threshold_minor" bigint DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "production_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"batch_code" text NOT NULL,
	"lot_number" text NOT NULL,
	"supplier_name" text NOT NULL,
	"factory_code" text NOT NULL,
	"manufactured_at" timestamp with time zone NOT NULL,
	"unit_count" integer DEFAULT 0 NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "serial_units" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"brand_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"batch_id" uuid,
	"serial_number" text NOT NULL,
	"imei" text,
	"serial_masked" text NOT NULL,
	"sales_channel" text DEFAULT 'D2C_WEB' NOT NULL,
	"external_order_id" text,
	"sold_at" timestamp with time zone,
	"status" text DEFAULT 'IN_STOCK' NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "warranty_registrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"brand_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"serial_unit_id" uuid NOT NULL,
	"policy_id" uuid NOT NULL,
	"registration_number" text NOT NULL,
	"customer_name" text NOT NULL,
	"customer_email" text NOT NULL,
	"customer_phone" text NOT NULL,
	"customer_pin_code" text NOT NULL,
	"customer_city" text NOT NULL,
	"region_code" text DEFAULT 'IN' NOT NULL,
	"sales_channel" text NOT NULL,
	"source_method" text DEFAULT 'QR' NOT NULL,
	"order_reference" text,
	"dealer_name" text,
	"purchase_date" timestamp with time zone NOT NULL,
	"coverage_start_date" timestamp with time zone NOT NULL,
	"coverage_end_date" timestamp with time zone NOT NULL,
	"status" text NOT NULL,
	"review_notes" text,
	"consent_accepted_at" timestamp with time zone NOT NULL,
	"consent_version" text DEFAULT 'dpdp-2026.1' NOT NULL,
	"certificate_token_hash" text NOT NULL,
	"certificate_token_preview" text NOT NULL,
	"demo_public_token" text,
	"token_revoked_at" timestamp with time zone,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "claim_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"claim_id" uuid NOT NULL,
	"actor_type" text NOT NULL,
	"actor_user_id" uuid,
	"event_type" text NOT NULL,
	"message" text NOT NULL,
	"visibility" text DEFAULT 'PUBLIC' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "claim_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"claim_id" uuid,
	"registration_id" uuid,
	"kind" text NOT NULL,
	"file_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"byte_size" integer NOT NULL,
	"sha256_hex" text NOT NULL,
	"storage_key" text NOT NULL,
	"uploaded_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "private_blobs" (
	"storage_key" text PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"mime_type" text NOT NULL,
	"byte_size" integer NOT NULL,
	"sha256_hex" text NOT NULL,
	"encrypted_envelope" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "warranty_claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"brand_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"serial_unit_id" uuid NOT NULL,
	"registration_id" uuid,
	"policy_id" uuid,
	"claim_number" text NOT NULL,
	"submitted_by_type" text DEFAULT 'CUSTOMER' NOT NULL,
	"customer_name" text NOT NULL,
	"customer_email" text NOT NULL,
	"customer_phone" text NOT NULL,
	"shipping_pin_code" text NOT NULL,
	"shipping_city" text NOT NULL,
	"shipping_address" text NOT NULL,
	"fault_category" text NOT NULL,
	"symptom_summary" text NOT NULL,
	"customer_description" text NOT NULL,
	"purchase_date" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'SUBMITTED' NOT NULL,
	"priority" text DEFAULT 'NORMAL' NOT NULL,
	"resolution_type" text DEFAULT 'NONE' NOT NULL,
	"decline_reason_code" text,
	"decision_notes" text,
	"decided_by_user_id" uuid,
	"decided_at" timestamp with time zone,
	"refund_amount_minor" bigint DEFAULT 0 NOT NULL,
	"replacement_unit_cost_minor" bigint DEFAULT 0 NOT NULL,
	"policy_snapshot" jsonb NOT NULL,
	"duplicate_signals" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"ai_summary" jsonb,
	"sla_first_response_due_at" timestamp with time zone NOT NULL,
	"sla_resolution_due_at" timestamp with time zone NOT NULL,
	"first_responded_at" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	"tracking_token_hash" text NOT NULL,
	"tracking_token_preview" text NOT NULL,
	"demo_public_token" text,
	"token_revoked_at" timestamp with time zone,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "repair_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"claim_id" uuid NOT NULL,
	"service_centre_id" uuid NOT NULL,
	"assigned_technician_id" uuid,
	"job_number" text NOT NULL,
	"routing_reason" text NOT NULL,
	"stage" text DEFAULT 'ROUTED' NOT NULL,
	"inspection_notes" text DEFAULT '' NOT NULL,
	"diagnosis_code" text DEFAULT 'PENDING_BENCH' NOT NULL,
	"qa_passed" boolean DEFAULT false NOT NULL,
	"qa_checklist" jsonb DEFAULT '{"powerOn":false,"chargeTest":false,"burnIn":false,"enclosureSeal":false}'::jsonb NOT NULL,
	"labour_cost_minor" bigint DEFAULT 0 NOT NULL,
	"parts_cost_minor" bigint DEFAULT 0 NOT NULL,
	"freight_cost_minor" bigint DEFAULT 0 NOT NULL,
	"asc_taxable_invoice_minor" bigint DEFAULT 0 NOT NULL,
	"asc_gst_minor" bigint DEFAULT 0 NOT NULL,
	"return_tracking_number" text,
	"return_carrier" text,
	"sla_due_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "repair_part_usages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"repair_order_id" uuid NOT NULL,
	"spare_part_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	"unit_cost_minor" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rma_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"claim_id" uuid NOT NULL,
	"rma_number" text NOT NULL,
	"direction" text DEFAULT 'INBOUND_DEFECTIVE' NOT NULL,
	"carrier_mode" text DEFAULT 'MANUAL' NOT NULL,
	"carrier_name" text DEFAULT 'Manual Customer Drop / Courier' NOT NULL,
	"tracking_number" text,
	"inbound_condition" text,
	"inspection_result" text,
	"disposition" text DEFAULT 'PENDING' NOT NULL,
	"replacement_serial_id" uuid,
	"ewaste_manifest_ref" text,
	"supplier_recovery_minor" bigint DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'ISSUED' NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_centres" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"city" text NOT NULL,
	"state" text NOT NULL,
	"pin_prefixes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"supported_categories" jsonb DEFAULT '["AUDIO","WEARABLE","CHARGING_ACCESSORY","SMART_APPLIANCE","PERIPHERAL"]'::jsonb NOT NULL,
	"centre_type" text DEFAULT 'AUTHORISED_PARTNER' NOT NULL,
	"gstin" text,
	"contact_phone" text NOT NULL,
	"max_active_repairs" integer DEFAULT 40 NOT NULL,
	"active_repairs_count" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "spare_parts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"product_id" uuid,
	"service_centre_id" uuid NOT NULL,
	"part_sku" text NOT NULL,
	"name" text NOT NULL,
	"hsn_code" text DEFAULT '85189000' NOT NULL,
	"unit_cost_minor" bigint DEFAULT 0 NOT NULL,
	"quantity_on_hand" integer DEFAULT 0 NOT NULL,
	"reorder_threshold" integer DEFAULT 5 NOT NULL,
	"supplier_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"actor_user_id" uuid,
	"actor_role" text NOT NULL,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"ip_hash" text DEFAULT 'system' NOT NULL,
	"summary" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "automation_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"trigger_event" text NOT NULL,
	"condition_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"action_type" text NOT NULL,
	"action_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"external_invoice_id" text NOT NULL,
	"amount_minor" bigint DEFAULT 0 NOT NULL,
	"tax_minor" bigint DEFAULT 0 NOT NULL,
	"currency" text NOT NULL,
	"status" text NOT NULL,
	"is_demo_simulated" boolean DEFAULT true NOT NULL,
	"issued_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integration_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"status" text NOT NULL,
	"display_name" text NOT NULL,
	"external_domain" text,
	"encrypted_secret" text,
	"secret_fingerprint" text,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marketing_leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text DEFAULT 'DEMO_REQUEST' NOT NULL,
	"name" text NOT NULL,
	"work_email" text NOT NULL,
	"company" text NOT NULL,
	"monthly_units_band" text NOT NULL,
	"channels" text NOT NULL,
	"message" text DEFAULT '' NOT NULL,
	"ip_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"claim_id" uuid,
	"channel" text NOT NULL,
	"recipient_masked" text NOT NULL,
	"template_name" text NOT NULL,
	"subject" text NOT NULL,
	"delivery_status" text NOT NULL,
	"provider_message_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer DEFAULT 1 NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recall_campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"batch_id" uuid NOT NULL,
	"title" text NOT NULL,
	"reason" text NOT NULL,
	"affected_count" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'DRAFT_AWAITING_APPROVAL' NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"approved_by_user_id" uuid,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"plan_code" text DEFAULT 'STARTER' NOT NULL,
	"billing_currency" text DEFAULT 'INR' NOT NULL,
	"provider" text DEFAULT 'DEMO' NOT NULL,
	"status" text DEFAULT 'TRIALING' NOT NULL,
	"monthly_amount_minor" bigint DEFAULT 0 NOT NULL,
	"external_customer_id" text,
	"external_subscription_id" text,
	"current_period_start" timestamp with time zone NOT NULL,
	"current_period_end" timestamp with time zone NOT NULL,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"is_non_charging_demo" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usage_counters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"period_ym" text NOT NULL,
	"registrations_count" integer DEFAULT 0 NOT NULL,
	"claims_count" integer DEFAULT 0 NOT NULL,
	"ai_summaries_count" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"external_event_id" text NOT NULL,
	"tenant_id" uuid,
	"event_type" text NOT NULL,
	"payload_sha256" text NOT NULL,
	"status" text NOT NULL,
	"processed_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invited_by_user_id_users_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brands" ADD CONSTRAINT "brands_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warranty_policies" ADD CONSTRAINT "warranty_policies_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warranty_policies" ADD CONSTRAINT "warranty_policies_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_batches" ADD CONSTRAINT "production_batches_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_batches" ADD CONSTRAINT "production_batches_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "serial_units" ADD CONSTRAINT "serial_units_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "serial_units" ADD CONSTRAINT "serial_units_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "serial_units" ADD CONSTRAINT "serial_units_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "serial_units" ADD CONSTRAINT "serial_units_batch_id_production_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."production_batches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warranty_registrations" ADD CONSTRAINT "warranty_registrations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warranty_registrations" ADD CONSTRAINT "warranty_registrations_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warranty_registrations" ADD CONSTRAINT "warranty_registrations_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warranty_registrations" ADD CONSTRAINT "warranty_registrations_serial_unit_id_serial_units_id_fk" FOREIGN KEY ("serial_unit_id") REFERENCES "public"."serial_units"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warranty_registrations" ADD CONSTRAINT "warranty_registrations_policy_id_warranty_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."warranty_policies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claim_events" ADD CONSTRAINT "claim_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claim_events" ADD CONSTRAINT "claim_events_claim_id_warranty_claims_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."warranty_claims"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claim_events" ADD CONSTRAINT "claim_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claim_evidence" ADD CONSTRAINT "claim_evidence_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claim_evidence" ADD CONSTRAINT "claim_evidence_claim_id_warranty_claims_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."warranty_claims"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claim_evidence" ADD CONSTRAINT "claim_evidence_registration_id_warranty_registrations_id_fk" FOREIGN KEY ("registration_id") REFERENCES "public"."warranty_registrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claim_evidence" ADD CONSTRAINT "claim_evidence_storage_key_private_blobs_storage_key_fk" FOREIGN KEY ("storage_key") REFERENCES "public"."private_blobs"("storage_key") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "private_blobs" ADD CONSTRAINT "private_blobs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warranty_claims" ADD CONSTRAINT "warranty_claims_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warranty_claims" ADD CONSTRAINT "warranty_claims_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warranty_claims" ADD CONSTRAINT "warranty_claims_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warranty_claims" ADD CONSTRAINT "warranty_claims_serial_unit_id_serial_units_id_fk" FOREIGN KEY ("serial_unit_id") REFERENCES "public"."serial_units"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warranty_claims" ADD CONSTRAINT "warranty_claims_registration_id_warranty_registrations_id_fk" FOREIGN KEY ("registration_id") REFERENCES "public"."warranty_registrations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warranty_claims" ADD CONSTRAINT "warranty_claims_policy_id_warranty_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."warranty_policies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warranty_claims" ADD CONSTRAINT "warranty_claims_decided_by_user_id_users_id_fk" FOREIGN KEY ("decided_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repair_orders" ADD CONSTRAINT "repair_orders_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repair_orders" ADD CONSTRAINT "repair_orders_claim_id_warranty_claims_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."warranty_claims"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repair_orders" ADD CONSTRAINT "repair_orders_service_centre_id_service_centres_id_fk" FOREIGN KEY ("service_centre_id") REFERENCES "public"."service_centres"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repair_orders" ADD CONSTRAINT "repair_orders_assigned_technician_id_users_id_fk" FOREIGN KEY ("assigned_technician_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repair_part_usages" ADD CONSTRAINT "repair_part_usages_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repair_part_usages" ADD CONSTRAINT "repair_part_usages_repair_order_id_repair_orders_id_fk" FOREIGN KEY ("repair_order_id") REFERENCES "public"."repair_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repair_part_usages" ADD CONSTRAINT "repair_part_usages_spare_part_id_spare_parts_id_fk" FOREIGN KEY ("spare_part_id") REFERENCES "public"."spare_parts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rma_orders" ADD CONSTRAINT "rma_orders_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rma_orders" ADD CONSTRAINT "rma_orders_claim_id_warranty_claims_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."warranty_claims"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rma_orders" ADD CONSTRAINT "rma_orders_replacement_serial_id_serial_units_id_fk" FOREIGN KEY ("replacement_serial_id") REFERENCES "public"."serial_units"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_centres" ADD CONSTRAINT "service_centres_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spare_parts" ADD CONSTRAINT "spare_parts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spare_parts" ADD CONSTRAINT "spare_parts_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spare_parts" ADD CONSTRAINT "spare_parts_service_centre_id_service_centres_id_fk" FOREIGN KEY ("service_centre_id") REFERENCES "public"."service_centres"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_rules" ADD CONSTRAINT "automation_rules_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_invoices" ADD CONSTRAINT "billing_invoices_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_connections" ADD CONSTRAINT "integration_connections_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_claim_id_warranty_claims_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."warranty_claims"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recall_campaigns" ADD CONSTRAINT "recall_campaigns_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recall_campaigns" ADD CONSTRAINT "recall_campaigns_batch_id_production_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."production_batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recall_campaigns" ADD CONSTRAINT "recall_campaigns_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recall_campaigns" ADD CONSTRAINT "recall_campaigns_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_counters" ADD CONSTRAINT "usage_counters_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_events" ADD CONSTRAINT "webhook_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "api_keys_hash_uq" ON "api_keys" USING btree ("key_hash");--> statement-breakpoint
CREATE INDEX "api_keys_tenant_idx" ON "api_keys" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invitations_token_hash_uq" ON "invitations" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "invitations_tenant_idx" ON "invitations" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "memberships_tenant_user_uq" ON "memberships" USING btree ("tenant_id","user_id");--> statement-breakpoint
CREATE INDEX "memberships_user_idx" ON "memberships" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_hash_uq" ON "sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "sessions_tenant_user_idx" ON "sessions" USING btree ("tenant_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tenants_slug_uq" ON "tenants" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_uq" ON "users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "brands_slug_uq" ON "brands" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "brands_tenant_idx" ON "brands" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "products_tenant_sku_uq" ON "products" USING btree ("tenant_id","sku");--> statement-breakpoint
CREATE INDEX "products_tenant_brand_idx" ON "products" USING btree ("tenant_id","brand_id");--> statement-breakpoint
CREATE INDEX "policies_tenant_product_idx" ON "warranty_policies" USING btree ("tenant_id","product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "batches_tenant_code_uq" ON "production_batches" USING btree ("tenant_id","batch_code");--> statement-breakpoint
CREATE INDEX "batches_tenant_product_idx" ON "production_batches" USING btree ("tenant_id","product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "serials_tenant_serial_uq" ON "serial_units" USING btree ("tenant_id","serial_number");--> statement-breakpoint
CREATE INDEX "serials_tenant_batch_idx" ON "serial_units" USING btree ("tenant_id","batch_id");--> statement-breakpoint
CREATE INDEX "serials_tenant_product_idx" ON "serial_units" USING btree ("tenant_id","product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "registrations_tenant_number_uq" ON "warranty_registrations" USING btree ("tenant_id","registration_number");--> statement-breakpoint
CREATE UNIQUE INDEX "registrations_cert_token_hash_uq" ON "warranty_registrations" USING btree ("certificate_token_hash");--> statement-breakpoint
CREATE INDEX "registrations_tenant_status_idx" ON "warranty_registrations" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "registrations_tenant_email_idx" ON "warranty_registrations" USING btree ("tenant_id","customer_email");--> statement-breakpoint
CREATE INDEX "claim_events_tenant_claim_idx" ON "claim_events" USING btree ("tenant_id","claim_id");--> statement-breakpoint
CREATE INDEX "evidence_tenant_claim_idx" ON "claim_evidence" USING btree ("tenant_id","claim_id");--> statement-breakpoint
CREATE INDEX "evidence_tenant_reg_idx" ON "claim_evidence" USING btree ("tenant_id","registration_id");--> statement-breakpoint
CREATE INDEX "private_blobs_tenant_idx" ON "private_blobs" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "claims_tenant_number_uq" ON "warranty_claims" USING btree ("tenant_id","claim_number");--> statement-breakpoint
CREATE UNIQUE INDEX "claims_tracking_token_hash_uq" ON "warranty_claims" USING btree ("tracking_token_hash");--> statement-breakpoint
CREATE INDEX "claims_tenant_status_idx" ON "warranty_claims" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "claims_tenant_serial_idx" ON "warranty_claims" USING btree ("tenant_id","serial_unit_id");--> statement-breakpoint
CREATE INDEX "claims_tenant_product_idx" ON "warranty_claims" USING btree ("tenant_id","product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "repairs_tenant_job_uq" ON "repair_orders" USING btree ("tenant_id","job_number");--> statement-breakpoint
CREATE INDEX "repairs_tenant_stage_idx" ON "repair_orders" USING btree ("tenant_id","stage");--> statement-breakpoint
CREATE INDEX "repairs_tenant_centre_idx" ON "repair_orders" USING btree ("tenant_id","service_centre_id");--> statement-breakpoint
CREATE INDEX "part_usage_tenant_repair_idx" ON "repair_part_usages" USING btree ("tenant_id","repair_order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "rma_tenant_number_uq" ON "rma_orders" USING btree ("tenant_id","rma_number");--> statement-breakpoint
CREATE INDEX "rma_tenant_claim_idx" ON "rma_orders" USING btree ("tenant_id","claim_id");--> statement-breakpoint
CREATE UNIQUE INDEX "centres_tenant_code_uq" ON "service_centres" USING btree ("tenant_id","code");--> statement-breakpoint
CREATE INDEX "centres_tenant_idx" ON "service_centres" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "parts_centre_sku_uq" ON "spare_parts" USING btree ("service_centre_id","part_sku");--> statement-breakpoint
CREATE INDEX "parts_tenant_idx" ON "spare_parts" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "audit_tenant_created_idx" ON "audit_logs" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "automations_tenant_idx" ON "automation_rules" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_provider_ext_uq" ON "billing_invoices" USING btree ("provider","external_invoice_id");--> statement-breakpoint
CREATE INDEX "invoices_tenant_idx" ON "billing_invoices" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "integrations_tenant_provider_uq" ON "integration_connections" USING btree ("tenant_id","provider");--> statement-breakpoint
CREATE INDEX "integrations_tenant_idx" ON "integration_connections" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "notifications_tenant_idx" ON "notification_logs" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "recalls_tenant_idx" ON "recall_campaigns" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "subscriptions_tenant_uq" ON "subscriptions" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "usage_tenant_period_uq" ON "usage_counters" USING btree ("tenant_id","period_ym");--> statement-breakpoint
CREATE UNIQUE INDEX "webhooks_provider_event_uq" ON "webhook_events" USING btree ("provider","external_event_id");