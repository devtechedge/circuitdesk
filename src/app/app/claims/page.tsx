import type { Metadata } from "next";
import Link from "next/link";
import { requirePageSession } from "@/auth/page-auth";
import { DataTableWrap, SectionHeader, StatusBadge, TechCode } from "@/components/ui/primitives";
import { evaluateSlaWindow } from "@/domain/sla";
import { listTenantClaims } from "@/services/claims";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Claims Triage Queue",
};

export default async function ClaimsQueuePage() {
  const session = await requirePageSession("console:read");
  const claims = await listTenantClaims(session);

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Human Adjudication"
        title="Warranty & Dealer Claims Triage"
        description="Inspect coverage snapshots, duplicate/abuse signals, encrypted receipt attachments, and SLA countdowns."
      />

      <DataTableWrap label="Warranty claims triage queue">
        <table className="w-full min-w-[780px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] font-mono text-xs uppercase text-[var(--text-muted)]">
              <th className="p-3">Claim</th>
              <th className="p-3">Product &amp; Serial</th>
              <th className="p-3">Fault &amp; Symptom</th>
              <th className="p-3">PIN / City</th>
              <th className="p-3">SLA Clock</th>
              <th className="p-3">Status</th>
              <th className="p-3">Triage</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)]">
            {claims.map((c) => {
              const sla = evaluateSlaWindow({
                startedAt: c.createdAt,
                dueAt: c.slaResolutionDueAt,
                completedAt: c.resolvedAt,
              });
              return (
                <tr key={c.id}>
                  <td className="p-3 space-y-1">
                    <TechCode>{c.claimNumber}</TechCode>
                    <div>
                      <StatusBadge
                        tone={
                          c.priority === "URGENT"
                            ? "danger"
                            : c.priority === "HIGH"
                              ? "warn"
                              : "neutral"
                        }
                      >
                        {c.priority}
                      </StatusBadge>
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="font-medium text-[var(--text-primary)]">{c.sku}</div>
                    <div className="font-mono text-xs text-[var(--text-muted)]">
                      {c.serialDisplay}
                    </div>
                  </td>
                  <td className="p-3 max-w-xs">
                    <TechCode>{c.faultCategory}</TechCode>
                    <div className="mt-1 text-xs text-[var(--text-secondary)] truncate">
                      {c.symptomSummary}
                    </div>
                  </td>
                  <td className="p-3 font-mono text-xs text-[var(--text-secondary)]">
                    {c.shippingPinCode} &middot; {c.shippingCity}
                  </td>
                  <td className="p-3">
                    <StatusBadge
                      tone={
                        sla.state === "MET" || sla.state === "ON_TRACK"
                          ? "ok"
                          : sla.state === "AT_RISK"
                            ? "warn"
                            : "danger"
                      }
                    >
                      {sla.state} ({sla.remainingHours}h)
                    </StatusBadge>
                  </td>
                  <td className="p-3">
                    <StatusBadge tone={c.status === "RESOLVED" ? "ok" : "info"}>
                      {c.status}
                    </StatusBadge>
                  </td>
                  <td className="p-3">
                    <Link
                      href={`/app/claims/${c.id}`}
                      className="inline-flex h-8 items-center rounded bg-[var(--signal-orange)] px-3 font-mono text-xs font-semibold text-[var(--on-signal)] no-underline"
                    >
                      Triage &rarr;
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </DataTableWrap>
    </div>
  );
}
