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
import { listTenantAuditLogs } from "@/services/audit";
import { listTenantClaims } from "@/services/claims";
import { listServiceNetworkAndInventory } from "@/services/inventory";
import { getOnboardingStatus } from "@/services/onboarding";
import { listTenantRegistrations } from "@/services/registrations";
import { listTenantRepairs } from "@/services/repairs";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Operations Command Deck",
};

export default async function ConsoleOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ denied?: string }>;
}) {
  const session = await requirePageSession("console:read");
  const query = await searchParams;

  const [onboarding, registrations, claims, repairs, inventory, audits] = await Promise.all([
    getOnboardingStatus(session),
    listTenantRegistrations(session),
    listTenantClaims(session),
    listTenantRepairs(session),
    listServiceNetworkAndInventory(session),
    listTenantAuditLogs(session.tenantId, 8),
  ]);

  const pendingRegs = registrations.filter((r) => r.status === "PENDING_REVIEW").length;
  const triageClaims = claims.filter(
    (c) => c.status === "SUBMITTED" || c.status === "IN_TRIAGE" || c.status === "NEEDS_INFO"
  ).length;
  const activeRepairs = repairs.filter(
    (r) => r.repair.stage !== "DISPATCHED" && r.repair.stage !== "UNREPAIRABLE"
  ).length;

  return (
    <div data-testid="console-overview" className="space-y-6">
      {query.denied === "1" && (
        <AlertBanner tone="warn" title="Role Permission Restricted">
          Your current role ({session.role}) does not include permission for that workspace action.
        </AlertBanner>
      )}

      <SectionHeader
        eyebrow="Operations Command Deck"
        title="Warranty, Claims & Repair Queue"
        description="Real-time view of pending offline registrations, human claim triage, bench jobs, and low-stock spare parts."
        actions={
          onboarding.primaryBrandSlug ? (
            <Link
              href={`/w/${onboarding.primaryBrandSlug}/register`}
              className="inline-flex h-9 items-center rounded-md border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-3 font-mono text-xs text-[var(--text-primary)] no-underline"
            >
              Open /w/{onboarding.primaryBrandSlug} &rarr;
            </Link>
          ) : null
        }
      />

      {/* Metric Tiles */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricTile
          label="Claims Awaiting Triage"
          value={String(triageClaims)}
          unitNote={`Out of ${claims.length} total claims in workspace`}
          badge={<StatusBadge tone={triageClaims > 0 ? "warn" : "ok"}>Human Gate</StatusBadge>}
        />
        <MetricTile
          label="Offline Receipt Queue"
          value={String(pendingRegs)}
          unitNote={`${registrations.length} total warranty registrations`}
          badge={<StatusBadge tone={pendingRegs > 0 ? "info" : "ok"}>Dealer / Retail</StatusBadge>}
        />
        <MetricTile
          label="Active Bench Repairs"
          value={String(activeRepairs)}
          unitNote={`Across ${inventory.centres.length} configured service centre(s)`}
          badge={<StatusBadge tone="info">PIN Routed</StatusBadge>}
        />
        <MetricTile
          label="Low-Stock Spare Parts"
          value={String(inventory.lowStockParts.length)}
          unitNote="Parts at or below reorder threshold"
          badge={
            <StatusBadge tone={inventory.lowStockParts.length > 0 ? "danger" : "ok"}>
              Inventory
            </StatusBadge>
          }
        />
      </div>

      {/* Activation Progress Bar */}
      <section className="cd-surface rounded-xl p-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs uppercase text-[var(--signal-orange)]">
              Workspace Activation
            </span>
            <TechCode>
              {onboarding.completedCount}/{onboarding.totalCount} Complete
            </TechCode>
          </div>
          <p className="m-0 text-xs text-[var(--text-secondary)]">
            Brand &rarr; SKU &amp; Policy &rarr; Serials CSV &amp; QR &rarr; Portal &rarr; Teammate &rarr; Test Claim
          </p>
        </div>
        <Link
          href="/app/onboarding"
          className="inline-flex h-9 items-center rounded-md bg-[var(--signal-orange)] px-3.5 text-xs font-semibold text-[var(--on-signal)] shrink-0 no-underline"
        >
          Open Activation Checklist
        </Link>
      </section>

      {/* Open Claims Triage Table */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="m-0 text-base font-bold text-[var(--text-primary)]">
            Recent Warranty Claims
          </h2>
          <Link href="/app/claims" className="text-xs font-semibold text-[var(--signal-cobalt)] hover:underline">
            View all claims &rarr;
          </Link>
        </div>

        <DataTableWrap label="Recent warranty claims overview">
          <table className="w-full min-w-[680px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] font-mono text-xs uppercase text-[var(--text-muted)]">
                <th className="p-3">Claim</th>
                <th className="p-3">SKU &amp; Serial</th>
                <th className="p-3">Fault</th>
                <th className="p-3">Status</th>
                <th className="p-3">Signals</th>
                <th className="p-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {claims.slice(0, 6).map((c) => (
                <tr key={c.id}>
                  <td className="p-3">
                    <TechCode>{c.claimNumber}</TechCode>
                  </td>
                  <td className="p-3">
                    <div className="font-medium text-[var(--text-primary)]">{c.sku}</div>
                    <div className="font-mono text-xs text-[var(--text-muted)]">
                      {c.serialDisplay}
                    </div>
                  </td>
                  <td className="p-3">
                    <TechCode>{c.faultCategory}</TechCode>
                  </td>
                  <td className="p-3">
                    <StatusBadge tone={c.status === "RESOLVED" ? "ok" : "info"}>
                      {c.status}
                    </StatusBadge>
                  </td>
                  <td className="p-3 font-mono text-xs text-[var(--text-muted)]">
                    {c.duplicateSignals.length > 0
                      ? `${c.duplicateSignals.length} flag(s)`
                      : "Clean"}
                  </td>
                  <td className="p-3">
                    <Link
                      href={`/app/claims/${c.id}`}
                      className="font-mono text-xs text-[var(--signal-orange)] hover:underline"
                    >
                      Inspect &rarr;
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataTableWrap>
      </section>

      {/* Recent Audit Activity */}
      <section className="cd-surface rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="m-0 text-base font-bold text-[var(--text-primary)]">
            Recent Security &amp; Operations Audit Trail
          </h2>
          <Link href="/app/audit" className="text-xs font-semibold text-[var(--signal-cobalt)] hover:underline">
            Full audit log &rarr;
          </Link>
        </div>

        <ul className="m-0 list-none space-y-2 p-0 text-xs">
          {audits.map((a) => (
            <li
              key={a.id}
              className="cd-elevated rounded-md p-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex flex-wrap items-center gap-2">
                <TechCode>{a.action}</TechCode>
                <span className="text-[var(--text-primary)]">{a.summary}</span>
              </div>
              <span className="font-mono text-[var(--text-muted)] shrink-0">
                {a.actorRole} &middot; {a.createdAt.toISOString().slice(0, 16).replace("T", " ")} UTC
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
