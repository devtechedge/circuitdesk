"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ProductCategory } from "@/db/schema";
import { DEMO_CONSTANTS } from "@/demo/ids";
import {
  routeServiceCentreByPinAndSkill,
  type ServiceCentreCandidate,
} from "@/domain/pin-routing";
import { AlertBanner, StatusBadge, TechCode } from "./ui/primitives";

const DEMO_CENTRES: ServiceCentreCandidate[] = [
  {
    id: "1",
    name: "Mumbai Andheri Central Bench",
    code: "BOM-HUB-01",
    city: "Mumbai",
    pinPrefixes: ["400", "401", "411", "421"],
    supportedCategories: ["AUDIO", "WEARABLE", "CHARGING_ACCESSORY", "SMART_APPLIANCE"],
    centreType: "OWNED_BENCH",
    maxActiveRepairs: 50,
    activeRepairsCount: 8,
    active: true,
  },
  {
    id: "2",
    name: "ElectroFix Authorised Care - Koramangala",
    code: "BLR-ASC-02",
    city: "Bengaluru",
    pinPrefixes: ["560", "562", "570"],
    supportedCategories: ["AUDIO", "WEARABLE", "CHARGING_ACCESSORY"],
    centreType: "AUTHORISED_PARTNER",
    maxActiveRepairs: 35,
    activeRepairsCount: 11,
    active: true,
  },
  {
    id: "3",
    name: "NorthStar MicroTech ASC - Okhla Phase II",
    code: "DEL-ASC-03",
    city: "New Delhi",
    pinPrefixes: ["110", "122", "201"],
    supportedCategories: ["AUDIO", "WEARABLE", "SMART_APPLIANCE"],
    centreType: "AUTHORISED_PARTNER",
    maxActiveRepairs: 40,
    activeRepairsCount: 14,
    active: true,
  },
  {
    id: "4",
    name: "SouthWave Device Bench - Guindy",
    code: "MAA-ASC-04",
    city: "Chennai",
    pinPrefixes: ["600", "603", "641"],
    supportedCategories: ["CHARGING_ACCESSORY", "SMART_APPLIANCE", "AUDIO"],
    centreType: "AUTHORISED_PARTNER",
    maxActiveRepairs: 30,
    activeRepairsCount: 5,
    active: true,
  },
];

const PERSONAS = [
  { role: "OWNER", label: "Owner (Full Ops + Billing + Recall Gate)", email: "ops@kinetix-audio.demo" },
  { role: "SUPPORT", label: "Support Lead (Claims Triage + Receipt Review)", email: "support@kinetix-audio.demo" },
  { role: "TECHNICIAN", label: "Bench Technician (Mumbai BOM-HUB-01 Scoped)", email: "tech@kinetix-audio.demo" },
  { role: "ANALYST", label: "Analyst (Masked Serials + Batch Cost + GST CSV)", email: "analyst@kinetix-audio.demo" },
  { role: "READ_ONLY", label: "Read-Only Auditor (Zero Mutation Access)", email: "viewer@kinetix-audio.demo" },
] as const;

export function InteractiveSandbox() {
  const router = useRouter();
  const [pinCode, setPinCode] = useState("560034");
  const [category, setCategory] = useState<ProductCategory>("WEARABLE");
  const [loadingRole, setLoadingRole] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const routing = routeServiceCentreByPinAndSkill({
    centres: DEMO_CENTRES,
    customerPinCode: pinCode,
    productCategory: category,
  });

  async function launchDemoPersona(persona: (typeof PERSONAS)[number]["role"]) {
    setErrorMsg(null);
    setLoadingRole(persona);
    try {
      const res = await fetch("/api/auth/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ persona, next: "/app" }),
      });
      const data = (await res.json()) as { redirectTo?: string; error?: { message?: string } };
      if (!res.ok) {
        setErrorMsg(data.error?.message ?? "Demo sign-in failed.");
        setLoadingRole(null);
        return;
      }
      router.push(data.redirectTo ?? "/app");
      router.refresh();
    } catch {
      setErrorMsg("Network error while creating synthetic demo session.");
      setLoadingRole(null);
    }
  }

  return (
    <div className="space-y-8">
      <AlertBanner tone="info" title="Synthetic Demonstration Environment">
        All organizations, serials, GSTINs, invoices, and claims in Kinetix Audio are synthetic
        illustrative fixtures. No real customer PII is stored here.
      </AlertBanner>

      {errorMsg && (
        <AlertBanner tone="danger" title="Demo Sign-In Error">
          {errorMsg}
        </AlertBanner>
      )}

      {/* 1. One-click RBAC persona launcher */}
      <section className="cd-surface rounded-xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="m-0 text-lg font-bold text-[var(--text-primary)]">
              1. Enter the Operator Console as Any RBAC Role
            </h2>
            <p className="m-0 text-xs text-[var(--text-muted)]">
              Compare how Support, Bench Technicians, Analysts, and Read-Only auditors see the same tenant.
            </p>
          </div>
          <StatusBadge tone="ok">Real DB Session</StatusBadge>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {PERSONAS.map((p) => (
            <button
              key={p.role}
              type="button"
              disabled={loadingRole !== null}
              onClick={() => launchDemoPersona(p.role)}
              data-testid={`demo-persona-${p.role.toLowerCase()}`}
              className="cd-elevated rounded-lg p-4 text-left space-y-2 hover:border-[var(--signal-orange)] transition-colors cursor-pointer disabled:opacity-60"
            >
              <div className="flex items-center justify-between gap-2">
                <TechCode>{p.role}</TechCode>
                <span className="font-mono text-xs text-[var(--signal-orange)]">
                  {loadingRole === p.role ? "Signing in..." : "Open ->"}
                </span>
              </div>
              <div className="text-sm font-semibold text-[var(--text-primary)]">{p.label}</div>
              <div className="font-mono text-xs text-[var(--text-muted)]">{p.email}</div>
            </button>
          ))}
        </div>
      </section>

      {/* 2. Customer Portal Live Surfaces */}
      <section className="cd-surface rounded-xl p-5 sm:p-6 space-y-4">
        <h2 className="m-0 text-lg font-bold text-[var(--text-primary)]">
          2. Test the Zero-Account Customer &amp; Dealer Portal (/w/kinetix)
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Link
            href={`/w/kinetix/register?serial=${DEMO_CONSTANTS.UNCLAIMED_SERIAL}&sku=KNX-ANC-PRO2&source=qr`}
            className="cd-elevated rounded-lg p-4 space-y-1.5 hover:border-[var(--signal-cobalt)] no-underline"
          >
            <TechCode>QR REGISTRATION</TechCode>
            <div className="text-sm font-bold text-[var(--text-primary)]">
              Register Serial {DEMO_CONSTANTS.UNCLAIMED_SERIAL}
            </div>
            <p className="m-0 text-xs text-[var(--text-secondary)]">
              Simulates scanning an in-box QR code with instant coverage calculation.
            </p>
          </Link>

          <Link
            href={`/w/kinetix/certificate/${DEMO_CONSTANTS.ACTIVE_CERT_TOKEN}`}
            className="cd-elevated rounded-lg p-4 space-y-1.5 hover:border-[var(--signal-cobalt)] no-underline"
          >
            <TechCode>DIGITAL CERTIFICATE</TechCode>
            <div className="text-sm font-bold text-[var(--text-primary)]">
              Open Printable Warranty Certificate
            </div>
            <p className="m-0 text-xs text-[var(--text-secondary)]">
              Scoped, revocable SHA-256 certificate token with masked serial.
            </p>
          </Link>

          <Link
            href={`/w/kinetix/track/${DEMO_CONSTANTS.ACTIVE_TRACK_TOKEN}`}
            className="cd-elevated rounded-lg p-4 space-y-1.5 hover:border-[var(--signal-cobalt)] no-underline"
          >
            <TechCode>LIVE REPAIR TRACKER</TechCode>
            <div className="text-sm font-bold text-[var(--text-primary)]">
              Track Bench Job JOB-BOM-2026-0041
            </div>
            <p className="m-0 text-xs text-[var(--text-secondary)]">
              Customer view of repair stage, SLA clock, and timeline events.
            </p>
          </Link>
        </div>
      </section>

      {/* 3. Live PIN-Code & Skill Router Simulator */}
      <section className="cd-surface rounded-xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="m-0 text-lg font-bold text-[var(--text-primary)]">
              3. Interactive Indian PIN-Zone &amp; Skill Routing Engine
            </h2>
            <p className="m-0 text-xs text-[var(--text-muted)]">
              Try PINs across Mumbai (400053), Bengaluru (560034), Delhi (110020), Chennai (600032), or Kolkata (700091).
            </p>
          </div>
          <StatusBadge tone="info">Live Domain Engine</StatusBadge>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
          <div className="md:col-span-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor="sim-pin"
                className="block font-mono text-xs uppercase text-[var(--text-muted)] mb-1"
              >
                Customer 6-Digit PIN
              </label>
              <input
                id="sim-pin"
                type="text"
                value={pinCode}
                onChange={(e) => setPinCode(e.target.value)}
                maxLength={10}
                className="h-10 w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 font-mono text-sm text-[var(--text-primary)]"
              />
            </div>

            <div>
              <label
                htmlFor="sim-cat"
                className="block font-mono text-xs uppercase text-[var(--text-muted)] mb-1"
              >
                Hardware Category
              </label>
              <select
                id="sim-cat"
                value={category}
                onChange={(e) => setCategory(e.target.value as ProductCategory)}
                className="h-10 w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--text-primary)]"
              >
                <option value="AUDIO">AUDIO</option>
                <option value="WEARABLE">WEARABLE</option>
                <option value="CHARGING_ACCESSORY">CHARGING_ACCESSORY</option>
                <option value="SMART_APPLIANCE">SMART_APPLIANCE</option>
              </select>
            </div>
          </div>

          <div className="md:col-span-7 cd-elevated rounded-lg p-4 space-y-2">
            <div className="text-xs font-mono uppercase text-[var(--text-muted)]">
              Selected Service Bench
            </div>
            {routing.selected ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-base font-bold text-[var(--text-primary)]">
                    {routing.selected.name}
                  </span>
                  <TechCode>{routing.selected.code}</TechCode>
                  <StatusBadge tone="ok">{routing.selected.centreType}</StatusBadge>
                </div>
                <p className="m-0 text-xs text-[var(--text-secondary)]">{routing.routingReason}</p>
              </>
            ) : (
              <p className="m-0 text-sm text-[var(--status-danger-fg)]">{routing.routingReason}</p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
