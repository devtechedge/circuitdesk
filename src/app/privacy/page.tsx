import type { Metadata } from "next";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { AlertBanner, SectionHeader } from "@/components/ui/primitives";

export const metadata: Metadata = {
  title: "Privacy Notice (Template Draft)",
  description: "DPDP Act 2023 and GDPR-aligned operational privacy notice draft for CircuitDesk.",
};

export default function PrivacyPage() {
  return (
    <>
      <SiteHeader />
      <main id="main-content" className="mx-auto max-w-4xl flex-1 px-4 py-12 sm:px-6 space-y-6 text-sm leading-relaxed text-[var(--text-secondary)]">
        <SectionHeader
          eyebrow="Legal Draft · Require Counsel Review"
          title="Privacy Notice"
          description="Operational draft aligned with India's Digital Personal Data Protection Act, 2023 (DPDP Act) and GDPR principles."
        />

        <AlertBanner tone="warn" title="Template Draft Notice">
          This document is a software operational draft for legal counsel review before live
          commercial contracting. It does not constitute legal advice.
        </AlertBanner>

        <section className="cd-surface rounded-lg p-6 space-y-4">
          <h2 className="m-0 text-base font-bold text-[var(--text-primary)]">
            1. Roles: Data Fiduciary and Data Processor
          </h2>
          <p className="m-0">
            For merchant operator accounts, CircuitDesk acts as Data Fiduciary / Controller for
            account credentials and billing metadata. For end-customer warranty registrations and
            claims submitted at /w/[brand], the subscribing hardware brand is the Data Fiduciary
            and CircuitDesk processes personal data strictly on the brand&apos;s documented
            instructions.
          </p>

          <h2 className="m-0 text-base font-bold text-[var(--text-primary)]">
            2. Categories of Data Processed
          </h2>
          <p className="m-0">
            Customer name, email, phone number, 6-digit PIN code, repair return shipping address,
            masked/full hardware serial number, purchase receipt attachments (encrypted at rest
            with AES-256-GCM), and hashed IP addresses for abuse prevention.
          </p>

          <h2 className="m-0 text-base font-bold text-[var(--text-primary)]">
            3. Consent, Retention, Export and Erasure
          </h2>
          <p className="m-0">
            Branded portal forms capture explicit itemized consent with a stated default retention
            period (1,095 days / 3 years to cover warranty terms and statutory GST audit windows,
            configurable per tenant). Brand Owners and Admins can export a Data Principal&apos;s
            JSON dossier or redact PII and revoke portal tokens from Settings &rarr; Privacy.
          </p>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
