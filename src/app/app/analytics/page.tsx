import type { Metadata } from "next";
import Link from "next/link";
import { requirePageSession } from "@/auth/page-auth";
import {
  AlertBanner,
  DataTableWrap,
  MetricTile,
  SectionHeader,
  StatusBadge,
  TechCode,
} from "@/components/ui/primitives";
import { formatMoneyMinor } from "@/domain/money";
import { hasPermission } from "@/security/rbac";
import { type AnalyticsWindow, computeTenantAnalytics } from "@/services/analytics";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "SKU, Batch & Failure-Cost Analytics",
};

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ window?: string }>;
}) {
  const session = await requirePageSession("analytics:read");
  const query = await searchParams;
  const win: AnalyticsWindow =
    query.window === "30d" || query.window === "365d" || query.window === "all"
      ? query.window
      : "90d";

  const report = await computeTenantAnalytics(session, { window: win });
  const canExportGst = hasPermission(session.role, "exports:gst");

  return (
    <div data-testid="analytics-page" className="space-y-6">
      <SectionHeader
        eyebrow={`Range: ${report.meta.rangeLabel}`}
        title="SKU, Supplier Batch & Failure-Cost Analytics"
        description="Every figure specifies its exact unit, denominator, and date range. Live workspaces strictly exclude synthetic demo rows."
        actions={
          <div className="flex flex-wrap gap-1.5">
            {(["30d", "90d", "365d", "all"] as const).map((w) => (
              <Link
                key={w}
                href={`/app/analytics?window=${w}`}
                className={`rounded border px-2.5 py-1 font-mono text-xs no-underline ${
                  w === win
                    ? "border-[var(--signal-orange)] bg-[var(--bg-elevated)] text-[var(--text-primary)]"
                    : "border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)]"
                }`}
              >
                {w}
              </Link>
            ))}
          </div>
        }
      />

      <AlertBanner tone={report.meta.demoRowsExcluded ? "ok" : "warn"} title="Dataset Provenance">
        {report.meta.datasetBadge}
      </AlertBanner>

      {/* Headline Metrics with Explicit Units & Denominators */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricTile
          label="Claims per 1,000 Units"
          value={`${report.headline.claimsPer1000Units} ‰`}
          unitNote={`${report.headline.claimsCount} claims / ${report.headline.shippedUnitsDenominator} shipped or registered units`}
          badge={<StatusBadge tone="info">Rate / 1k</StatusBadge>}
        />
        <MetricTile
          label="DOA Share & Repeat Serials"
          value={`${report.headline.doaSharePct}%`}
          unitNote={`${report.headline.doaCount} DOA claim(s) · ${report.headline.repeatSerialsCount} repeat serial(s)`}
          badge={<StatusBadge tone="warn">Fault Mix</StatusBadge>}
        />
        <MetricTile
          label="SLA Compliance & Turnaround"
          value={`${report.headline.slaCompliancePct}%`}
          unitNote={`Avg 1st response: ${report.headline.avgFirstResponseHours ?? "-"}h · Avg resolution: ${report.headline.avgResolutionHours ?? "-"}h`}
          badge={<StatusBadge tone="ok">SLA Clock</StatusBadge>}
        />
        <MetricTile
          label="Net Warranty Cost"
          value={formatMoneyMinor(report.headline.netWarrantyCostMinor, report.meta.currency)}
          unitNote={`Gross ${formatMoneyMinor(
            report.headline.grossWarrantyCostMinor,
            report.meta.currency
          )} minus ${formatMoneyMinor(report.headline.supplierRecoveryMinor, report.meta.currency)} RTV recovery`}
          badge={<StatusBadge tone="neutral">Minor-Unit Ledger</StatusBadge>}
        />
      </div>

      {/* India GST Exports */}
      {canExportGst && (
        <section className="cd-elevated rounded-xl p-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h2 className="m-0 text-base font-bold text-[var(--text-primary)]">
              India GST Warranty Accounting Exports (CBIC Circulars 195/2023 &amp; 216/2024)
            </h2>
            <p className="m-0 text-xs text-[var(--text-secondary)]">
              Separate zero-GST OEM customer warranty replacements from taxable SAC 9987 Authorised Service Centre reimbursements.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 shrink-0">
            <a
              href="/api/app/exports/gst?type=oem_replacements"
              data-testid="gst-oem-export-link"
              className="inline-flex h-9 items-center rounded-md bg-[var(--signal-orange)] px-3.5 text-xs font-semibold text-[var(--on-signal)] no-underline"
            >
              Export OEM Replacement CSV
            </a>
            <a
              href="/api/app/exports/gst?type=asc_reimbursements"
              data-testid="gst-asc-export-link"
              className="inline-flex h-9 items-center rounded-md border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3.5 text-xs font-semibold text-[var(--text-primary)] no-underline"
            >
              Export ASC Reimbursement CSV
            </a>
          </div>
        </section>
      )}

      {/* Supplier Batch & Lot Failure Leaderboard */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="m-0 text-base font-bold text-[var(--text-primary)]">
            Factory Batch &amp; Supplier Failure Leaderboard
          </h2>
          <span className="font-mono text-xs text-[var(--text-muted)]">
            Expiring within 60 days: {report.headline.expiringSoon60dCount} active registration(s)
          </span>
        </div>

        <DataTableWrap label="Supplier batch failure analytics table">
          <table className="w-full min-w-[700px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] font-mono text-xs uppercase text-[var(--text-muted)]">
                <th className="p-3">Batch Code</th>
                <th className="p-3">Lot</th>
                <th className="p-3">Supplier</th>
                <th className="p-3">Batch Size</th>
                <th className="p-3">Claims</th>
                <th className="p-3">Claims / 1,000 Units</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {report.batchFailures.map((b) => (
                <tr key={b.batchId}>
                  <td className="p-3">
                    <TechCode>{b.batchCode}</TechCode>
                  </td>
                  <td className="p-3 font-mono text-xs text-[var(--text-secondary)]">
                    {b.lotNumber}
                  </td>
                  <td className="p-3 text-[var(--text-primary)]">{b.supplierName}</td>
                  <td className="p-3 font-mono text-xs">{b.batchUnits} units</td>
                  <td className="p-3 font-mono text-xs">{b.claimsCount}</td>
                  <td className="p-3">
                    <StatusBadge tone={b.claimsCount >= 2 ? "warn" : "ok"}>
                      {b.failureRatePer1000} / 1k
                    </StatusBadge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataTableWrap>
      </section>

      {/* SKU Failure Cost + Centre Load */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="space-y-3">
          <h2 className="m-0 text-base font-bold text-[var(--text-primary)]">
            SKU Failure &amp; Direct Cost Breakdown
          </h2>
          <DataTableWrap label="SKU failure cost table">
            <table className="w-full min-w-[460px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] font-mono text-xs uppercase text-[var(--text-muted)]">
                  <th className="p-3">SKU</th>
                  <th className="p-3">Claims / Units</th>
                  <th className="p-3">Rate / 1k</th>
                  <th className="p-3">Direct Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {report.skuFailures.map((s) => (
                  <tr key={s.productId}>
                    <td className="p-3">
                      <TechCode>{s.sku}</TechCode>
                    </td>
                    <td className="p-3 font-mono text-xs">
                      {s.claimsCount} / {s.shippedUnits}
                    </td>
                    <td className="p-3 font-mono text-xs">{s.claimsPer1000}</td>
                    <td className="p-3 font-mono text-xs">
                      {formatMoneyMinor(s.directCostMinor, report.meta.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DataTableWrap>
        </section>

        <section className="space-y-3">
          <h2 className="m-0 text-base font-bold text-[var(--text-primary)]">
            Service Centre Load &amp; Parts Burn
          </h2>
          <DataTableWrap label="Service centre utilization table">
            <table className="w-full min-w-[460px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] font-mono text-xs uppercase text-[var(--text-muted)]">
                  <th className="p-3">Bench</th>
                  <th className="p-3">City</th>
                  <th className="p-3">Active / Cap</th>
                  <th className="p-3">Utilization</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {report.centreLoad.map((c) => (
                  <tr key={c.id}>
                    <td className="p-3">
                      <TechCode>{c.code}</TechCode>
                    </td>
                    <td className="p-3 text-xs text-[var(--text-secondary)]">{c.city}</td>
                    <td className="p-3 font-mono text-xs">
                      {c.activeRepairs} / {c.maxCapacity}
                    </td>
                    <td className="p-3 font-mono text-xs">{c.utilizationPct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DataTableWrap>
        </section>
      </div>
    </div>
  );
}
