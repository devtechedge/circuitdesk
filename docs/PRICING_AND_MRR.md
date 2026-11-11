# Pricing, Entitlements and $2,000 MRR Unit Economics

## 1. Published Plans (Editable in `src/domain/plans.ts`)

| Plan | USD / Month | INR / Month (excl. 18% GST) | Included Limits | Key Entitlements |
| --- | --- | --- | --- | --- |
| Starter | $49 | INR 3,999 | 1 brand, 3 seats, 500 registrations, 50 claims | Branded portal, QR labels, CSV import, private evidence, email |
| Growth | $129 | INR 9,999 | 3 brands, 10 seats, 2,500 registrations, 300 claims | Repairs, PIN routing, automations, WhatsApp slot, analytics, Shopify/WooCommerce |
| Scale | $299 | INR 24,999 | 10 brands, 25 seats, 10,000 registrations, 1,500 claims | Hashed REST API, signed webhooks, multi-location parts, custom branding, batch analytics |
| Enterprise | Custom | Custom | Custom volume | Dedicated SLA, custom retention, countersigned DPA |

### Overages (Transparent, Per Extra Action)

- **Starter**: $0.08 (INR 6.00) per extra registration; $0.60 (INR 45.00) per extra claim.
- **Growth**: $0.06 (INR 4.50) per extra registration; $0.45 (INR 35.00) per extra claim.
- **Scale**: $0.04 (INR 3.00) per extra registration; $0.30 (INR 22.00) per extra claim.

---

## 2. Strict MRR Accounting Definition

CircuitDesk's `computePaidRecurringMrrMinor` function counts **only** subscriptions where:

1. `status === "ACTIVE"`
2. `isNonChargingDemo === false`
3. `provider` is `"STRIPE"` or `"RAZORPAY"` (never `"DEMO"`)
4. Base recurring monthly subscription amount only (excluding free trials, one-off onboarding fees, taxes/GST, and variable overages).

Current live paid subscribers and live MRR at repository publication: **0 paid subscribers / $0 MRR**.

---

## 3. Target Path to $2,000 MRR (Unit Economics Math, Not a Forecast)

- **Scenario A (Growth-led)**: `16` paid Growth brands x `$129/mo` = **$2,064 MRR**
- **Scenario B (Scale-led)**: `7` paid Scale brands x `$299/mo` = **$2,093 MRR**
- **Scenario C (Blended)**: `4` Starter (`$196`) + `10` Growth (`$1,290`) + `2` Scale (`$598`) = **$2,084 MRR** across `16` paying brands.

### Payment Rails & Honest Provider State

- **Global**: Stripe Checkout & Customer Portal (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`), verified via `Stripe-Signature` (`t=...,v1=...`) and deduplicated in `webhook_events`.
- **India**: Razorpay Subscriptions (`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`), verified via `X-Razorpay-Signature` HMAC-SHA256 and deduplicated in `webhook_events`.
- **When Credentials Are Absent**: the Billing workspace displays an explicit **Non-Charging Demo Billing Mode** banner. Plan switches in demo mode set `isNonChargingDemo: true` and `provider: "DEMO"` so demo exploration never masquerades as paid revenue.
