import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { DataTableWrap, SectionHeader, StatusBadge, TechCode } from "@/components/ui/primitives";

export const metadata: Metadata = {
  title: "Features & Hardware Operations Capabilities",
  description:
    "Serial/IMEI/batch registries, QR packaging labels, policy rules, human claim triage, PIN-routed service benches, spare parts, RMAs, and India GST exports.",
};

const CAPABILITIES = [
  {
    code: "MOD-01",
    title: "Serial, IMEI, Lot & Supplier Batch Registry",
    detail:
      "Validate CSV imports with dry-run row previews, block spreadsheet formula injection, enforce unique serials per workspace, and print SVG QR label sheets.",
  },
  {
    code: "MOD-02",
    title: "Granular Policies by SKU, Region & Channel",
    detail:
      "Configure standard coverage months, DOA instant-replacement windows, EU Directive 2024/1799 repair extensions, and mandatory offline dealer receipt checks.",
  },
  {
    code: "MOD-03",
    title: "Zero-Account Branded Customer & Dealer Portal",
    detail:
      "Mobile-first /w/[brand]/register and /claim routes issue 256-bit SHA-256 hashed certificate and tracking tokens that operators can revoke at any time.",
  },
  {
    code: "MOD-04",
    title: "Human Claim Adjudication & Encrypted Evidence",
    detail:
      "7-category hardware fault taxonomy, duplicate/abuse signal flags, AES-256-GCM encrypted photos/invoices, and optional AI evidence extraction that never auto-denies.",
  },
  {
    code: "MOD-05",
    title: "6-Digit PIN Service Routing & Technician Bench",
    detail:
      "Match customer PIN codes, product category skills, and active repair load. Enforce 4-point QA checklists and atomic spare-part inventory decrements.",
  },
  {
    code: "MOD-06",
    title: "RMA Returns, Supplier Recovery & GST Registers",
    detail:
      "Track inbound defective hardware, Return-to-Vendor credits, E-Waste manifests, and CBIC Circular 195/07/2023-GST zero-GST replacement and ASC B2B exports.",
  },
];

export default function FeaturesPage() {
  return (
    <>
      <SiteHeader />
      <main id="main-content" className="mx-auto max-w-7xl flex-1 px-4 py-12 sm:px-6 space-y-10">
        <SectionHeader
          eyebrow="Platform Capabilities"
          title="Built for the physical realities of electronics after-sales"
          description="Every workflow connects serialized units from factory batch to customer registration, triage, bench repair, spare parts, and accounting closure."
          actions={
            <Link
              href="/demo"
              className="inline-flex h-10 items-center rounded-md bg-[var(--signal-orange)] px-4 text-xs font-semibold text-[var(--on-signal)] no-underline"
            >
              Test in Sandbox
            </Link>
          }
        />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {CAPABILITIES.map((cap) => (
            <div key={cap.code} className="cd-surface rounded-lg p-5 space-y-2.5">
              <div className="flex items-center justify-between">
                <TechCode>{cap.code}</TechCode>
                <StatusBadge tone="ok">Production Core</StatusBadge>
              </div>
              <h2 className="m-0 text-base font-bold text-[var(--text-primary)]">{cap.title}</h2>
              <p className="m-0 text-sm leading-relaxed text-[var(--text-secondary)]">
                {cap.detail}
              </p>
            </div>
          ))}
        </div>

        <section className="space-y-4">
          <h2 className="m-0 text-xl font-bold text-[var(--text-primary)]">
            Structured 7-Category Hardware Fault Taxonomy
          </h2>
          <DataTableWrap label="Hardware fault taxonomy matrix">
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] font-mono text-xs uppercase text-[var(--text-muted)]">
                  <th className="p-3">Code</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Standard Bench Check</th>
                  <th className="p-3">Typical Resolution</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {[
                  ["DOA", "Dead on Arrival", "Zero-power rail & sealed serial match", "DOA Replacement / RTV"],
                  ["BATTERY", "Battery & Runtime", "Discharge curve & cell impedance (mOhm)", "Matched cell swap"],
                  ["CHARGING", "Charging & Power", "USB-C PD probe & pogo-pin inspection", "Daughterboard / swap"],
                  ["CONNECTIVITY", "Wireless & Sync", "RF RSSI & pairing reset", "Reflash / module repair"],
                  ["PHYSICAL_DAMAGE", "Enclosure / Ingress", "Housing & liquid sticker inspection", "Out-of-warranty quote / decline"],
                  ["MISSING_PARTS", "Missing Accessory", "Pack-out weight verification", "Accessory dispatch"],
                  ["SOFTWARE_FIRMWARE", "Firmware / Bootloop", "DFU reflash & bootloader log", "Firmware restore"],
                ].map(([code, label, check, res]) => (
                  <tr key={code}>
                    <td className="p-3">
                      <TechCode>{code}</TechCode>
                    </td>
                    <td className="p-3 font-medium text-[var(--text-primary)]">{label}</td>
                    <td className="p-3 text-[var(--text-secondary)]">{check}</td>
                    <td className="p-3 text-[var(--text-secondary)]">{res}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DataTableWrap>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
