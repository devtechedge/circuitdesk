import type { Metadata } from "next";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { AlertBanner, SectionHeader } from "@/components/ui/primitives";

export const metadata: Metadata = {
  title: "Terms of Service (Template Draft)",
  description: "Operational SaaS Terms of Service draft for CircuitDesk.",
};

export default function TermsPage() {
  return (
    <>
      <SiteHeader />
      <main id="main-content" className="mx-auto max-w-4xl flex-1 px-4 py-12 sm:px-6 space-y-6 text-sm leading-relaxed text-[var(--text-secondary)]">
        <SectionHeader
          eyebrow="Legal Draft · Require Counsel Review"
          title="Terms of Service"
          description="Operational SaaS subscription and acceptable-use draft."
        />

        <AlertBanner tone="warn" title="Template Draft Notice">
          This document is a template draft provided for counsel review prior to commercial execution.
        </AlertBanner>

        <section className="cd-surface rounded-lg p-6 space-y-4">
          <h2 className="m-0 text-base font-bold text-[var(--text-primary)]">
            1. Service Scope &amp; Human Adjudication Responsibility
          </h2>
          <p className="m-0">
            CircuitDesk provides software workflows for warranty registration, claim intake,
            service-centre routing, spare-part tracking, and export generation. Subscribing brands
            remain solely responsible for their statutory consumer warranty obligations, coverage
            decisions, and tax filings.
          </p>

          <h2 className="m-0 text-base font-bold text-[var(--text-primary)]">
            2. Prohibited Conduct &amp; Marketplace Rules
          </h2>
          <p className="m-0">
            Tenants must only upload serials, order records, and customer contact details they are
            lawfully authorized to process. Scraping third-party marketplaces, sending unsolicited
            marketing on warranty channels, or storing unlawful content in evidence attachments is
            prohibited.
          </p>

          <h2 className="m-0 text-base font-bold text-[var(--text-primary)]">
            3. Plans, Quotas, Overages &amp; Taxes
          </h2>
          <p className="m-0">
            Recurring subscriptions bill monthly in INR (plus applicable 18% Indian GST) or USD.
            Demo workspaces operate in Non-Charging Demo Mode with zero financial obligation.
          </p>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
