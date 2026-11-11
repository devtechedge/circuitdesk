"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { type CurrencyCode, type PlanCode, ROLES, type Role } from "@/db/schema";
import { AlertBanner, StatusBadge, TechCode } from "./ui/primitives";

export function TeamInvitePanel({ canManage }: { canManage: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("SUPPORT");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!canManage) return null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const res = await fetch("/api/app/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "invite", email, role }),
      });
      const data = (await res.json()) as {
        inviteTokenPreview?: string;
        error?: { message?: string };
      };
      if (!res.ok) {
        setError(data.error?.message ?? "Failed to send invitation.");
        setBusy(false);
        return;
      }
      setNotice(`Issued revocable invitation (${data.inviteTokenPreview}).`);
      setEmail("");
      setBusy(false);
      router.refresh();
    } catch {
      setError("Network error creating invitation.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="cd-surface rounded-xl p-5 space-y-3">
      <h2 className="m-0 text-base font-bold text-[var(--text-primary)]">
        Invite Operator or Service Bench Technician
      </h2>
      {error && (
        <AlertBanner tone="danger" title="Invitation Error">
          {error}
        </AlertBanner>
      )}
      {notice && (
        <AlertBanner tone="ok" title="Invitation Created">
          {notice}
        </AlertBanner>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor="tm-email" className="block font-mono text-xs uppercase text-[var(--text-muted)] mb-1">
            Teammate Email
          </label>
          <input
            id="tm-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="bench.blr@brand.example"
            className="h-9 w-full rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 text-xs text-[var(--text-primary)]"
          />
        </div>
        <div>
          <label htmlFor="tm-role" className="block font-mono text-xs uppercase text-[var(--text-muted)] mb-1">
            RBAC Role
          </label>
          <select
            id="tm-role"
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            className="h-9 w-full rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 text-xs text-[var(--text-primary)]"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <button
            type="submit"
            disabled={busy}
            className="inline-flex h-9 w-full items-center justify-center rounded-md bg-[var(--signal-orange)] px-4 text-xs font-semibold text-[var(--on-signal)] cursor-pointer"
          >
            Send RBAC Invitation
          </button>
        </div>
      </div>
    </form>
  );
}

export function BillingActionPanel({
  currentPlan,
  currentCurrency,
  canManage,
}: {
  currentPlan: PlanCode;
  currentCurrency: CurrencyCode;
  canManage: boolean;
}) {
  const router = useRouter();
  const [planCode, setPlanCode] = useState<"STARTER" | "GROWTH" | "SCALE">(
    currentPlan === "ENTERPRISE" ? "SCALE" : currentPlan
  );
  const [currency, setCurrency] = useState<CurrencyCode>(currentCurrency);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!canManage) {
    return (
      <AlertBanner tone="neutral" title="Billing View Only">
        Only Owner and Admin roles can change plans or manage payment mandates.
      </AlertBanner>
    );
  }

  async function act(action: "SWITCH_PLAN" | "CANCEL_AT_PERIOD_END") {
    setError(null);
    setMessage(null);
    setBusy(true);
    try {
      const res = await fetch("/api/app/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planCode, currency, action }),
      });
      const data = (await res.json()) as {
        checkoutUrl?: string | null;
        message?: string;
        error?: { message?: string };
      };
      if (!res.ok) {
        setError(data.error?.message ?? "Billing update failed.");
        setBusy(false);
        return;
      }
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
        return;
      }
      setMessage(data.message ?? "Updated subscription state.");
      setBusy(false);
      router.refresh();
    } catch {
      setError("Network error updating subscription.");
      setBusy(false);
    }
  }

  return (
    <div className="cd-surface rounded-xl p-5 space-y-4">
      <h2 className="m-0 text-base font-bold text-[var(--text-primary)]">
        Change Plan, Currency or Subscription State
      </h2>
      {error && (
        <AlertBanner tone="danger" title="Billing Error">
          {error}
        </AlertBanner>
      )}
      {message && (
        <AlertBanner tone="info" title="Subscription Updated">
          {message}
        </AlertBanner>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor="bl-plan" className="block font-mono text-xs uppercase text-[var(--text-muted)] mb-1">
            Target Plan
          </label>
          <select
            id="bl-plan"
            value={planCode}
            onChange={(e) => setPlanCode(e.target.value as typeof planCode)}
            className="h-9 w-full rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 text-xs text-[var(--text-primary)]"
          >
            <option value="STARTER">STARTER ($49 / INR 3,999)</option>
            <option value="GROWTH">GROWTH ($129 / INR 9,999)</option>
            <option value="SCALE">SCALE ($299 / INR 24,999)</option>
          </select>
        </div>

        <div>
          <label htmlFor="bl-curr" className="block font-mono text-xs uppercase text-[var(--text-muted)] mb-1">
            Currency Rail
          </label>
          <select
            id="bl-curr"
            value={currency}
            onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
            className="h-9 w-full rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 text-xs text-[var(--text-primary)]"
          >
            <option value="INR">INR (Razorpay Subscriptions)</option>
            <option value="USD">USD (Stripe Checkout)</option>
          </select>
        </div>

        <div className="flex items-end gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => act("SWITCH_PLAN")}
            data-testid="switch-plan-btn"
            className="inline-flex h-9 flex-1 items-center justify-center rounded-md bg-[var(--signal-orange)] px-3 text-xs font-semibold text-[var(--on-signal)] cursor-pointer"
          >
            Apply Plan
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => act("CANCEL_AT_PERIOD_END")}
            className="inline-flex h-9 items-center justify-center rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 text-xs text-[var(--text-secondary)] cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export function SettingsPrivacyAndKeysPanel({
  batches,
  recalls,
  canManageSettings,
  canApproveRecall,
}: {
  batches: Array<{ id: string; batchCode: string }>;
  recalls: Array<{
    id: string;
    title: string;
    reason: string;
    affectedCount: number;
    status: string;
  }>;
  canManageSettings: boolean;
  canApproveRecall: boolean;
}) {
  const router = useRouter();
  const [keyName, setKeyName] = useState("ERP Serial Sync Key");
  const [mintedKey, setMintedKey] = useState<string | null>(null);

  const [dpdpEmail, setDpdpEmail] = useState("");
  const [confirmPhrase, setConfirmPhrase] = useState("");
  const [dpdpResult, setDpdpResult] = useState<string | null>(null);

  const [batchId, setBatchId] = useState(batches[0]?.id ?? "");
  const [recallTitle, setRecallTitle] = useState("");
  const [recallReason, setRecallReason] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function mintApiKey(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const res = await fetch("/api/app/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "create_api_key",
        name: keyName,
        scopes: ["serials:read", "claims:read"],
      }),
    });
    const data = (await res.json()) as { rawKey?: string; error?: { message?: string } };
    if (!res.ok) {
      setError(data.error?.message ?? "Failed to create API key.");
      setBusy(false);
      return;
    }
    setMintedKey(data.rawKey ?? null);
    setBusy(false);
    router.refresh();
  }

  async function runDpdpExport() {
    setError(null);
    setBusy(true);
    const res = await fetch("/api/app/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "dpdp_export", customerEmail: dpdpEmail }),
    });
    const data = (await res.json()) as { dossier?: unknown; error?: { message?: string } };
    if (!res.ok) {
      setError(data.error?.message ?? "DPDP export failed.");
      setBusy(false);
      return;
    }
    setDpdpResult(JSON.stringify(data.dossier, null, 2));
    setBusy(false);
  }

  async function runDpdpErase() {
    setError(null);
    setBusy(true);
    const res = await fetch("/api/app/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "dpdp_erase",
        customerEmail: dpdpEmail,
        confirmPhrase,
      }),
    });
    const data = (await res.json()) as {
      erasedRegistrations?: number;
      erasedClaims?: number;
      error?: { message?: string };
    };
    if (!res.ok) {
      setError(data.error?.message ?? "DPDP erasure failed.");
      setBusy(false);
      return;
    }
    setDpdpResult(
      `Erased PII across ${data.erasedRegistrations} registration(s) and ${data.erasedClaims} claim(s), and revoked portal tokens.`
    );
    setBusy(false);
    router.refresh();
  }

  async function createRecall(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const res = await fetch("/api/app/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "create_recall",
        batchId,
        title: recallTitle,
        reason: recallReason,
      }),
    });
    const data = (await res.json()) as { error?: { message?: string } };
    if (!res.ok) {
      setError(data.error?.message ?? "Failed to create recall draft.");
      setBusy(false);
      return;
    }
    setRecallTitle("");
    setRecallReason("");
    setBusy(false);
    router.refresh();
  }

  async function approveRecall(campaignId: string) {
    setBusy(true);
    await fetch("/api/app/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "approve_recall", campaignId }),
    });
    setBusy(false);
    router.refresh();
  }

  async function revokeOtherSessions() {
    setBusy(true);
    const res = await fetch("/api/sessions/revoke", { method: "POST" });
    const data = (await res.json()) as { revokedCount?: number };
    setDpdpResult(`Revoked ${data.revokedCount ?? 0} other active session(s).`);
    setBusy(false);
  }

  return (
    <div className="space-y-6">
      {error && (
        <AlertBanner tone="danger" title="Settings Error">
          {error}
        </AlertBanner>
      )}

      {/* Session Hygiene */}
      <div className="cd-surface rounded-xl p-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="m-0 text-base font-bold text-[var(--text-primary)]">
            Active Session Security
          </h2>
          <p className="m-0 text-xs text-[var(--text-muted)]">
            Immediately revoke any other browser or device sessions for your operator account.
          </p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={revokeOtherSessions}
          className="inline-flex h-9 items-center rounded-md border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-3.5 text-xs font-semibold text-[var(--text-primary)] cursor-pointer"
        >
          Revoke Other Sessions
        </button>
      </div>

      {/* Hashed API Keys */}
      {canManageSettings && (
        <form onSubmit={mintApiKey} className="cd-surface rounded-xl p-5 space-y-3">
          <h2 className="m-0 text-base font-bold text-[var(--text-primary)]">
            Mint SHA-256 Hashed REST API Key (/api/v1/serials)
          </h2>
          <div className="flex flex-wrap gap-3">
            <input
              aria-label="API key name"
              required
              value={keyName}
              onChange={(e) => setKeyName(e.target.value)}
              className="h-9 flex-1 min-w-[200px] rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 text-xs text-[var(--text-primary)]"
            />
            <button
              type="submit"
              disabled={busy}
              className="inline-flex h-9 items-center rounded-md bg-[var(--signal-orange)] px-4 text-xs font-semibold text-[var(--on-signal)] cursor-pointer"
            >
              Generate Key
            </button>
          </div>
          {mintedKey && (
            <AlertBanner tone="warn" title="Copy Raw API Key Now (Shown Once; Only SHA-256 Stored)">
              <code className="font-mono text-xs break-all">{mintedKey}</code>
            </AlertBanner>
          )}
        </form>
      )}

      {/* DPDP Data Principal Export & Erasure */}
      {canManageSettings && (
        <section className="cd-surface rounded-xl p-5 space-y-3">
          <h2 className="m-0 text-base font-bold text-[var(--text-primary)]">
            DPDP Act / GDPR Data Principal Export &amp; PII Erasure
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label htmlFor="dp-email" className="block font-mono text-xs uppercase text-[var(--text-muted)] mb-1">
                Customer Email
              </label>
              <input
                id="dp-email"
                type="email"
                value={dpdpEmail}
                onChange={(e) => setDpdpEmail(e.target.value)}
                placeholder="customer@example.com"
                className="h-9 w-full rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 text-xs text-[var(--text-primary)]"
              />
            </div>
            <div>
              <label htmlFor="dp-conf" className="block font-mono text-xs uppercase text-[var(--text-muted)] mb-1">
                Type ERASE PII to Redact
              </label>
              <input
                id="dp-conf"
                value={confirmPhrase}
                onChange={(e) => setConfirmPhrase(e.target.value)}
                placeholder="ERASE PII"
                className="h-9 w-full rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 font-mono text-xs text-[var(--text-primary)]"
              />
            </div>
            <div className="flex items-end gap-2">
              <button
                type="button"
                disabled={busy || !dpdpEmail}
                onClick={runDpdpExport}
                className="inline-flex h-9 items-center rounded border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-3 text-xs font-semibold text-[var(--text-primary)] cursor-pointer"
              >
                Export JSON
              </button>
              <button
                type="button"
                disabled={busy || !dpdpEmail || confirmPhrase !== "ERASE PII"}
                onClick={runDpdpErase}
                className="inline-flex h-9 items-center rounded bg-[var(--status-danger-bg)] border border-[var(--status-danger-border)] px-3 text-xs font-semibold text-[var(--status-danger-fg)] cursor-pointer disabled:opacity-50"
              >
                Erase PII
              </button>
            </div>
          </div>
          {dpdpResult && (
            <pre className="cd-elevated rounded p-3 font-mono text-xs overflow-x-auto text-[var(--text-secondary)]">
              {dpdpResult}
            </pre>
          )}
        </section>
      )}

      {/* Human-Approved Recall Audience Builder */}
      <section className="cd-surface rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="m-0 text-base font-bold text-[var(--text-primary)]">
              Batch Recall &amp; Proactive Safety Audience Gate
            </h2>
            <p className="m-0 text-xs text-[var(--text-muted)]">
              Recall drafts calculate affected serialized units by batch, and strictly require Owner/Admin human approval.
            </p>
          </div>
          <StatusBadge tone="warn">Human Approval Mandatory</StatusBadge>
        </div>

        {canManageSettings && batches.length > 0 && (
          <form onSubmit={createRecall} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <select
              aria-label="Recall target batch"
              value={batchId}
              onChange={(e) => setBatchId(e.target.value)}
              className="h-9 rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 font-mono text-xs text-[var(--text-primary)]"
            >
              {batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.batchCode}
                </option>
              ))}
            </select>
            <input
              aria-label="Recall campaign title"
              required
              value={recallTitle}
              onChange={(e) => setRecallTitle(e.target.value)}
              placeholder="Proactive coin-cell swap notice"
              className="h-9 rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 text-xs text-[var(--text-primary)]"
            />
            <div className="flex gap-2">
              <input
                aria-label="Recall technical reason"
                required
                value={recallReason}
                onChange={(e) => setRecallReason(e.target.value)}
                placeholder="High cell impedance on lot"
                className="h-9 flex-1 rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 text-xs text-[var(--text-primary)]"
              />
              <button
                type="submit"
                disabled={busy}
                className="inline-flex h-9 items-center rounded bg-[var(--signal-cobalt)] px-3 text-xs font-semibold text-[var(--on-cobalt)] cursor-pointer shrink-0"
              >
                Draft
              </button>
            </div>
          </form>
        )}

        <div className="space-y-2">
          {recalls.map((rc) => (
            <div
              key={rc.id}
              className="cd-elevated rounded-lg p-3.5 flex flex-wrap items-center justify-between gap-2 text-xs"
            >
              <div>
                <span className="font-bold text-[var(--text-primary)]">{rc.title}</span> &middot;{" "}
                <TechCode>{rc.affectedCount} unit(s)</TechCode>
                <div className="text-[var(--text-muted)] mt-0.5">{rc.reason}</div>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge tone={rc.status === "APPROVED_READY" ? "ok" : "warn"}>
                  {rc.status}
                </StatusBadge>
                {canApproveRecall && rc.status === "DRAFT_AWAITING_APPROVAL" && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => approveRecall(rc.id)}
                    className="rounded bg-[var(--signal-orange)] px-2.5 py-1 font-mono text-[11px] font-semibold text-[var(--on-signal)] cursor-pointer"
                  >
                    Approve Audience
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
