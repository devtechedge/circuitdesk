import Link from "next/link";
import { LifecyclePreview } from "@/components/lifecycle-preview";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { StatusBadge, TechCode } from "@/components/ui/primitives";

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main id="main-content" className="flex-1">
        {/* Hero */}
        <section className="cd-grid-bg border-b border-[var(--border-subtle)] py-14 sm:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="max-w-4xl space-y-5">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge tone="info">D2C Electronics &amp; Hardware Ops</StatusBadge>
                <StatusBadge tone="neutral">500 to 50,000 Units / Month</StatusBadge>
                <StatusBadge tone="ok">India-First &middot; Global-Ready</StatusBadge>
              </div>

              <h1 className="m-0 text-3xl font-extrabold tracking-tight text-[var(--text-primary)] sm:text-5xl leading-tight">
                Every product has an afterlife. Manage it beautifully.
              </h1>

              <p className="m-0 text-base sm:text-lg text-[var(--text-secondary)] max-w-3xl leading-relaxed">
                CircuitDesk unifies warranty registrations, serial and supplier batch registries,
                human claim adjudication, 6-digit PIN service-centre routing, spare parts, RMAs,
                and CBIC GST warranty exports in one multi-tenant operations console.
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Link
                  href="/demo"
                  className="inline-flex h-11 items-center rounded-md bg-[var(--signal-orange)] px-5 text-sm font-semibold text-[var(--on-signal)] hover:opacity-95 no-underline"
                >
                  Try Synthetic Sandbox
                </Link>
                <Link
                  href="/login"
                  className="inline-flex h-11 items-center rounded-md border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-5 text-sm font-semibold text-[var(--text-primary)] hover:border-[var(--signal-cobalt)] no-underline"
                >
                  Launch Demo Operator Console
                </Link>
                <Link
                  href="/w/kinetix/register"
                  className="inline-flex h-11 items-center rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 text-sm font-mono text-[var(--text-secondary)] hover:text-[var(--text-primary)] no-underline"
                >
                  /w/kinetix/register &rarr;
                </Link>
              </div>
            </div>

            <div className="mt-12">
              <LifecyclePreview />
            </div>
          </div>
        </section>

        {/* Why Hardware Brands Outgrow Spreadsheets & Apparel Return Apps */}
        <section className="border-b border-[var(--border-subtle)] py-14">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 space-y-8">
            <div className="max-w-3xl space-y-2">
              <p className="m-0 font-mono text-xs uppercase tracking-widest text-[var(--signal-orange)]">
                Verified Category Context (2026)
              </p>
              <h2 className="m-0 text-2xl sm:text-3xl font-bold text-[var(--text-primary)]">
                Why serialized electronics cannot run on apparel return widgets or inbox threads
              </h2>
              <p className="m-0 text-sm text-[var(--text-muted)]">
                Published external industry research below illustrates category pain points; these
                figures come from third-party merchant studies, not CircuitDesk customer data.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="cd-surface rounded-lg p-5 space-y-2">
                <div className="font-mono text-3xl font-bold text-[var(--signal-orange)]">
                  41% / 61%
                </div>
                <div className="text-sm font-semibold text-[var(--text-primary)]">
                  Refund &amp; policy abuse is the #1 reported merchant fraud vector
                </div>
                <p className="m-0 text-xs leading-relaxed text-[var(--text-secondary)]">
                  In the 2026 Global eCommerce Payments &amp; Fraud Report (MRC / Visa Acceptance
                  Solutions), 41% of surveyed merchants cite refund/policy abuse as their top
                  attack type and 61% report year-on-year increases. Serial validation and
                  duplicate-claim signals stop blind replacements.
                </p>
              </div>

              <div className="cd-surface rounded-lg p-5 space-y-2">
                <div className="font-mono text-3xl font-bold text-[var(--signal-cobalt)]">
                  73.6% / 49.2%
                </div>
                <div className="text-sm font-semibold text-[var(--text-primary)]">
                  Exchange portals solve apparel fit, not bench electronics faults
                </div>
                <p className="m-0 text-xs leading-relaxed text-[var(--text-secondary)]">
                  Loop Returns&apos; 2026 Retention Benchmarks dataset shows 73.6% of merchants
                  offer exchanges and 49.2% offer Shop Now. Hardware faults need DOA windows,
                  technician benches, spare-part stock ledgers, and supplier lot cost recovery.
                </p>
              </div>

              <div className="cd-surface rounded-lg p-5 space-y-2">
                <div className="font-mono text-3xl font-bold text-[var(--text-primary)]">
                  CBIC 195/2023
                </div>
                <div className="text-sm font-semibold text-[var(--text-primary)]">
                  Indian warranty replacements and ASC invoices require clean GST separation
                </div>
                <p className="m-0 text-xs leading-relaxed text-[var(--text-secondary)]">
                  CBIC Circulars 195/07/2023-GST and 216/10/2024-GST separate zero-GST OEM customer
                  warranty replacements (no ITC reversal) from taxable B2B Authorised Service
                  Centre repair invoices (SAC 9987). CircuitDesk exports both registers cleanly.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Hardware Verticals */}
        <section className="py-14">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 space-y-8">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="m-0 font-mono text-xs uppercase tracking-widest text-[var(--signal-orange)]">
                  Purpose-Built Verticals
                </p>
                <h2 className="m-0 mt-1 text-2xl font-bold text-[var(--text-primary)]">
                  Engineered for serialized consumer hardware
                </h2>
              </div>
              <Link
                href="/pricing"
                className="text-sm font-semibold text-[var(--signal-cobalt)] hover:underline"
              >
                Compare Starter ($49 / INR 3,999), Growth &amp; Scale plans &rarr;
              </Link>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  slug: "audio-wearables",
                  tag: "AUDIO & WEARABLES",
                  title: "TWS Earbuds, Headphones & Smartwatches",
                  detail:
                    "Track paired coin-cell degradation, pogo-pin corrosion, IMEI smartwatches, and 7-day DOA swaps across D2C and marketplaces.",
                },
                {
                  slug: "mobile-accessories",
                  tag: "POWER & ACCESSORIES",
                  title: "GaN Chargers, Power Banks & Docks",
                  detail:
                    "Manage 18-24 month replacement policies, BIS batch codes, counterfeit serial checks, and Return-to-Vendor supplier credits.",
                },
                {
                  slug: "smart-appliances",
                  tag: "APPLIANCES",
                  title: "Coffee Gear, Air Purifiers & Personal Care",
                  detail:
                    "Route bulky hardware by 6-digit PIN code to walk-in or hub service centres with multi-part QA checklists and E-Waste manifests.",
                },
                {
                  slug: "d2c-electronics",
                  tag: "OMNICHANNEL D2C",
                  title: "Multi-Channel Retail & Dealer Networks",
                  detail:
                    "Consolidate Shopify, WooCommerce, Amazon/Flipkart CSV orders, and offline retail GST invoice reviews into one ledger.",
                },
              ].map((v) => (
                <Link
                  key={v.slug}
                  href={`/solutions/${v.slug}`}
                  className="cd-surface rounded-lg p-5 flex flex-col justify-between gap-4 hover:border-[var(--border-strong)] transition-colors no-underline"
                >
                  <div className="space-y-2">
                    <TechCode>{v.tag}</TechCode>
                    <h3 className="m-0 text-base font-bold text-[var(--text-primary)]">
                      {v.title}
                    </h3>
                    <p className="m-0 text-xs leading-relaxed text-[var(--text-secondary)]">
                      {v.detail}
                    </p>
                  </div>
                  <span className="font-mono text-xs text-[var(--signal-orange)]">
                    View workflow &rarr;
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
