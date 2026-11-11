import type { Metadata } from "next";
import { requirePageSession } from "@/auth/page-auth";
import { ServiceCentreCreator } from "@/components/repair-bench";
import { DataTableWrap, SectionHeader, StatusBadge, TechCode } from "@/components/ui/primitives";
import { hasPermission } from "@/security/rbac";
import { listServiceNetworkAndInventory } from "@/services/inventory";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Service Network & PIN Routing",
};

export default async function ServiceNetworkPage() {
  const session = await requirePageSession("console:read");
  const network = await listServiceNetworkAndInventory(session);

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Hub & Authorised Partner Network"
        title="Service Centres & PIN-Zone Routing"
        description="Manage owned benches and Authorised Service Centres (with GSTINs for SAC 9987 reimbursement accounting)."
      />

      <ServiceCentreCreator canWrite={hasPermission(session.role, "inventory:write")} />

      <DataTableWrap label="Service centres network table">
        <table className="w-full min-w-[720px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] font-mono text-xs uppercase text-[var(--text-muted)]">
              <th className="p-3">Code &amp; Name</th>
              <th className="p-3">City / State</th>
              <th className="p-3">PIN Prefixes</th>
              <th className="p-3">Skills</th>
              <th className="p-3">GSTIN</th>
              <th className="p-3">Active Load</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)]">
            {network.centres.map((c) => (
              <tr key={c.id}>
                <td className="p-3 space-y-1">
                  <TechCode>{c.code}</TechCode>
                  <div className="font-medium text-[var(--text-primary)]">{c.name}</div>
                </td>
                <td className="p-3 text-xs text-[var(--text-secondary)]">
                  {c.city}, {c.state}
                </td>
                <td className="p-3 font-mono text-xs text-[var(--signal-orange)]">
                  {c.pinPrefixes.join(", ")}
                </td>
                <td className="p-3 font-mono text-[11px] text-[var(--text-muted)]">
                  {c.supportedCategories.join(", ")}
                </td>
                <td className="p-3 font-mono text-xs text-[var(--text-secondary)]">
                  {c.gstin ?? "Owned Internal"}
                </td>
                <td className="p-3">
                  <StatusBadge
                    tone={c.activeRepairsCount >= c.maxActiveRepairs ? "danger" : "ok"}
                  >
                    {c.activeRepairsCount} / {c.maxActiveRepairs}
                  </StatusBadge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </DataTableWrap>
    </div>
  );
}
