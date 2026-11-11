import type { Metadata } from "next";
import Link from "next/link";
import { requirePageSession } from "@/auth/page-auth";
import { RegistrationReviewActions } from "@/components/registration-review";
import { DataTableWrap, SectionHeader, StatusBadge, TechCode } from "@/components/ui/primitives";
import { hasPermission } from "@/security/rbac";
import { listTenantRegistrations } from "@/services/registrations";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Warranty Registrations & Offline Queue",
};

export default async function RegistrationsConsolePage() {
  const session = await requirePageSession("console:read");
  const registrations = await listTenantRegistrations(session);
  const canReview = hasPermission(session.role, "registrations:review");

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Ownership & Certificates"
        title="Warranty Registrations & Offline Receipt Queue"
        description="Verify offline retail and dealer GST invoices before activating coverage, or revoke compromised certificate tokens."
      />

      <DataTableWrap label="Warranty registrations table">
        <table className="w-full min-w-[760px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] font-mono text-xs uppercase text-[var(--text-muted)]">
              <th className="p-3">Registration</th>
              <th className="p-3">SKU &amp; Serial</th>
              <th className="p-3">Owner &amp; PIN</th>
              <th className="p-3">Channel / Dealer</th>
              <th className="p-3">Coverage Ends</th>
              <th className="p-3">Status</th>
              <th className="p-3">Operator Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)]">
            {registrations.map((reg) => (
              <tr key={reg.id}>
                <td className="p-3 space-y-1">
                  <TechCode>{reg.registrationNumber}</TechCode>
                  {reg.demoPublicToken && !reg.tokenRevokedAt && (
                    <div>
                      <Link
                        href={`/w/${reg.brandSlug}/certificate/${reg.demoPublicToken}`}
                        className="font-mono text-[11px] text-[var(--signal-cobalt)] hover:underline"
                      >
                        Certificate &rarr;
                      </Link>
                    </div>
                  )}
                </td>
                <td className="p-3">
                  <div className="font-medium text-[var(--text-primary)]">{reg.sku}</div>
                  <div className="font-mono text-xs text-[var(--text-muted)]">
                    {reg.serialDisplay}
                  </div>
                </td>
                <td className="p-3">
                  <div className="text-[var(--text-primary)]">{reg.customerName}</div>
                  <div className="font-mono text-xs text-[var(--text-muted)]">
                    {reg.customerCity} &middot; {reg.customerPinCode}
                  </div>
                </td>
                <td className="p-3 text-xs text-[var(--text-secondary)]">
                  <div>{reg.salesChannel}</div>
                  {reg.dealerName && <div className="text-[var(--text-muted)]">{reg.dealerName}</div>}
                </td>
                <td className="p-3 font-mono text-xs">
                  {reg.coverageEndDate.toISOString().slice(0, 10)}
                </td>
                <td className="p-3">
                  <StatusBadge
                    tone={
                      reg.status === "ACTIVE"
                        ? "ok"
                        : reg.status === "PENDING_REVIEW"
                          ? "warn"
                          : "danger"
                    }
                  >
                    {reg.status}
                  </StatusBadge>
                </td>
                <td className="p-3">
                  <RegistrationReviewActions
                    registrationId={reg.id}
                    status={reg.status}
                    canReview={canReview}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </DataTableWrap>
    </div>
  );
}
