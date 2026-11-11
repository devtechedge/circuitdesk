import type { Metadata } from "next";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { AlertBanner, SectionHeader } from "@/components/ui/primitives";

export const metadata: Metadata = {
  title: "Data Processing Addendum (Template Draft)",
  description: "DPDP Act 2023 and GDPR Article 28 Data Processing Addendum template draft.",
};

export default function DpaPage() {
  return (
    <>
      <SiteHeader />
      <main id="main-content" className="mx-auto max-w-4xl flex-1 px-4 py-12 sm:px-6 space-y-6 text-sm leading-relaxed text-[var(--text-secondary)]">
        <SectionHeader
          eyebrow="Legal Draft · Require Counsel Review"
          title="Data Processing Addendum (DPA)"
          description="Template addendum governing personal data processed on behalf of subscribing hardware brands."
        />

        <AlertBanner tone="warn" title="Template Draft Notice">
          Review and customize sub-processor annexes and governing jurisdiction with legal counsel
          before countersigning with Enterprise or commercial customers.
        </AlertBanner>

        <section className="cd-surface rounded-lg p-6 space-y-4">
          <h2 className="m-0 text-base font-bold text-[var(--text-primary)]">
            1. Subject Matter &amp; Processing Instructions
          </h2>
          <p className="m-0">
            Processor (CircuitDesk) processes end-customer registration, warranty claim, and repair
            logistics personal data solely to deliver the contracted after-sales operations
            platform for the Data Fiduciary / Controller (Brand).
          </p>

          <h2 className="m-0 text-base font-bold text-[var(--text-primary)]">
            2. Technical &amp; Organizational Security Measures (TOMs)
          </h2>
          <ul className="m-0 list-disc pl-5 space-y-1.5">
            <li>Tenant isolation enforced in application services and PostgreSQL Row-Level Security.</li>
            <li>AES-256-GCM encryption at rest for private claim attachments and connector secrets.</li>
            <li>Scrypt password hashing, HttpOnly SameSite cookies, and 7-role RBAC.</li>
            <li>Role-based serial/IMEI masking and expiring HMAC-signed download URLs.</li>
            <li>Immutable tenant audit log of administrative and privacy actions.</li>
          </ul>

          <h2 className="m-0 text-base font-bold text-[var(--text-primary)]">
            3. Data Principal Assistance &amp; Deletion on Termination
          </h2>
          <p className="m-0">
            Built-in JSON export and PII erasure tools enable Controllers to fulfill access,
            correction, and erasure requests under the DPDP Act, 2023 and GDPR. Upon contract
            termination, tenant rows cascade-delete upon verified Owner instruction.
          </p>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
