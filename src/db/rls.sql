-- PostgreSQL Row-Level Security (RLS) policies for tenant-scoped tables.
-- Safe to apply idempotently on PostgreSQL 17, Managed Neon Postgres, and PGLite.

DO $$
DECLARE
  tbl text;
  pol text;
  tenant_tables text[] := ARRAY[
    'memberships',
    'sessions',
    'invitations',
    'api_keys',
    'brands',
    'products',
    'warranty_policies',
    'production_batches',
    'serial_units',
    'warranty_registrations',
    'warranty_claims',
    'private_blobs',
    'claim_evidence',
    'claim_events',
    'service_centres',
    'spare_parts',
    'repair_orders',
    'repair_part_usages',
    'rma_orders',
    'subscriptions',
    'usage_counters',
    'billing_invoices',
    'integration_connections',
    'automation_rules',
    'notification_logs',
    'recall_campaigns',
    'audit_logs'
  ];
BEGIN
  FOREACH tbl IN ARRAY tenant_tables LOOP
    pol := tbl || '_tenant_isolation';
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol, tbl);
    EXECUTE format(
      'CREATE POLICY %I ON %I USING (coalesce(current_setting(''app.current_tenant_id'', true), '''') = '''' OR tenant_id::text = current_setting(''app.current_tenant_id'', true)) WITH CHECK (coalesce(current_setting(''app.current_tenant_id'', true), '''') = '''' OR tenant_id::text = current_setting(''app.current_tenant_id'', true))',
      pol,
      tbl
    );
  END LOOP;
END $$;
