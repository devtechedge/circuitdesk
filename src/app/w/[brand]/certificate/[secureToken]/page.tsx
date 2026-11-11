import type { Metadata } from "next";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { PrintButton } from "@/components/print-button";
import { StatusBadge, TechCode } from "@/components/ui/primitives";
import { getEnv } from "@/env";
import { getCertificateBySecureToken } from "@/services/registrations";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Digital Warranty Certificate",
};

export default async function WarrantyCertificatePage({
  params,
}: {
  params: Promise<{ brand: string; secureToken: string }>;
}) {
  const { brand, secureToken } = await params;
  const data = await getCertificateBySecureToken({ brandSlug: brand, rawToken: secureToken });
  if (!data) {
    notFound();
  }

  const { certificate } = data;
  const verifyUrl = `${getEnv().APP_URL.replace(/\/$/, "")}/w/${encodeURIComponent(
    data.brand.slug
  )}/certificate/${encodeURIComponent(secureToken)}`;

  const qrSvg = await QRCode.toString(verifyUrl, {
    type: "svg",
    margin: 1,
    width: 112,
    color: { dark: "#0f172a", light: "#ffffff" },
  });

  return (
    <div data-testid="warranty-certificate-view" className="space-y-4">
      <div className="flex items-center justify-between gap-2 no-print">
        <span className="font-mono text-xs uppercase text-[var(--text-muted)]">
          Scoped Revocable Warranty Certificate
        </span>
        <PrintButton />
      </div>

      <article className="print-card cd-surface rounded-xl p-6 sm:p-8 space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between border-b border-[var(--border-subtle)] pb-5">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <TechCode>{certificate.registrationNumber}</TechCode>
              <StatusBadge tone={certificate.status === "ACTIVE" ? "ok" : "warn"}>
                {certificate.status}
              </StatusBadge>
              {certificate.isDemo && <StatusBadge tone="neutral">Synthetic Demo</StatusBadge>}
            </div>
            <h1 className="m-0 text-2xl font-extrabold text-[var(--text-primary)]">
              {data.brand.name} Warranty Certificate
            </h1>
            <p className="m-0 text-sm text-[var(--text-secondary)]">{certificate.policyName}</p>
          </div>

          <div
            aria-label="Verification QR code"
            className="rounded-lg border border-[var(--border-subtle)] bg-white p-2 self-start shrink-0"
            dangerouslySetInnerHTML={{ __html: qrSvg }}
          />
        </div>

        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3 text-sm m-0">
          <div className="cd-elevated rounded-lg p-3.5">
            <dt className="font-mono text-xs uppercase text-[var(--text-muted)]">Product &amp; SKU</dt>
            <dd className="m-0 mt-1 font-semibold text-[var(--text-primary)]">
              {certificate.productName} ({certificate.productSku})
            </dd>
          </div>

          <div className="cd-elevated rounded-lg p-3.5">
            <dt className="font-mono text-xs uppercase text-[var(--text-muted)]">Masked Serial</dt>
            <dd className="m-0 mt-1 font-mono font-semibold text-[var(--text-primary)]">
              {certificate.serialMasked}
            </dd>
          </div>

          <div className="cd-elevated rounded-lg p-3.5">
            <dt className="font-mono text-xs uppercase text-[var(--text-muted)]">Registered Owner</dt>
            <dd className="m-0 mt-1 font-semibold text-[var(--text-primary)]">
              {certificate.customerName} ({certificate.customerCity})
            </dd>
          </div>

          <div className="cd-elevated rounded-lg p-3.5">
            <dt className="font-mono text-xs uppercase text-[var(--text-muted)]">Purchase Date</dt>
            <dd className="m-0 mt-1 font-mono text-[var(--text-primary)]">
              {certificate.purchaseDate.toISOString().slice(0, 10)}
            </dd>
          </div>

          <div className="cd-elevated rounded-lg p-3.5">
            <dt className="font-mono text-xs uppercase text-[var(--text-muted)]">Coverage Window</dt>
            <dd className="m-0 mt-1 font-mono text-[var(--text-primary)]">
              {certificate.coverageStartDate.toISOString().slice(0, 10)} &rarr;{" "}
              {certificate.coverageEndDate.toISOString().slice(0, 10)}
            </dd>
          </div>

          <div className="cd-elevated rounded-lg p-3.5">
            <dt className="font-mono text-xs uppercase text-[var(--text-muted)]">Sales Channel</dt>
            <dd className="m-0 mt-1 font-mono text-[var(--text-primary)]">
              {certificate.salesChannel}
            </dd>
          </div>
        </dl>

        <div className="space-y-2 border-t border-[var(--border-subtle)] pt-4 text-xs text-[var(--text-secondary)]">
          <div>
            <strong className="text-[var(--text-primary)]">Covered Faults:</strong>{" "}
            {certificate.coveredFaults.join(", ")}
          </div>
          <div>
            <strong className="text-[var(--text-primary)]">Exclusions:</strong>{" "}
            {certificate.exclusionsNote}
          </div>
          {certificate.reviewNotes && (
            <div>
              <strong className="text-[var(--text-primary)]">Verification Note:</strong>{" "}
              {certificate.reviewNotes}
            </div>
          )}
        </div>
      </article>
    </div>
  );
}
