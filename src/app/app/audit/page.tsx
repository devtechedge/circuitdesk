import type { Metadata } from "next";
import { requirePageSession } from "@/auth/page-auth";
import { DataTableWrap, SectionHeader, TechCode } from "@/components/ui/primitives";
import { listTenantAuditLogs } from "@/services/audit";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Immutable Security & Operations Audit Log",
};

export default async function AuditLogPage() {
  const session = await requirePageSession("audit:read");
  const logs = await listTenantAuditLogs(session.tenantId, 150);

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Tamper-Evident Operational Trail"
        title="Security & Adjudication Audit Log"
        description="Every login, session revocation, CSV import, human claim decision, spare-part consumption, GST export, and DPDP erasure."
      />

      <DataTableWrap label="Workspace audit log table">
        <table className="w-full min-w-[720px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] font-mono text-xs uppercase text-[var(--text-muted)]">
              <th className="p-3">Timestamp (UTC)</th>
              <th className="p-3">Role</th>
              <th className="p-3">Action</th>
              <th className="p-3">Entity</th>
              <th className="p-3">Summary</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)]">
            {logs.map((log) => (
              <tr key={log.id}>
                <td className="p-3 font-mono text-xs text-[var(--text-muted)] whitespace-nowrap">
                  {log.createdAt.toISOString().slice(0, 19).replace("T", " ")}
                </td>
                <td className="p-3">
                  <TechCode>{log.actorRole}</TechCode>
                </td>
                <td className="p-3">
                  <TechCode>{log.action}</TechCode>
                </td>
                <td className="p-3 font-mono text-xs text-[var(--text-secondary)]">
                  {log.entityType}
                </td>
                <td className="p-3 text-xs text-[var(--text-primary)]">{log.summary}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </DataTableWrap>
    </div>
  );
}
