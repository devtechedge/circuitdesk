# CircuitDesk Architecture

## 1. System Overview

CircuitDesk is a multi-tenant SaaS control plane for electronics and hardware brands (500 to 50,000 units/month) connecting:

`Sale -> Registration -> Warranty Policy -> Claim Intake -> Human Triage -> Bench Repair / RMA Replacement / Refund -> Analytics & GST Closure`

### Core Architectural Layers

1. **Presentation & App Router (`src/app/`)**
   - Public marketing, vertical solutions, transparent INR/USD pricing, interactive synthetic sandbox, original technical guides, and DPDP/GDPR legal drafts.
   - Branded customer and dealer portal (`/w/[brand]/*`) operating with zero customer accounts via random 256-bit scoped, revocable SHA-256 hashed tokens.
   - Authenticated multi-tenant operator console (`/app/*`) with 14 domain workspaces and a mobile-ready technician bench view.
   - Versioned external REST API (`/api/v1/*`) gated by SHA-256 hashed API keys (`cd_live_...`) on Scale/Enterprise plans, plus HMAC-verified webhook endpoints (`/api/webhooks/*`).

2. **Security & Identity Boundary (`src/security/`, `src/auth/`)**
   - Server-only session validation (`scrypt` password hashing, HttpOnly `SameSite=Lax` cookies, `Secure` in production, explicit session revocation).
   - Strict tenant isolation: every tenant-owned query derives `tenantId` exclusively from the verified server session or verified brand/API token, never from client body/query inputs, reinforced by PostgreSQL Row-Level Security (`app.current_tenant_id`) inside tenant transactions.
   - Seven-role RBAC (`OWNER`, `ADMIN`, `OPERATIONS`, `SUPPORT`, `TECHNICIAN`, `ANALYST`, `READ_ONLY`) enforced before every read and mutation.
   - CSRF `Origin` check on all mutating cookie-authenticated endpoints, database-backed rate limiters, AES-256-GCM encryption for third-party credentials, and expiring HMAC-signed URLs for private claim evidence.

3. **Pure Domain Engines (`src/domain/`)**
   - `money.ts`: integer minor-unit arithmetic (`paise` / `cents`), formatting, and GST split helpers.
   - `policy-engine.ts`: coverage window calculation across SKU, region, channel, DOA days, and EU Directive 2024/1799 repair extensions.
   - `serial-csv.ts` & `qr-svg.ts`: dry-run CSV batch preview with row-level error diagnostics and deterministic SVG QR matrix generation without external network calls.
   - `claim-signals.ts` & `sla.ts`: 7-category fault taxonomy, duplicate/abuse risk signals for human review, and SLA deadline computation.
   - `pin-routing.ts`: 6-digit Indian PIN prefix + category skill + active bench load routing.
   - `plans.ts` & `gst-export.ts`: Starter/Growth/Scale/Enterprise entitlements, MRR calculation, and CBIC Circular 195/07/2023-GST CSV exporters.

4. **Application Services (`src/services/`)**
   - Transactional orchestration over Drizzle ORM: onboarding checklist, catalog/policies, serial batch registry, public registrations, human claim adjudication (never automated rejection), repair bench + spare part inventory decrement, RMA disposition, optional AI triage summarizer with deterministic fallback, billing/usage meters, connectors, notifications, DPDP privacy tools, and immutable audit logging.

5. **Data Persistence (`src/db/`)**
   - Primary production & CI backend: PostgreSQL 17 / Managed Neon Postgres via `drizzle-orm/node-postgres` (`pg.Pool` on pooled `DATABASE_URL`; migrations on direct `DATABASE_URL_UNPOOLED`).
   - Zero-setup local developer/test fallback: embedded `@electric-sql/pglite` applying the exact generated Drizzle SQL DDL when `DATABASE_URL` is unset.

---

## 2. Non-Negotiable Safety Invariants

- **Human Adjudication Only**: neither workflow automations nor the optional AI triage adapter can decline coverage or reject a customer claim. Only an authenticated human with `OWNER`, `ADMIN`, `OPERATIONS`, or `SUPPORT` permissions can record a claim decision, and declines require a structured reason code plus explanation.
- **Honest Provider States**: Stripe, Razorpay, Shopify OAuth, Meta WhatsApp, Resend/SMTP, and OpenAI-compatible AI adapters activate when server keys are configured and degrade to clearly badged non-charging/dev-sink/deterministic modes when keys are absent.
- **Recall Audience Gate**: batch failure alerts can draft an affected owner list, but outbound recall notices require explicit `OWNER` or `ADMIN` approval.
