import { desc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { requirePageSession } from "@/auth/page-auth";
import { SettingsPrivacyAndKeysPanel } from "@/components/admin-panels";
import { DataTableWrap, SectionHeader, StatusBadge, TechCode } from "@/components/ui/primitives";
import { withTenantDb } from "@/db/tenant";
import { apiKeys, productionBatches, recallCampaigns } from "@/db/schema";
import { hasPermission } from "@/security/rbac";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Settings, API Keys & DPDP Privacy",
};

export default async function SettingsPage() {
  const session = await requirePageSession("console:read");

  const data = await withTenantDb(session.tenantId, async (tx) => {
    const keys = await tx
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.tenantId, session.tenantId))
      .orderBy(desc(apiKeys.createdAt));

    const batches = await tx
      .select({ id: productionBatches.id, batchCode: productionBatches.batchCode })
      .from(productionBatches)
      .where(eq(productionBatches.tenantId, session.tenantId));

    const recalls = await tx
      .select()
      .from(recallCampaigns)
      .where(eq(recallCampaigns.tenantId, session.tenantId))
      .orderBy(desc(recallCampaigns.createdAt));

    return { keys, batches, recalls };
  });

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow={`Workspace Slug: ${session.tenantSlug}`}
        title="Security Settings, API Keys, DPDP Privacy & Recall Gate"
        description="Manage SHA-256 hashed API keys, Data Principal JSON export/erasure, and Owner-gated batch recall audiences."
      />

      <SettingsPrivacyAndKeysPanel
        batches={data.batches}
        recalls={data.recalls}
        canManageSettings={hasPermission(session.role, "settings:write")}
        canApproveRecall={hasPermission(session.role, "recall:approve")}
      />

      <section className="space-y-3">
        <h2 className="m-0 text-base font-bold text-[var(--text-primary)]">
          Issued REST API Keys ({data.keys.length})
        </h2>
        <DataTableWrap label="Workspace API keys table">
          <table className="w-full min-w-[600px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] font-mono text-xs uppercase text-[var(--text-muted)]">
                <th className="p-3">Name</th>
                <th className="p-3">Prefix</th>
                <th className="p-3">Scopes</th>
                <th className="p-3">State</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {data.keys.map((k) => (
                <tr key={k.id}>
                  <td className="p-3 font-medium text-[var(--text-primary)]">{k.name}</td>
                  <td className="p-3">
                    <TechCode>{k.keyPrefix}...</TechCode>
                  </td>
                  <td className="p-3 font-mono text-xs text-[var(--text-secondary)]">
                    {k.scopes.join(", ")}
                  </td>
                  <td className="p-3">
                    <StatusBadge tone={k.revokedAt ? "danger" : "ok"}>
                      {k.revokedAt ? "REVOKED" : "ACTIVE"}
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
