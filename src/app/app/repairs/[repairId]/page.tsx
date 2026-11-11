import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageSession } from "@/auth/page-auth";
import { RepairBenchForm } from "@/components/repair-bench";
import { SectionHeader, StatusBadge, TechCode } from "@/components/ui/primitives";
import { assertValidUuid } from "@/db/tenant";
import { formatMoneyMinor } from "@/domain/money";
import { hasPermission } from "@/security/rbac";
import { getTenantRepairDetail } from "@/services/repairs";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Technician Repair Bench",
};

export default async function RepairDetailPage({
  params,
}: {
  params: Promise<{ repairId: string }>;
}) {
  const session = await requirePageSession("console:read");
  const { repairId } = await params;

  try {
    assertValidUuid(repairId, "repairId");
    const detail = await getTenantRepairDetail(session, repairId);
    const { repair, centre, claim, product, usages, centreParts } = detail;

    return (
      <div className="space-y-6">
        <SectionHeader
          eyebrow={`${repair.jobNumber} · ${centre.name} (${centre.code})`}
          title={`${product.name} (${product.sku})`}
          description={`Claim ${claim.claimNumber} · Serial ${detail.serialDisplay} · ${repair.routingReason}`}
          actions={
            <div className="flex items-center gap-2">
              <StatusBadge tone={repair.stage === "DISPATCHED" ? "ok" : "warn"}>
                {repair.stage}
              </StatusBadge>
              <Link
                href="/app/repairs"
                className="inline-flex h-9 items-center rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 text-xs font-semibold text-[var(--text-primary)] no-underline"
              >
                &larr; All Repairs
              </Link>
            </div>
          }
        />

        <RepairBenchForm
          repairId={repair.id}
          initialStage={repair.stage}
          initialDiagnosis={repair.diagnosisCode}
          initialNotes={repair.inspectionNotes}
          initialChecklist={repair.qaChecklist}
          initialLabourMinor={repair.labourCostMinor}
          initialFreightMinor={repair.freightCostMinor}
          initialCarrier={repair.returnCarrier ?? ""}
          initialTracking={repair.returnTrackingNumber ?? ""}
          centreParts={centreParts.map((p) => ({
            id: p.id,
            partSku: p.partSku,
            name: p.name,
            quantityOnHand: p.quantityOnHand,
          }))}
          canExecute={hasPermission(session.role, "repairs:execute")}
        />

        <section className="cd-surface rounded-xl p-5 space-y-3">
          <h2 className="m-0 text-base font-bold text-[var(--text-primary)]">
            Consumed Spare Parts Ledger ({usages.length})
          </h2>
          {usages.length === 0 ? (
            <p className="m-0 text-xs text-[var(--text-muted)]">
              No spare parts consumed on this job yet.
            </p>
          ) : (
            <ul className="m-0 list-none space-y-2 p-0 text-xs">
              {usages.map((u) => (
                <li
                  key={u.usage.id}
                  className="cd-elevated rounded p-3 flex items-center justify-between gap-2"
                >
                  <div>
                    <TechCode>{u.partSku}</TechCode>{" "}
                    <span className="text-[var(--text-primary)] ml-1.5">
                      {u.usage.quantity}x {u.partName}
                    </span>
                  </div>
                  <span className="font-mono text-[var(--text-secondary)]">
                    {formatMoneyMinor(
                      u.usage.quantity * u.usage.unitCostMinor,
                      session.tenantCurrency
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    );
  } catch {
    notFound();
  }
}
