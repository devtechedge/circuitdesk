import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StatusBadge, TechCode } from "@/components/ui/primitives";
import { REPAIR_STAGES } from "@/db/schema";
import { getPublicClaimTracker } from "@/services/claims";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Live Warranty Claim & Repair Tracker",
};

export default async function PublicClaimTrackerPage({
  params,
}: {
  params: Promise<{ brand: string; secureToken: string }>;
}) {
  const { brand, secureToken } = await params;
  const tracker = await getPublicClaimTracker({ brandSlug: brand, rawToken: secureToken });
  if (!tracker) {
    notFound();
  }

  const { claim, repair, rma, events } = tracker;

  return (
    <div data-testid="claim-tracker-view" className="space-y-6">
      <div className="cd-surface rounded-xl p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <TechCode>{claim.claimNumber}</TechCode>
            <StatusBadge tone={claim.status === "RESOLVED" ? "ok" : "info"}>
              {claim.status}
            </StatusBadge>
          </div>
          <span className="font-mono text-xs text-[var(--text-muted)]">
            Target Resolution: {claim.slaResolutionDueAt.toISOString().slice(0, 10)} UTC
          </span>
        </div>

        <div className="space-y-1">
          <h1 className="m-0 text-xl font-bold text-[var(--text-primary)]">
            {claim.productName} ({claim.productSku})
          </h1>
          <p className="m-0 text-sm text-[var(--text-secondary)]">
            Masked Serial: <code className="font-mono">{claim.serialMasked}</code> &middot; Fault:{" "}
            <code className="font-mono">{claim.faultCategory}</code> &middot; {claim.symptomSummary}
          </p>
        </div>

        {claim.decisionNotes && (
          <div className="cd-elevated rounded-lg p-3.5 text-xs text-[var(--text-secondary)]">
            <strong className="text-[var(--text-primary)]">Adjudication Note:</strong>{" "}
            {claim.decisionNotes}
          </div>
        )}
      </div>

      {repair && (
        <section className="cd-surface rounded-xl p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="m-0 text-base font-bold text-[var(--text-primary)]">
                Service Bench Progress ({repair.jobNumber})
              </h2>
              <p className="m-0 text-xs text-[var(--text-muted)]">
                Assigned Centre: {repair.centreName} ({repair.centreCity})
              </p>
            </div>
            <StatusBadge tone={repair.stage === "DISPATCHED" ? "ok" : "warn"}>
              {repair.stage}
            </StatusBadge>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
            {REPAIR_STAGES.filter((s) => s !== "UNREPAIRABLE").map((stage) => {
              const currentIdx = REPAIR_STAGES.indexOf(repair.stage);
              const stageIdx = REPAIR_STAGES.indexOf(stage);
              const reached = stageIdx <= currentIdx;
              return (
                <div
                  key={stage}
                  className={`rounded border p-2 text-center font-mono text-[10px] ${
                    reached
                      ? "border-[var(--signal-orange)] bg-[var(--bg-elevated)] text-[var(--text-primary)]"
                      : "border-[var(--border-subtle)] text-[var(--text-muted)]"
                  }`}
                >
                  {stage}
                </div>
              );
            })}
          </div>

          {repair.returnTrackingNumber && (
            <p className="m-0 font-mono text-xs text-[var(--text-secondary)]">
              Outbound Dispatch: {repair.returnCarrier ?? "Courier"} &middot;{" "}
              {repair.returnTrackingNumber}
            </p>
          )}
        </section>
      )}

      {rma && (
        <section className="cd-surface rounded-xl p-5 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <TechCode>{rma.rmaNumber}</TechCode>
            <StatusBadge tone="neutral">{rma.status}</StatusBadge>
          </div>
          <p className="m-0 text-xs text-[var(--text-secondary)]">
            Logistics Mode: {rma.carrierMode} &middot; {rma.carrierName}
            {rma.trackingNumber ? ` · Tracking ${rma.trackingNumber}` : ""}
          </p>
        </section>
      )}

      <section className="cd-surface rounded-xl p-6 space-y-3">
        <h2 className="m-0 text-base font-bold text-[var(--text-primary)]">Event Timeline</h2>
        <ol className="m-0 list-none space-y-3 p-0">
          {events.map((ev) => (
            <li
              key={ev.id}
              className="cd-elevated rounded-lg p-3.5 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="space-y-0.5">
                <TechCode>{ev.eventType}</TechCode>
                <p className="m-0 text-sm text-[var(--text-primary)]">{ev.message}</p>
              </div>
              <span className="font-mono text-xs text-[var(--text-muted)] shrink-0">
                {ev.createdAt.toISOString().slice(0, 16).replace("T", " ")} UTC
              </span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
