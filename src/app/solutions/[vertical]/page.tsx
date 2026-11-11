import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { SectionHeader, StatusBadge, TechCode } from "@/components/ui/primitives";

const VERTICALS = {
  "audio-wearables": {
    eyebrow: "ICP Vertical · Audio & Wearables",
    title: "Warranty & bench operations for TWS earbuds, headphones, and smartwatches",
    summary:
      "High-velocity D2C audio and wearable brands face battery cell drift, charging contact oxidation, IMEI watch tracking, and repeat serial abuse across online and marketplace channels.",
    typicalVolume: "1,000 to 35,000 units/month",
    keyWorkflows: [
      "QR insert inside the charging case box pre-fills SKU and serial at /w/[brand]/register.",
      "Separate 7-day DOA replacement rules from 12-month bench coin-cell and crown repairs.",
      "Track failures per 1,000 units across factory cell lots to isolate high-impedance batches early.",
      "Optional IMEI validation (15 digits) on cellular smartwatches.",
    ],
  },
  "mobile-accessories": {
    eyebrow: "ICP Vertical · GaN Power & Accessories",
    title: "Counterfeit-resistant serial registries and RTV recovery for charging brands",
    summary:
      "GaN chargers, power banks, hubs, and cables carry 18-to-24 month warranties where unverified email claims quickly erode unit margin.",
    typicalVolume: "2,000 to 50,000 units/month",
    keyWorkflows: [
      "Enforce official serial registry lookup so grey-market or counterfeit units cannot claim replacements.",
      "Allocate replacement serials automatically on approved DOA swaps while tagging defective units for Return-to-Vendor recovery.",
      "Export CBIC Circular 195/07/2023-GST zero-GST warranty replacement registers by HSN 8504.",
      "Log E-Waste recycler manifest IDs when lithium power-bank packs are scrapped.",
    ],
  },
  "smart-appliances": {
    eyebrow: "ICP Vertical · Smart Home & Small Appliances",
    title: "6-digit PIN service-centre routing and spare-part stock control for appliances",
    summary:
      "Precision kettles, air purifiers, robot vacuums, and grooming appliances are too heavy for blind two-way courier swaps and depend on regional Authorised Service Centres.",
    typicalVolume: "500 to 15,000 units/month",
    keyWorkflows: [
      "Route repair jobs automatically by 6-digit Indian PIN prefix, category skill, and active bench capacity.",
      "Give partner technicians a mobile-ready bench screen scoped strictly to their assigned service centre.",
      "Decrement heating elements, motors, and PCBs atomically with low-stock reorder thresholds.",
      "Generate SAC 9987 18% CGST/SGST vs IGST B2B reimbursement CSVs for Authorised Service Centres.",
    ],
  },
  "d2c-electronics": {
    eyebrow: "ICP Vertical · Omnichannel Hardware Brands",
    title: "Unify D2C web, marketplace CSVs, and offline retail dealer warranties",
    summary:
      "Most Indian and global electronics brands sell simultaneously on Shopify/WooCommerce, Amazon/Flipkart, and regional retail dealers, splitting warranty data across three silos.",
    typicalVolume: "1,500 to 50,000 units/month",
    keyWorkflows: [
      "Ingest D2C orders via signed Shopify/WooCommerce webhooks and marketplace orders via merchant CSV exports (never scraping).",
      "Queue offline retail and dealer registrations into PENDING_REVIEW so operators inspect GST invoices before activating coverage.",
      "Empower dealers to submit stockist claims through the same branded portal with clear audit trails.",
      "Role-scoped access for Owners, Ops, Support, Technicians, Analysts, and Read-Only auditors.",
    ],
  },
} as const;

type VerticalSlug = keyof typeof VERTICALS;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ vertical: string }>;
}): Promise<Metadata> {
  const { vertical } = await params;
  const item = VERTICALS[vertical as VerticalSlug];
  if (!item) return { title: "Vertical Solution" };
  return {
    title: item.title,
    description: item.summary,
  };
}

export default async function VerticalSolutionPage({
  params,
}: {
  params: Promise<{ vertical: string }>;
}) {
  const { vertical } = await params;
  const item = VERTICALS[vertical as VerticalSlug];
  if (!item) notFound();

  return (
    <>
      <SiteHeader />
      <main id="main-content" className="mx-auto max-w-7xl flex-1 px-4 py-12 sm:px-6 space-y-10">
        <div className="flex flex-wrap gap-2">
          {(Object.keys(VERTICALS) as VerticalSlug[]).map((slug) => (
            <Link
              key={slug}
              href={`/solutions/${slug}`}
              className={`rounded-md border px-3 py-1.5 font-mono text-xs no-underline ${
                slug === vertical
                  ? "border-[var(--signal-orange)] bg-[var(--bg-elevated)] text-[var(--text-primary)]"
                  : "border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)]"
              }`}
            >
              {slug}
            </Link>
          ))}
        </div>

        <SectionHeader
          eyebrow={item.eyebrow}
          title={item.title}
          description={item.summary}
          actions={<StatusBadge tone="info">{item.typicalVolume}</StatusBadge>}
        />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {item.keyWorkflows.map((wf, index) => (
            <div key={wf} className="cd-surface rounded-lg p-5 space-y-2">
              <TechCode>WORKFLOW 0{index + 1}</TechCode>
              <p className="m-0 text-sm leading-relaxed text-[var(--text-primary)]">{wf}</p>
            </div>
          ))}
        </div>

        <div className="cd-elevated rounded-xl p-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h2 className="m-0 text-lg font-bold text-[var(--text-primary)]">
              Walk through this vertical in the live synthetic workspace
            </h2>
            <p className="m-0 text-sm text-[var(--text-secondary)]">
              Explore seeded earbuds, smartwatches, GaN chargers, and precision kettles in Kinetix Audio.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 shrink-0">
            <Link
              href="/demo"
              className="inline-flex h-10 items-center rounded-md bg-[var(--signal-orange)] px-4 text-xs font-semibold text-[var(--on-signal)] no-underline"
            >
              Open Sandbox
            </Link>
            <Link
              href="/pricing"
              className="inline-flex h-10 items-center rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 text-xs font-semibold text-[var(--text-primary)] no-underline"
            >
              View Plans
            </Link>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
