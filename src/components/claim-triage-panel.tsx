"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import type { AiClaimSummary } from "@/db/schema";
import { AlertBanner, StatusBadge, TechCode } from "./ui/primitives";

const DECLINE_REASONS = [
  "OUT_OF_WARRANTY_WINDOW",
  "PHYSICAL_OR_LIQUID_DAMAGE",
  "UNAUTHORIZED_MODIFICATION",
  "UNVERIFIED_PROOF_OF_PURCHASE",
  "DUPLICATE_CLAIM",
] as const;

export function ClaimTriagePanel({
  claimId,
  currentStatus,
  aiSummary,
  centres,
  canAdjudicate,
}: {
  claimId: string;
  currentStatus: string;
  aiSummary: AiClaimSummary | null;
  centres: Array<{ id: string; name: string; code: string; city: string }>;
  canAdjudicate: boolean;
}) {
  const router = useRouter();
  const [decision, setDecision] = useState<
    "APPROVE_REPAIR" | "APPROVE_REPLACE" | "APPROVE_REFUND" | "REQUEST_INFO" | "DECLINE" | "CLOSE"
  >("APPROVE_REPAIR");
  const [decisionNotes, setDecisionNotes] = useState(
    "Verified serial and receipt; routing to bench under warranty."
  );
  const [declineReasonCode, setDeclineReasonCode] = useState<(typeof DECLINE_REASONS)[number]>(
    "PHYSICAL_OR_LIQUID_DAMAGE"
  );
  const [preferredCentre, setPreferredCentre] = useState("");
  const [refundMajor, setRefundMajor] = useState("0");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function runAiSummary() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/app/claims/${claimId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "ai_summary" }),
      });
      const data = (await res.json()) as { error?: { message?: string } };
      if (!res.ok) {
        setError(data.error?.message ?? "Could not generate triage summary.");
        setBusy(false);
        return;
      }
      setBusy(false);
      router.refresh();
    } catch {
      setError("Network error running triage assistant.");
      setBusy(false);
    }
  }

  async function submitDecision(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/app/claims/${claimId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision,
          decisionNotes,
          ...(decision === "DECLINE" ? { declineReasonCode } : {}),
          ...(decision === "APPROVE_REFUND"
            ? { refundAmountMinor: Math.round(Number(refundMajor) * 100) }
            : {}),
          ...(decision === "APPROVE_REPAIR" && preferredCentre
            ? { preferredServiceCentreId: preferredCentre }
            : {}),
        }),
      });
      const data = (await res.json()) as {
        repairOrder?: { id: string; jobNumber: string } | null;
        rmaOrder?: { rmaNumber: string } | null;
        error?: { message?: string };
      };
      if (!res.ok) {
        setError(data.error?.message ?? "Adjudication failed.");
        setBusy(false);
        return;
      }
      setNotice(
        data.repairOrder
          ? `Approved and routed to repair job ${data.repairOrder.jobNumber}.`
          : data.rmaOrder
            ? `Issued RMA ${data.rmaOrder.rmaNumber}.`
            : `Recorded human decision: ${decision}.`
      );
      setBusy(false);
      router.refresh();
    } catch {
      setError("Network error recording decision.");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Optional AI Evidence Triage Assistant */}
      <section className="cd-surface rounded-xl p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="m-0 text-base font-bold text-[var(--text-primary)]">
              Evidence &amp; Triage Brief
            </h2>
            <StatusBadge tone="warn">AI Suggestion · Human Approval Required</StatusBadge>
          </div>
          {canAdjudicate && (
            <button
              type="button"
              disabled={busy}
              onClick={runAiSummary}
              data-testid="generate-ai-summary-btn"
              className="inline-flex h-8 items-center rounded border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-3 font-mono text-xs text-[var(--text-primary)] cursor-pointer disabled:opacity-60"
            >
              {aiSummary ? "Refresh Triage Brief" : "Generate Evidence Summary"}
            </button>
          )}
        </div>

        {aiSummary ? (
          <div className="cd-elevated rounded-lg p-4 space-y-3 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <TechCode>Adapter: {aiSummary.provider}</TechCode>
              <TechCode>Suggested Fault: {aiSummary.suggestedFaultCategory}</TechCode>
              <TechCode>Next Step: {aiSummary.suggestedNextAction}</TechCode>
            </div>
            <p className="m-0 text-sm text-[var(--text-primary)]">{aiSummary.evidenceSummary}</p>
            <div>
              <strong className="text-[var(--text-primary)]">Draft Customer Reply:</strong>
              <p className="m-0 mt-1 rounded border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-2.5 text-[var(--text-secondary)]">
                {aiSummary.draftCustomerReply}
              </p>
            </div>
            <div>
              <strong className="text-[var(--text-primary)]">Source Evidence Citations:</strong>
              <ul className="m-0 mt-1 list-disc pl-5 space-y-0.5 text-[var(--text-muted)]">
                {aiSummary.sourceCitations.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <p className="m-0 text-xs text-[var(--text-muted)]">
            No triage summary generated yet. Summarizer extracts receipt references and suggests
            bench routing; it is architecturally barred from declining coverage.
          </p>
        )}
      </section>

      {/* Human Adjudication Form */}
      {canAdjudicate ? (
        <form
          onSubmit={submitDecision}
          data-testid="human-triage-form"
          className="cd-surface rounded-xl p-5 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="m-0 text-base font-bold text-[var(--text-primary)]">
              Human Adjudication Decision (Current: {currentStatus})
            </h2>
            <StatusBadge tone="ok">Authenticated Operator Action</StatusBadge>
          </div>

          {error && (
            <AlertBanner tone="danger" title="Decision Error">
              {error}
            </AlertBanner>
          )}
          {notice && (
            <AlertBanner tone="ok" title="Decision Recorded">
              {notice}
            </AlertBanner>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="tr-dec" className="block font-mono text-xs uppercase text-[var(--text-muted)] mb-1">
                Action
              </label>
              <select
                id="tr-dec"
                value={decision}
                onChange={(e) => setDecision(e.target.value as typeof decision)}
                className="h-10 w-full rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--text-primary)]"
              >
                <option value="APPROVE_REPAIR">Approve &amp; Route to Service Bench (PIN Router)</option>
                <option value="APPROVE_REPLACE">Approve Warranty Replacement + RMA</option>
                <option value="APPROVE_REFUND">Approve Refund Authorization</option>
                <option value="REQUEST_INFO">Request Additional Receipt / Photo</option>
                <option value="DECLINE">Decline Coverage (Reason Code Required)</option>
                <option value="CLOSE">Close Claim</option>
              </select>
            </div>

            {decision === "APPROVE_REPAIR" && (
              <div>
                <label htmlFor="tr-centre" className="block font-mono text-xs uppercase text-[var(--text-muted)] mb-1">
                  Service Centre Routing
                </label>
                <select
                  id="tr-centre"
                  value={preferredCentre}
                  onChange={(e) => setPreferredCentre(e.target.value)}
                  className="h-10 w-full rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--text-primary)]"
                >
                  <option value="">Automatic PIN-Prefix + Skill + Load Router</option>
                  {centres.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} - {c.name} ({c.city})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {decision === "DECLINE" && (
              <div>
                <label htmlFor="tr-reason" className="block font-mono text-xs uppercase text-[var(--text-muted)] mb-1">
                  Mandatory Decline Reason Code
                </label>
                <select
                  id="tr-reason"
                  value={declineReasonCode}
                  onChange={(e) =>
                    setDeclineReasonCode(e.target.value as (typeof DECLINE_REASONS)[number])
                  }
                  className="h-10 w-full rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--text-primary)]"
                >
                  {DECLINE_REASONS.map((code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {decision === "APPROVE_REFUND" && (
              <div>
                <label htmlFor="tr-ref" className="block font-mono text-xs uppercase text-[var(--text-muted)] mb-1">
                  Refund Amount (Major Units)
                </label>
                <input
                  id="tr-ref"
                  type="number"
                  min={0}
                  value={refundMajor}
                  onChange={(e) => setRefundMajor(e.target.value)}
                  className="h-10 w-full rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 font-mono text-sm text-[var(--text-primary)]"
                />
              </div>
            )}

            <div className="sm:col-span-2">
              <label htmlFor="tr-notes" className="block font-mono text-xs uppercase text-[var(--text-muted)] mb-1">
                Decision Notes (Recorded on Public Tracker &amp; Immutable Audit Trail)
              </label>
              <textarea
                id="tr-notes"
                required
                minLength={4}
                rows={2}
                value={decisionNotes}
                onChange={(e) => setDecisionNotes(e.target.value)}
                className="w-full rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-2.5 text-sm text-[var(--text-primary)]"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={busy}
            data-testid="submit-adjudication-btn"
            className="inline-flex h-10 items-center rounded-md bg-[var(--signal-orange)] px-4 text-xs font-semibold text-[var(--on-signal)] cursor-pointer disabled:opacity-60"
          >
            {busy ? "Recording decision..." : "Commit Human Decision"}
          </button>
        </form>
      ) : (
        <AlertBanner tone="neutral" title="Adjudication Restricted">
          Your role cannot approve or decline claims. Only Owner, Admin, Operations, and Support
          operators hold claims:adjudicate permission.
        </AlertBanner>
      )}
    </div>
  );
}
