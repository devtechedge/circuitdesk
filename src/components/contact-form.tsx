"use client";

import { type FormEvent, useState } from "react";
import { AlertBanner } from "./ui/primitives";

export function ContactForm() {
  const [kind, setKind] = useState<"DEMO_REQUEST" | "CONTACT" | "MIGRATION_HELP">("DEMO_REQUEST");
  const [name, setName] = useState("");
  const [workEmail, setWorkEmail] = useState("");
  const [company, setCompany] = useState("");
  const [monthlyUnitsBand, setMonthlyUnitsBand] = useState("2,500 - 10,000 units/mo");
  const [channels, setChannels] = useState("Shopify + Amazon India + Offline Dealers");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          name,
          workEmail,
          company,
          monthlyUnitsBand,
          channels,
          message,
        }),
      });
      const data = (await res.json()) as { leadId?: string; error?: { message?: string } };
      if (!res.ok) {
        setError(data.error?.message ?? "Submission failed.");
        setSubmitting(false);
        return;
      }
      setSubmittedId(data.leadId ?? "recorded");
      setSubmitting(false);
    } catch {
      setError("Network error submitting inquiry.");
      setSubmitting(false);
    }
  }

  if (submittedId) {
    return (
      <AlertBanner tone="ok" title="Inquiry Recorded">
        Thank you, {name}. Reference ID: <code className="font-mono">{submittedId}</code>. Meanwhile,
        you can explore the synthetic workspace immediately on /demo.
      </AlertBanner>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="cd-surface rounded-xl p-5 sm:p-6 space-y-4">
      {error && (
        <AlertBanner tone="danger" title="Validation Error">
          {error}
        </AlertBanner>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="lead-kind" className="block font-mono text-xs uppercase text-[var(--text-muted)] mb-1">
            Inquiry Type
          </label>
          <select
            id="lead-kind"
            value={kind}
            onChange={(e) => setKind(e.target.value as typeof kind)}
            className="h-10 w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--text-primary)]"
          >
            <option value="DEMO_REQUEST">Architecture Walkthrough / Enterprise Quote</option>
            <option value="MIGRATION_HELP">Spreadsheet / Legacy Warranty Migration</option>
            <option value="CONTACT">General Question</option>
          </select>
        </div>

        <div>
          <label htmlFor="lead-band" className="block font-mono text-xs uppercase text-[var(--text-muted)] mb-1">
            Monthly Hardware Units Shipped
          </label>
          <select
            id="lead-band"
            value={monthlyUnitsBand}
            onChange={(e) => setMonthlyUnitsBand(e.target.value)}
            className="h-10 w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--text-primary)]"
          >
            <option value="500 - 2,500 units/mo">500 - 2,500 units/mo</option>
            <option value="2,500 - 10,000 units/mo">2,500 - 10,000 units/mo</option>
            <option value="10,000 - 50,000 units/mo">10,000 - 50,000 units/mo</option>
            <option value="50,000+ units/mo (Enterprise)">50,000+ units/mo (Enterprise)</option>
          </select>
        </div>

        <div>
          <label htmlFor="lead-name" className="block font-mono text-xs uppercase text-[var(--text-muted)] mb-1">
            Your Name
          </label>
          <input
            id="lead-name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-10 w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--text-primary)]"
          />
        </div>

        <div>
          <label htmlFor="lead-email" className="block font-mono text-xs uppercase text-[var(--text-muted)] mb-1">
            Work Email
          </label>
          <input
            id="lead-email"
            type="email"
            required
            value={workEmail}
            onChange={(e) => setWorkEmail(e.target.value)}
            className="h-10 w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--text-primary)]"
          />
        </div>

        <div>
          <label htmlFor="lead-company" className="block font-mono text-xs uppercase text-[var(--text-muted)] mb-1">
            Brand / Company Name
          </label>
          <input
            id="lead-company"
            required
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            className="h-10 w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--text-primary)]"
          />
        </div>

        <div>
          <label htmlFor="lead-channels" className="block font-mono text-xs uppercase text-[var(--text-muted)] mb-1">
            Sales Channels
          </label>
          <input
            id="lead-channels"
            required
            value={channels}
            onChange={(e) => setChannels(e.target.value)}
            className="h-10 w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--text-primary)]"
          />
        </div>
      </div>

      <div>
        <label htmlFor="lead-msg" className="block font-mono text-xs uppercase text-[var(--text-muted)] mb-1">
          Current Warranty &amp; Repair Setup
        </label>
        <textarea
          id="lead-msg"
          rows={4}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Tell us your SKU count, service centre locations, or legacy CSV format..."
          className="w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3 text-sm text-[var(--text-primary)]"
        />
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="inline-flex h-10 items-center rounded-md bg-[var(--signal-orange)] px-5 text-xs font-semibold text-[var(--on-signal)] cursor-pointer disabled:opacity-60"
      >
        {submitting ? "Saving..." : "Submit Inquiry"}
      </button>
    </form>
  );
}
