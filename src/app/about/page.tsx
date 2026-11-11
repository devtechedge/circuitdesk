import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { SectionHeader, TechCode } from "@/components/ui/primitives";

export const metadata: Metadata = {
  title: "About CircuitDesk",
  description:
    "Product principles behind CircuitDesk: serialized truth, human claim adjudication, repairability, and honest multi-tenant operations.",
};

export default function AboutPage() {
  return (
    <>
      <SiteHeader />
      <main id="main-content" className="mx-auto max-w-4xl flex-1 px-4 py-12 sm:px-6 space-y-8">
        <SectionHeader
          eyebrow="About CircuitDesk"
          title="Post-sale operations built for physical products"
          description="CircuitDesk exists for electronics, audio, wearable, charging, and appliance brands whose warranties, service centres, and spare parts have outgrown shared spreadsheets and WhatsApp groups."
        />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {[
            {
              tag: "PRINCIPLE 01",
              title: "Serial Lineage Is the Join Key",
              body: "When every unit links SKU, factory batch, supplier, sales channel, registration, claim, repair bench, and RMA, quality teams spot bad lots in days rather than quarters.",
            },
            {
              tag: "PRINCIPLE 02",
              title: "Humans Decide Coverage, Never Black-Box AI",
              body: "Optional AI summarizes text and extracts receipt references with citations, but coverage approval, denial reasons, and recall campaigns always require an authenticated human decision.",
            },
            {
              tag: "PRINCIPLE 03",
              title: "India-First Realities, Global Standards",
              body: "Built around 6-digit PIN service zones, CBIC Circular 195/2023-GST accounting, E-Waste Rules 2022 manifests, and DPDP Act 2023 privacy rights, while supporting USD/Stripe and EU repair rules.",
            },
            {
              tag: "PRINCIPLE 04",
              title: "Radical Operational Honesty",
              body: "Demo environments, dev-sink notifications, and unconfigured payment credentials declare their exact runtime state instead of faking live charges or third-party syncs.",
            },
          ].map((p) => (
            <div key={p.tag} className="cd-surface rounded-lg p-5 space-y-2">
              <TechCode>{p.tag}</TechCode>
              <h2 className="m-0 text-base font-bold text-[var(--text-primary)]">{p.title}</h2>
              <p className="m-0 text-sm leading-relaxed text-[var(--text-secondary)]">{p.body}</p>
            </div>
          ))}
        </div>

        <div className="cd-elevated rounded-xl p-6 flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="m-0 text-base font-bold text-[var(--text-primary)]">
              Migrating from spreadsheets or a basic registration widget?
            </h2>
            <p className="m-0 text-sm text-[var(--text-secondary)]">
              Download our serial CSV template or request assisted migration mapping.
            </p>
          </div>
          <Link
            href="/contact"
            className="inline-flex h-10 items-center rounded-md bg-[var(--signal-orange)] px-4 text-xs font-semibold text-[var(--on-signal)] no-underline"
          >
            Request Migration Help
          </Link>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
