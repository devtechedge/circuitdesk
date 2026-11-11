# Testing and Quality Assurance Guide

## 1. Test Layers

1. **Static Analysis (`pnpm lint && pnpm typecheck`)**
   - ESLint 9 flat config (`eslint-config-next` core-web-vitals + strict TypeScript rules, zero `any`).
   - `next typegen && tsc --noEmit` with `strict: true` and `noUncheckedIndexedAccess: true`.

2. **Pure Domain & Repository Hygiene Unit Tests (`pnpm test`)**
   - `tests/unit/domain.test.ts`: integer minor-unit money math, intra-state vs inter-state 18% GST split, warranty coverage windows, DOA days, EU repair extensions, 6-digit Indian PIN routing, and SLA clocks.
   - `tests/unit/security.test.ts`: scrypt hashing, AES-256-GCM canonical base64url tamper rejection, serial/IMEI/email masking, 7-role RBAC matrix, CSRF & open-redirect blocking, and replay-safe webhook HMACs.
   - `tests/unit/csv-signals-plans.test.ts`: CSV dry-run validation (duplicate serials, unknown SKUs, 15-digit IMEIs, formula injection), offline QR SVG generation, duplicate-claim risk signals, `$2,000 MRR` recurring-only calculation, and CBIC Circular 195/07/2023-GST CSV exports.
   - `tests/unit/public-text-hygiene.test.ts`: repository-wide scan enforcing zero em dashes, zero forbidden framing terms, and zero leaked live secret prefixes.

3. **PostgreSQL Integration Suite (`pnpm test:integration`)**
   - Runs identically against embedded PGLite locally or `postgres:17` in GitHub Actions CI.
   - `tests/integration/tenancy-rbac.test.ts`: proves cross-tenant 404/403 IDOR denial, kernel-level PostgreSQL Row-Level Security (`CREATE ROLE cd_rls_probe NOSUPERUSER NOBYPASSRLS` + `SET LOCAL app.current_tenant_id`), Analyst/Read-Only serial masking, Technician bench assignment scoping, and Owner-gated batch recalls.
   - `tests/integration/lifecycle.test.ts`: proves end-to-end SKU -> policy -> CSV import -> online/offline registration -> certificate revocation -> encrypted PNG receipt claim -> deterministic AI triage brief -> human repair approval -> PIN routing -> atomic spare-part stock decrement -> 4-point QA dispatch -> live tracker -> analytics & GST export.
   - `tests/integration/webhooks-billing-privacy.test.ts`: proves Stripe, Razorpay, and Shopify signed webhook verification + idempotency deduplication, Scale API key plan gating, and DPDP Data Principal JSON export + PII erasure.

4. **Browser End-to-End & WCAG 2.2 AA Suite (`pnpm build && pnpm e2e`)**
   - Runs Playwright Chromium against the production `next start` server (`port 3117`).
   - Verifies security headers, unauthenticated `/app` redirect, forged webhook `401`, invalid token `404`, dark/light `ThemeToggle`, `scrollWidth <= innerWidth` across `390px`, `768px`, and `1440px`, `@axe-core/playwright` WCAG 2.2 AA zero serious/critical violations in both light and dark themes, and the full signup-to-analytics browser journey.
