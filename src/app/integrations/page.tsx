import type { Metadata } from "next";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { AlertBanner, SectionHeader, StatusBadge, TechCode } from "@/components/ui/primitives";

export const metadata: Metadata = {
  title: "Integrations & Official Connectors",
  description:
    "Shopify, WooCommerce, Amazon/Flipkart merchant CSV sync, Stripe, Razorpay, Meta WhatsApp Cloud API, and signed outbound webhooks.",
};

const CONNECTORS = [
  {
    name: "Shopify Orders & Fulfillments",
    status: "Custom App Webhook + CSV Active (App Store Listing Pending)",
    tone: "warn" as const,
    protocol: "X-Shopify-Hmac-Sha256 + Order CSV",
    detail:
      "Verifies base64 HMAC-SHA256 webhooks on orders/fulfilled with idempotency tracking on X-Shopify-Webhook-Id. Public Shopify App Store publication is pending partner review; custom store webhooks and CSV import run today.",
  },
  {
    name: "WooCommerce Storefronts",
    status: "Verified Webhook + Encrypted REST v3 Vault",
    tone: "ok" as const,
    protocol: "X-WC-Webhook-Signature (HMAC-SHA256)",
    detail:
      "Ingests signed WooCommerce order webhooks and stores merchant secrets encrypted at rest with AES-256-GCM.",
  },
  {
    name: "Amazon India & Flipkart Marketplaces",
    status: "Merchant CSV Import Only (Zero Scraping)",
    tone: "info" as const,
    protocol: "Validated Merchant Order / Serial CSV",
    detail:
      "CircuitDesk never scrapes marketplace seller portals. Brands upload official merchant order/serial CSV reports with dry-run validation, or verify marketplace customer invoices during registration.",
  },
  {
    name: "Stripe & Razorpay Billing",
    status: "Idempotent Webhooks + Non-Charging Demo Fallback",
    tone: "ok" as const,
    protocol: "Stripe-Signature (t,v1) & X-Razorpay-Signature",
    detail:
      "Global USD plans connect to Stripe Checkout; India INR plans connect to Razorpay Subscriptions. When keys are omitted, Billing clearly displays Non-Charging Demo Mode.",
  },
  {
    name: "Meta WhatsApp Business Cloud API",
    status: "Template Slot + Webhook Delivery Confirmation",
    tone: "info" as const,
    protocol: "Graph API v21.0 + Signed Status Receipt",
    detail:
      "Requires approved Meta Business utility templates. Messages log as DEV_SINK without credentials, SENT_UNCONFIRMED on dispatch, and DELIVERED_CONFIRMED only after Meta's delivery receipt arrives.",
  },
  {
    name: "REST API v1 & Signed Webhooks",
    status: "Scale & Enterprise Entitlement",
    tone: "ok" as const,
    protocol: "Bearer cd_live_* (SHA-256) + X-CircuitDesk-Signature",
    detail:
      "Tenant-scoped API keys stored strictly as SHA-256 hashes with revocable scopes for ERP, WMS, and accounting pipelines.",
  },
];

export default function IntegrationsPage() {
  return (
    <>
      <SiteHeader />
      <main id="main-content" className="mx-auto max-w-7xl flex-1 px-4 py-12 sm:px-6 space-y-8">
        <SectionHeader
          eyebrow="Official Interfaces Only"
          title="Honest commerce, billing, and messaging integrations"
          description="Every connector uses official signed webhooks, OAuth/API credentials encrypted with AES-256-GCM, or validated merchant CSV exports. Zero scraping, zero fabricated sync badges."
        />

        <AlertBanner tone="info" title="Credential Encryption Standard">
          All third-party connector secrets are encrypted server-side using AES-256-GCM
          (iv:tag:ciphertext) before touching PostgreSQL. API responses return only a SHA-256
          fingerprint and mask.
        </AlertBanner>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {CONNECTORS.map((item) => (
            <div key={item.name} className="cd-surface rounded-xl p-5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="m-0 text-base font-bold text-[var(--text-primary)]">{item.name}</h2>
                <StatusBadge tone={item.tone}>{item.status}</StatusBadge>
              </div>
              <TechCode>{item.protocol}</TechCode>
              <p className="m-0 text-sm leading-relaxed text-[var(--text-secondary)]">
                {item.detail}
              </p>
            </div>
          ))}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
