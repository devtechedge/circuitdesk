import type { Metadata } from "next";
import Link from "next/link";
import { requirePageSession } from "@/auth/page-auth";
import { DataTableWrap, SectionHeader, StatusBadge, TechCode } from "@/components/ui/primitives";
import { formatMoneyMinor } from "@/domain/money";
import { listTenantRepairs } from "@/services/repairs";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Repair Orders & Technician Bench",
};

export default async function RepairsListPage() {
  const session = await requirePageSession("console:read");
  const repairs = await listTenantRepairs(session);

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Bench Operations"
        title="Repair Orders & Technician Queue"
        description={
          session.role === "TECHNICIAN" && session.serviceCentreId
            ? "Showing repair orders assigned strictly to your service centre bench."
            : "All PIN-routed repair jobs across owned hubs and Authorised Service Centres."
        }
      />

      <DataTableWrap label="Repair orders table">
        <table className="w-full min-w-[760px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] font-mono text-xs uppercase text-[var(--text-muted)]">
              <th className="p-3">Job Number</th>
              <th className="p-3">Claim &amp; SKU</th>
              <th className="p-3">Service Bench</th>
              <th className="p-3">Stage &amp; QA</th>
              <th className="p-3">Parts + Labour</th>
              <th className="p-3">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)]">
            {repairs.map((row) => (
              <tr key={row.repair.id}>
                <td className="p-3">
                  <TechCode>{row.repair.jobNumber}</TechCode>
                </td>
                <td className="p-3">
                  <div className="font-medium text-[var(--text-primary)]">
                    {row.sku} &middot; {row.claimNumber}
                  </div>
                  <div className="font-mono text-xs text-[var(--text-muted)]">
                    {row.serialDisplay} ({row.faultCategory})
                  </div>
                </td>
                <td className="p-3 text-xs text-[var(--text-secondary)]">
                  <div className="font-semibold text-[var(--text-primary)]">{row.centreName}</div>
                  <div>
                    {row.centreCode} &middot; {row.centreCity}
                  </div>
                </td>
                <td className="p-3 space-y-1">
                  <StatusBadge tone={row.repair.stage === "DISPATCHED" ? "ok" : "warn"}>
                    {row.repair.stage}
                  </StatusBadge>
                  <div className="font-mono text-[10px] text-[var(--text-muted)]">
                    QA: {row.repair.qaPassed ? "PASSED" : "PENDING"}
                  </div>
                </td>
                <td className="p-3 font-mono text-xs">
                  {formatMoneyMinor(
                    row.repair.partsCostMinor + row.repair.labourCostMinor,
                    session.tenantCurrency
                  )}
                </td>
                <td className="p-3">
                  <Link
                    href={`/app/repairs/${row.repair.id}`}
                    className="inline-flex h-8 items-center rounded bg-[var(--signal-orange)] px-3 font-mono text-xs font-semibold text-[var(--on-signal)] no-underline"
                  >
                    Open Bench &rarr;
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </DataTableWrap>
    </div>
  );
}
