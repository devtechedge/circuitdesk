"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { AlertBanner, StatusBadge, TechCode } from "./ui/primitives";

export function AutomationRuleCreator({
  rules,
  canWrite,
}: {
  rules: Array<{
    id: string;
    name: string;
    triggerEvent: string;
    actionType: string;
    enabled: boolean;
  }>;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [triggerEvent, setTriggerEvent] = useState<
    "CLAIM_SUBMITTED" | "REPAIR_DISPATCHED" | "SLA_75_PERCENT" | "BATCH_SPIKE"
  >("CLAIM_SUBMITTED");
  const [actionType, setActionType] = useState<
    "TAG_PRIORITY" | "NOTIFY_CHANNEL" | "ASSIGN_BENCH" | "SLA_ESCALATE"
  >("TAG_PRIORITY");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function addRule(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/app/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "rule",
          payload: {
            name,
            triggerEvent,
            conditionJson: {},
            actionType,
            actionConfig: { priority: "HIGH" },
          },
        }),
      });
      const data = (await res.json()) as { error?: { message?: string } };
      if (!res.ok) {
        setError(data.error?.message ?? "Could not create rule.");
        setBusy(false);
        return;
      }
      setName("");
      setBusy(false);
      router.refresh();
    } catch {
      setError("Network error saving rule.");
      setBusy(false);
    }
  }

  async function toggleRule(ruleId: string, enabled: boolean) {
    if (!canWrite) return;
    setBusy(true);
    await fetch("/api/app/integrations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "toggle_rule", ruleId, enabled }),
    });
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {canWrite && (
        <form onSubmit={addRule} className="cd-surface rounded-xl p-5 space-y-3">
          <h2 className="m-0 text-base font-bold text-[var(--text-primary)]">
            Create Non-Rejecting Workflow Rule
          </h2>
          <p className="m-0 text-xs text-[var(--text-muted)]">
            Automations tag priorities, escalate SLA warnings, and trigger notifications. Coverage denial is never automated.
          </p>
          {error && (
            <AlertBanner tone="danger" title="Automation Error">
              {error}
            </AlertBanner>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label htmlFor="ar-name" className="block font-mono text-xs uppercase text-[var(--text-muted)] mb-1">
                Rule Name
              </label>
              <input
                id="ar-name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Escalate battery claims on rogue lots"
                className="h-9 w-full rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 text-xs text-[var(--text-primary)]"
              />
            </div>
            <div>
              <label htmlFor="ar-trig" className="block font-mono text-xs uppercase text-[var(--text-muted)] mb-1">
                Trigger Event
              </label>
              <select
                id="ar-trig"
                value={triggerEvent}
                onChange={(e) => setTriggerEvent(e.target.value as typeof triggerEvent)}
                className="h-9 w-full rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 text-xs text-[var(--text-primary)]"
              >
                <option value="CLAIM_SUBMITTED">CLAIM_SUBMITTED</option>
                <option value="REPAIR_DISPATCHED">REPAIR_DISPATCHED</option>
                <option value="SLA_75_PERCENT">SLA_75_PERCENT</option>
                <option value="BATCH_SPIKE">BATCH_SPIKE</option>
              </select>
            </div>
            <div>
              <label htmlFor="ar-act" className="block font-mono text-xs uppercase text-[var(--text-muted)] mb-1">
                Safe Action
              </label>
              <select
                id="ar-act"
                value={actionType}
                onChange={(e) => setActionType(e.target.value as typeof actionType)}
                className="h-9 w-full rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 text-xs text-[var(--text-primary)]"
              >
                <option value="TAG_PRIORITY">TAG_PRIORITY</option>
                <option value="NOTIFY_CHANNEL">NOTIFY_CHANNEL</option>
                <option value="ASSIGN_BENCH">ASSIGN_BENCH</option>
                <option value="SLA_ESCALATE">SLA_ESCALATE</option>
              </select>
            </div>
          </div>
          <button
            type="submit"
            disabled={busy}
            className="inline-flex h-9 items-center rounded-md bg-[var(--signal-orange)] px-4 text-xs font-semibold text-[var(--on-signal)] cursor-pointer"
          >
            Save Automation Rule
          </button>
        </form>
      )}

      <div className="space-y-3">
        {rules.map((r) => (
          <div
            key={r.id}
            className="cd-surface rounded-lg p-4 flex flex-wrap items-center justify-between gap-3"
          >
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <TechCode>{r.triggerEvent}</TechCode>
                <span className="font-mono text-xs text-[var(--text-muted)]">&rarr;</span>
                <TechCode>{r.actionType}</TechCode>
              </div>
              <div className="text-sm font-semibold text-[var(--text-primary)]">{r.name}</div>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge tone={r.enabled ? "ok" : "neutral"}>
                {r.enabled ? "ENABLED" : "PAUSED"}
              </StatusBadge>
              {canWrite && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => toggleRule(r.id, !r.enabled)}
                  className="rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 py-1 font-mono text-xs text-[var(--text-primary)] cursor-pointer"
                >
                  {r.enabled ? "Pause" : "Enable"}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ConnectorSecretVaultForm({ canWrite }: { canWrite: boolean }) {
  const router = useRouter();
  const [provider, setProvider] = useState<"SHOPIFY" | "WOOCOMMERCE" | "OUTBOUND_WEBHOOK">(
    "SHOPIFY"
  );
  const [displayName, setDisplayName] = useState("Shopify Storefront HMAC Webhook");
  const [externalDomain, setExternalDomain] = useState("store.myshopify.com");
  const [secretValue, setSecretValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!canWrite) return null;

  async function save(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const res = await fetch("/api/app/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "connector",
          payload: {
            provider,
            displayName,
            externalDomain,
            secretValue: secretValue || undefined,
            config: {},
          },
        }),
      });
      const data = (await res.json()) as {
        connection?: { secretFingerprint?: string | null };
        error?: { message?: string };
      };
      if (!res.ok) {
        setError(data.error?.message ?? "Failed to update connector.");
        setBusy(false);
        return;
      }
      setSecretValue("");
      setNotice(
        `Saved encrypted connector${
          data.connection?.secretFingerprint ? ` (${data.connection.secretFingerprint})` : ""
        }.`
      );
      setBusy(false);
      router.refresh();
    } catch {
      setError("Network error saving connector.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="cd-surface rounded-xl p-5 space-y-3">
      <h2 className="m-0 text-base font-bold text-[var(--text-primary)]">
        Configure Connector &amp; AES-256-GCM Secret Vault
      </h2>
      {error && (
        <AlertBanner tone="danger" title="Connector Error">
          {error}
        </AlertBanner>
      )}
      {notice && (
        <AlertBanner tone="ok" title="Connector Updated">
          {notice}
        </AlertBanner>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <div>
          <label htmlFor="cn-prov" className="block font-mono text-xs uppercase text-[var(--text-muted)] mb-1">
            Provider
          </label>
          <select
            id="cn-prov"
            value={provider}
            onChange={(e) => setProvider(e.target.value as typeof provider)}
            className="h-9 w-full rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 text-xs text-[var(--text-primary)]"
          >
            <option value="SHOPIFY">SHOPIFY</option>
            <option value="WOOCOMMERCE">WOOCOMMERCE</option>
            <option value="OUTBOUND_WEBHOOK">OUTBOUND_WEBHOOK</option>
          </select>
        </div>
        <div>
          <label htmlFor="cn-name" className="block font-mono text-xs uppercase text-[var(--text-muted)] mb-1">
            Label
          </label>
          <input
            id="cn-name"
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="h-9 w-full rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 text-xs text-[var(--text-primary)]"
          />
        </div>
        <div>
          <label htmlFor="cn-dom" className="block font-mono text-xs uppercase text-[var(--text-muted)] mb-1">
            Store Domain / Target URL
          </label>
          <input
            id="cn-dom"
            value={externalDomain}
            onChange={(e) => setExternalDomain(e.target.value)}
            className="h-9 w-full rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 font-mono text-xs text-[var(--text-primary)]"
          />
        </div>
        <div>
          <label htmlFor="cn-sec" className="block font-mono text-xs uppercase text-[var(--text-muted)] mb-1">
            Webhook / API Secret
          </label>
          <input
            id="cn-sec"
            type="password"
            value={secretValue}
            onChange={(e) => setSecretValue(e.target.value)}
            placeholder="Encrypted with AES-256-GCM"
            className="h-9 w-full rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 text-xs text-[var(--text-primary)]"
          />
        </div>
      </div>
      <button
        type="submit"
        disabled={busy}
        className="inline-flex h-9 items-center rounded-md bg-[var(--signal-orange)] px-4 text-xs font-semibold text-[var(--on-signal)] cursor-pointer"
      >
        Encrypt &amp; Save Connector
      </button>
    </form>
  );
}
