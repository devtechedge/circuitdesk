import type { Metadata } from "next";
import { requirePageSession } from "@/auth/page-auth";
import { ConnectorSecretVaultForm } from "@/components/ops-panels";
import { DataTableWrap, SectionHeader, StatusBadge, TechCode } from "@/components/ui/primitives";
import { hasPermission } from "@/security/rbac";
import { listTenantIntegrations } from "@/services/integrations";
import { listNotificationLogs } from "@/services/notifications";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Integrations, Webhooks & Messaging",
};

export default async function ConsoleIntegrationsPage() {
  const session = await requirePageSession("console:read");
  const [data, notifications] = await Promise.all([
    listTenantIntegrations(session),
    listNotificationLogs(session),
  ]);

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow={`Webhook Endpoint: /api/webhooks/shopify?tenant=${session.tenantSlug}`}
        title="Commerce, Messaging & Webhook Connectors"
        description="All secrets encrypt server-side with AES-256-GCM. Unconfigured messaging channels log honestly to the audited Dev Sink."
      />

      <ConnectorSecretVaultForm canWrite={hasPermission(session.role, "integrations:write")} />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {data.connections.map((conn) => (
          <div key={conn.id} className="cd-surface rounded-xl p-5 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <TechCode>{conn.provider}</TechCode>
              <StatusBadge
                tone={
                  conn.status === "CONNECTED"
                    ? "ok"
                    : conn.status === "PENDING_APP_REVIEW"
                      ? "warn"
                      : "info"
                }
              >
                {conn.status}
              </StatusBadge>
            </div>
            <div className="text-sm font-bold text-[var(--text-primary)]">{conn.displayName}</div>
            {conn.externalDomain && (
              <div className="font-mono text-xs text-[var(--text-secondary)]">
                Target: {conn.externalDomain}
              </div>
            )}
            <div className="font-mono text-[11px] text-[var(--text-muted)]">
              Vault Secret: {conn.secretFingerprint ?? "Using platform env / CSV only"}
            </div>
          </div>
        ))}
      </div>

      <section className="space-y-3">
        <h2 className="m-0 text-base font-bold text-[var(--text-primary)]">
          Notification &amp; Dev-Sink Delivery Ledger ({notifications.length})
        </h2>
        <DataTableWrap label="Notification delivery log">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] font-mono text-xs uppercase text-[var(--text-muted)]">
                <th className="p-3">Channel</th>
                <th className="p-3">Recipient (Masked)</th>
                <th className="p-3">Template</th>
                <th className="p-3">Subject</th>
                <th className="p-3">Delivery Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {notifications.map((n) => (
                <tr key={n.id}>
                  <td className="p-3">
                    <TechCode>{n.channel}</TechCode>
                  </td>
                  <td className="p-3 font-mono text-xs text-[var(--text-secondary)]">
                    {n.recipientMasked}
                  </td>
                  <td className="p-3 font-mono text-xs text-[var(--text-muted)]">
                    {n.templateName}
                  </td>
                  <td className="p-3 text-xs text-[var(--text-primary)]">{n.subject}</td>
                  <td className="p-3">
                    <StatusBadge
                      tone={n.deliveryStatus === "DELIVERED_CONFIRMED" ? "ok" : "neutral"}
                    >
                      {n.deliveryStatus}
                    </StatusBadge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataTableWrap>
      </section>
    </div>
  );
}
