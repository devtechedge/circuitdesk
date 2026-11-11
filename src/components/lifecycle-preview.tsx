"use client";

import { useState } from "react";
import { StatusBadge, TechCode } from "./ui/primitives";

const STAGES = [
  {
    step: "01",
    name: "Sale & Serial Lineage",
    badge: "REGISTRY",
    summary:
      "Every unit carries SKU, HSN code, supplier factory batch, and sales channel from CSV import or signed Shopify/WooCommerce webhook.",
    fields: [
      ["SKU / HSN", "KNX-ANC-PRO2 · HSN 85183000"],
      ["Serial / Lot", "KNX-P2-2608-8901 · BATCH-KNX-2026-Q3B"],
      ["Supplier", "Dongguan CellTech Pack Co. (800 units)"],
      ["Channel", "D2C_WEB · Order SHP-IN-10482"],
    ],
  },
  {
    step: "02",
    name: "QR & Dealer Registration",
    badge: "PORTAL",
    summary:
      "Customers scan the box QR at /w/[brand]/register with zero account creation. Online serials activate instantly; offline retail invoices enter human review.",
    fields: [
      ["Portal Route", "/w/kinetix/register?serial=KNX-P2-2608-8901"],
      ["D2C Verified", "ACTIVE · Certificate token SHA-256 hashed"],
      ["Offline Dealer", "PENDING_REVIEW · Operator checks GST invoice"],
      ["DPDP Consent", "Explicit consent + 1095-day retention notice"],
    ],
  },
  {
    step: "03",
    name: "Policy Coverage Engine",
    badge: "RULES",
    summary:
      "Deterministic rules match SKU, region, channel, purchase date, DOA replacement window, and EU Directive 2024/1799 repair extensions.",
    fields: [
      ["Coverage Term", "12 months standard · 7-day DOA window"],
      ["Covered Faults", "DOA, BATTERY, CHARGING, CONNECTIVITY, FIRMWARE"],
      ["Exclusions", "Liquid ingress beyond IPX4, crushed enclosure"],
      ["EU Repair Rule", "+12m statutory extension support when configured"],
    ],
  },
  {
    step: "04",
    name: "Claim & Human Triage",
    badge: "ADJUDICATION",
    summary:
      "Structured fault intake with encrypted private photos, duplicate-serial detection, and optional AI evidence extraction. AI never rejects a claim.",
    fields: [
      ["Fault Taxonomy", "BATTERY · Right earbud drops 100% -> 8% in 18m"],
      ["Risk Signals", "PRIOR_SERIAL_CLAIM: Lot Q3B has 2 battery claims"],
      ["Evidence Vault", "AES-256-GCM encrypted · Expiring HMAC download URL"],
      ["Decision Gate", "Human Support/Ops approves Repair, Replace, Refund, or Decline"],
    ],
  },
  {
    step: "05",
    name: "PIN Routing & Bench QA",
    badge: "REPAIR OPS",
    summary:
      "Routes approved repairs by 6-digit Indian PIN prefix, category skill, and active bench capacity. Consumes spare parts transactionally.",
    fields: [
      ["PIN Match", "PIN 400053 -> BOM-HUB-01 (Mumbai Andheri Bench)"],
      ["Part Consumed", "1x PRT-LIPO-45MAH (INR 320.00 · atomic stock check)"],
      ["Bench QA Gate", "Power-On + Charge + Burn-In + Seal required"],
      ["Live Tracker", "/w/kinetix/track/[secureToken] (revocable)"],
    ],
  },
  {
    step: "06",
    name: "RMA, GST & Batch Analytics",
    badge: "CLOSURE",
    summary:
      "Closes the loop with RTV supplier recovery, E-Waste manifests, CBIC Circular 195/2023 GST registers, and SKU/lot failure-cost analytics.",
    fields: [
      ["OEM Replacement", "INR 0 GST · No ITC reversal (CBIC 195/07/2023-GST)"],
      ["ASC Settlement", "SAC 9987 · 18% CGST/SGST or IGST B2B split"],
      ["RMA Disposition", "REPAIR_RETURN · REFURBISH · SCRAP_EWASTE · RTV"],
      ["Rogue Lot Alert", "Flags supplier batch spikes; human-gated recall draft"],
    ],
  },
] as const;

export function LifecyclePreview() {
  const [activeIdx, setActiveIdx] = useState(0);
  const current = STAGES[activeIdx]!;

  return (
    <div className="cd-surface rounded-xl p-5 sm:p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-mono text-xs uppercase tracking-widest text-[var(--signal-orange)]">
          Connected Post-Sale State Machine
        </span>
        <StatusBadge tone="info">Illustrative Synthetic Trace</StatusBadge>
      </div>

      <div
        role="tablist"
        aria-label="After-sales lifecycle stages"
        className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6"
      >
        {STAGES.map((stage, idx) => {
          const selected = idx === activeIdx;
          return (
            <button
              key={stage.step}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setActiveIdx(idx)}
              className={`rounded-lg border p-3 text-left transition-colors cursor-pointer ${
                selected
                  ? "border-[var(--signal-orange)] bg-[var(--bg-elevated)] text-[var(--text-primary)]"
                  : "border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]"
              }`}
            >
              <div className="font-mono text-[11px] text-[var(--signal-orange)]">
                STEP {stage.step}
              </div>
              <div className="mt-1 text-xs font-semibold leading-snug">{stage.name}</div>
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        className="cd-elevated rounded-lg p-4 sm:p-5 grid grid-cols-1 gap-5 lg:grid-cols-12"
      >
        <div className="lg:col-span-5 space-y-2.5">
          <StatusBadge tone="ok">{current.badge}</StatusBadge>
          <h3 className="m-0 text-lg font-bold text-[var(--text-primary)]">
            {current.step}. {current.name}
          </h3>
          <p className="m-0 text-sm leading-relaxed text-[var(--text-secondary)]">
            {current.summary}
          </p>
        </div>

        <div className="lg:col-span-7 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {current.fields.map(([label, val]) => (
            <div
              key={label}
              className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 space-y-1 min-w-0"
            >
              <div className="font-mono text-[11px] uppercase tracking-wider text-[var(--text-muted)]">
                {label}
              </div>
              <TechCode className="block truncate">{val}</TechCode>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
