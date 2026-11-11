import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageSession } from "@/auth/page-auth";
import { ClaimTriagePanel } from "@/components/claim-triage-panel";
import { SectionHeader, StatusBadge, TechCode } from "@/components/ui/primitives";
import { assertValidUuid } from "@/db/tenant";
import { AppError } from "@/lib/errors";
import { hasPermission } from "@/security/rbac";
import { getTenantClaimDetail } from "@/services/claims";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Claim Adjudication Workspace",
};

export default async function ClaimDetailPage({
  params,
}: {
  params: Promise<{ claimId: string }>;
}) {
  const session = await requirePageSession("console:read");
  const { claimId } = await params;

  let detail: Awaited<ReturnType<typeof getTenantClaimDetail>>;
  try {
    assertValidUuid(claimId, "claimId");
    detail = await getTenantClaimDetail(session, claimId);
  } catch (err) {
    if (err instanceof AppError && err.status === 404) {
      notFound();
    }
    notFound();
  }

  const { claim, product, evidence, events, repairs, rmas, centres } = detail;

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow={`Claim ${claim.claimNumber} · ${product.sku}`}
        title={claim.symptomSummary}
        description={`Submitted by ${claim.customerName} (${claim.customerEmail}) · PIN ${claim.shippingPinCode} (${claim.shippingCity})`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={claim.status === "RESOLVED" ? "ok" : "info"}>
              {claim.status}
            </StatusBadge>
            <Link
              href="/app/claims"
              className="inline-flex h-9 items-center rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 text-xs font-semibold text-[var(--text-primary)] no-underline"
            >
              &larr; Queue
            </Link>
          </div>
        }
      />

      {/* Policy Snapshot + Duplicate Signals + Encrypted Evidence */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="cd-surface rounded-xl p-5 space-y-2 text-xs">
          <h2 className="m-0 text-sm font-bold text-[var(--text-primary)]">
            Immutable Policy Snapshot
          </h2>
          <div>
            <strong className="text-[var(--text-primary)]">Policy:</strong>{" "}
            {claim.policySnapshot.policyName}
          </div>
          <div>
            <strong className="text-[var(--text-primary)]">Serial:</strong>{" "}
            <TechCode>{detail.serialDisplay}</TechCode>
          </div>
          <div className="flex flex-wrap gap-1.5 pt-1">
            <StatusBadge tone={claim.policySnapshot.withinCoverageWindow ? "ok" : "danger"}>
              {claim.policySnapshot.withinCoverageWindow ? "In Window" : "Out of Window"}
            </StatusBadge>
            <StatusBadge tone={claim.policySnapshot.withinDoaWindow ? "warn" : "neutral"}>
              {claim.policySnapshot.withinDoaWindow ? "DOA Window" : "Standard Term"}
            </StatusBadge>
            <StatusBadge tone={claim.policySnapshot.faultCoveredByPolicy ? "ok" : "warn"}>
              {claim.policySnapshot.faultCoveredByPolicy ? "Fault Covered" : "Check Exclusions"}
            </StatusBadge>
          </div>
        </div>

        <div className="cd-surface rounded-xl p-5 space-y-2 text-xs">
          <h2 className="m-0 text-sm font-bold text-[var(--text-primary)]">
            Duplicate &amp; Policy Risk Signals
          </h2>
          {claim.duplicateSignals.length === 0 ? (
            <p className="m-0 text-[var(--text-muted)]">
              Zero duplicate serial or velocity signals flagged.
            </p>
          ) : (
            <ul className="m-0 list-none space-y-2 p-0">
              {claim.duplicateSignals.map((sig) => (
                <li key={sig.code} className="cd-elevated rounded p-2.5 space-y-1">
                  <StatusBadge tone={sig.severity === "HIGH" ? "danger" : "warn"}>
                    {sig.code}
                  </StatusBadge>
                  <p className="m-0 text-[var(--text-secondary)]">{sig.detail}</p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="cd-surface rounded-xl p-5 space-y-2 text-xs">
          <h2 className="m-0 text-sm font-bold text-[var(--text-primary)]">
            Private Encrypted Evidence ({evidence.length})
          </h2>
          {evidence.length === 0 ? (
            <p className="m-0 text-[var(--text-muted)]">No attachments uploaded yet.</p>
          ) : (
            <ul className="m-0 list-none space-y-2 p-0">
              {evidence.map((ev) => (
                <li key={ev.id} className="cd-elevated rounded p-2.5 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <TechCode>{ev.kind}</TechCode>
                    <a
                      href={ev.signedDownloadUrl}
                      className="font-mono text-[var(--signal-cobalt)] hover:underline"
                    >
                      Signed Download &darr;
                    </a>
                  </div>
                  <div className="truncate text-[var(--text-secondary)]">{ev.fileName}</div>
                  <div className="font-mono text-[10px] text-[var(--text-muted)] truncate">
                    SHA-256: {ev.sha256Hex.slice(0, 20)}...
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="cd-surface rounded-xl p-5 space-y-2">
        <h2 className="m-0 text-sm font-bold text-[var(--text-primary)]">
          Customer Reported Issue ({claim.faultCategory})
        </h2>
        <p className="m-0 text-sm text-[var(--text-secondary)] leading-relaxed">
          {claim.customerDescription}
        </p>
      </div>

      {/* Linked Repair Jobs & RMAs */}
      {(repairs.length > 0 || rmas.length > 0) && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {repairs.map((rep) => (
            <Link
              key={rep.id}
              href={`/app/repairs/${rep.id}`}
              className="cd-elevated rounded-xl p-4 space-y-1 hover:border-[var(--signal-orange)] no-underline"
            >
              <div className="flex items-center justify-between">
                <TechCode>{rep.jobNumber}</TechCode>
                <StatusBadge tone="warn">{rep.stage}</StatusBadge>
              </div>
              <p className="m-0 text-xs text-[var(--text-secondary)]">{rep.routingReason}</p>
            </Link>
          ))}

          {rmas.map((r) => (
            <div key={r.id} className="cd-elevated rounded-xl p-4 space-y-1">
              <div className="flex items-center justify-between">
                <TechCode>{r.rmaNumber}</TechCode>
                <StatusBadge tone="neutral">{r.status}</StatusBadge>
              </div>
              <p className="m-0 text-xs text-[var(--text-secondary)]">
                {r.direction} &middot; {r.disposition}
              </p>
            </div>
          ))}
        </div>
      )}

      <ClaimTriagePanel
        claimId={claim.id}
        currentStatus={claim.status}
        aiSummary={claim.aiSummary ?? null}
        centres={centres.map((c) => ({ id: c.id, name: c.name, code: c.code, city: c.city }))}
        canAdjudicate={hasPermission(session.role, "claims:adjudicate")}
      />

      {/* Event History */}
      <section className="cd-surface rounded-xl p-5 space-y-3">
        <h2 className="m-0 text-base font-bold text-[var(--text-primary)]">
          Preserved Claim Event History ({events.length})
        </h2>
        <ol className="m-0 list-none space-y-2 p-0 text-xs">
          {events.map((ev) => (
            <li
              key={ev.id}
              className="cd-elevated rounded p-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <TechCode>{ev.eventType}</TechCode>{" "}
                <span className="text-[var(--text-primary)] ml-1.5">{ev.message}</span>
              </div>
              <span className="font-mono text-[var(--text-muted)] shrink-0">
                {ev.createdAt.toISOString().slice(0, 16).replace("T", " ")} UTC
              </span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
