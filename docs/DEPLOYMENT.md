# Deployment Runbook (Vercel + Managed Neon PostgreSQL)

CircuitDesk runs on Next.js 16 App Router deployed to Vercel and backed by Managed PostgreSQL (Neon Lakebase Postgres via Vercel Marketplace integration).

## 1. Required Production Environment Variables

| Variable | Required in Production | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Pooled PostgreSQL connection string (`-pooler`) used by runtime serverless handlers |
| `DATABASE_URL_UNPOOLED` | Yes | Direct PostgreSQL connection string used by `pnpm db:migrate` |
| `APP_URL` | Yes | Public HTTPS production alias (used for canonical metadata, sitemap, and QR URLs) |
| `AUTH_SECRET` | Yes | >= 32 random chars signing IP hashes and session security |
| `ENCRYPTION_KEY` | Yes | 64 hex chars (32 bytes) for AES-256-GCM encryption of private evidence blobs and connector secrets |
| `FILE_SIGNING_SECRET` | Yes | >= 32 random chars signing expiring private evidence download URLs |
| `WEBHOOK_SIGNING_SECRET` | Yes | >= 32 random chars for signed webhooks |
| `DEMO_MODE` | Optional (`true` for public demo) | Enables synthetic `Kinetix Audio` demo sign-in and labels |

Optional live provider keys (`STRIPE_*`, `RAZORPAY_*`, `SHOPIFY_*`, `WOOCOMMERCE_*`, `RESEND_API_KEY`, `WHATSAPP_*`, `AI_API_KEY`) activate live integrations when present and fall back to honest, clearly badged Non-Charging Demo / Dev-Sink / Deterministic modes when unset.

## 2. Schema-First Deployment Order

Never embed database DDL migrations inside `next build` (`vercel-build`), so cold builds never contend on advisory locks:

1. Provision or link the Managed Neon Postgres database to the `circuitdesk` Vercel project.
2. Run `pnpm db:migrate` against `DATABASE_URL_UNPOOLED` (applies `drizzle/*.sql` + all 27 PostgreSQL Row-Level Security policies).
3. Seed the idempotent synthetic demo workspace when `DEMO_MODE=true`: `pnpm db:seed:demo`.
4. Push `main` to `devtechedge/circuitdesk` (git-linked Vercel auto-deploy) or deploy via `vercel deploy --prod`.
5. Set `APP_URL` to the confirmed public `READY` production alias, redeploy if updated, and run `pnpm smoke:live` against the live URL.

## 3. Health & Persistence Verification

- `GET /api/health` executes `SELECT 1` and returns `{ status: "ok", db: "postgres", demoMode, commitSha, providers }` without exposing database hostnames or credentials.
- Private evidence files store encrypted at rest inside PostgreSQL `private_blobs` (`AES-256-GCM`), persisting across Vercel serverless cold starts with zero reliance on ephemeral local disk.
