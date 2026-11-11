# Security Policy and Threat Model

## 1. Architecture and Multi-Tenant Isolation

CircuitDesk is a multi-tenant Next.js 16 + PostgreSQL (Drizzle ORM) application. Every tenant-owned table enforces a non-null `tenant_id` foreign key and runs inside `withTenantDb(tenantId, ...)` transactions that pin `app.current_tenant_id` locally (`SET LOCAL`) alongside PostgreSQL `ENABLE` + `FORCE ROW LEVEL SECURITY` policies.

Client-supplied tenant identifiers in request bodies or query strings are never trusted for console operations; `tenantId` is resolved exclusively from the server-verified `sessions` or `api_keys` row.

## 2. Authentication, Sessions and RBAC

- **Passwords**: hashed with Node `crypto.scryptSync` using per-user 16-byte random salts (`scrypt$<salt>$<hex>`) and verified via `timingSafeEqual`. No NextAuth or unsigned base64 role cookies are used.
- **Sessions**: opaque 256-bit `cd_sess_*` tokens stored strictly as SHA-256 hashes in PostgreSQL (`sessions.token_hash`), delivered in `HttpOnly`, `SameSite=Lax` cookies (`Secure` in production) with explicit revocation (`POST /api/auth/logout`, `POST /api/sessions/revoke`).
- **7-Role RBAC**: `OWNER`, `ADMIN`, `OPERATIONS`, `SUPPORT`, `TECHNICIAN`, `ANALYST`, and `READ_ONLY` enforced server-side on every read and write.
  - `ANALYST` and `READ_ONLY` receive masked serial numbers and IMEIs automatically.
  - `TECHNICIAN` operators assigned to a `service_centre_id` are restricted to repair jobs at their own bench.
  - Claim adjudication (`claims:adjudicate`) is restricted to authenticated humans; neither workflow automations nor the optional AI triage summarizer can auto-decline coverage.
  - Batch recall campaigns require explicit `OWNER` or `ADMIN` human approval (`recall:approve`).

## 3. Input Validation, CSRF, Rate Limiting and Uploads

- **CSRF & Open Redirects**: mutating cookie-authenticated endpoints enforce `Origin` === `Host` (`verifySameOrigin`), and post-login redirects pass through `sanitizeNextPath` rejecting protocol-relative and external URLs.
- **Validation & SQLi**: all inputs are parsed with Zod schemas; SQL queries use parameterized Drizzle statements. CSV serial imports block spreadsheet formula prefixes (`=`, `+`, `-`, `@`).
- **Private Evidence Vault**: customer receipts and defect photos are capped at 4 MB, checked against PNG/JPEG/WebP/PDF magic-byte signatures, encrypted at rest in `private_blobs` using AES-256-GCM (`ENCRYPTION_KEY`) with canonical base64url envelope verification, and served only via short-lived HMAC-signed URLs (`FILE_SIGNING_SECRET`) with `Content-Disposition: attachment`, `X-Content-Type-Options: nosniff`, and `Content-Security-Policy: default-src 'none'; sandbox`.
- **Connector Secrets & API Keys**: third-party connector secrets are encrypted at rest with AES-256-GCM and never returned in API reads (only SHA-256 fingerprint + mask). External `/api/v1/*` Bearer keys (`cd_live_*`) store only SHA-256 hashes and enforce plan entitlements.
- **Webhooks**: Stripe (`t,v1` with 300s replay window), Razorpay (hex HMAC-SHA256), Shopify (base64 HMAC-SHA256), and WooCommerce signatures are verified in constant time and deduplicated in `webhook_events (provider, external_event_id)`.

## 4. Accepted Residual Risk in Public Demo Mode

When `DEMO_MODE=true`, `/api/auth/demo` and published synthetic personas (`ops@kinetix-audio.demo` / `CircuitDesk-Demo-2026!`) allow public visitors to explore the synthetic `Kinetix Audio` workspace. Set `DEMO_MODE=false` and configure distinct production cryptographic secrets (`AUTH_SECRET`, `ENCRYPTION_KEY`, `FILE_SIGNING_SECRET`, `WEBHOOK_SIGNING_SECRET`) before onboarding real commercial customer data.

## 5. Reporting a Vulnerability

Please open a GitHub Security Advisory on `devtechedge/circuitdesk` rather than filing a public issue with exploit details.
