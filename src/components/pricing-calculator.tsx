"use client";

import Link from "next/link";
import { useState } from "react";
import type { CurrencyCode, PlanCode } from "@/db/schema";
import { formatMoneyMinor } from "@/domain/money";
import {
  estimateMonthlyWithOveragesMinor,
  PLAN_CATALOG,
  TARGET_2K_MRR_SCENARIOS,
} from "@/domain/plans";
import { DataTableWrap, StatusBadge, TechCode } from "./ui/primitives";

const ORDERED_PLANS: PlanCode[] = ["STARTER", "GROWTH", "SCALE", "ENTERPRISE"];

export function PricingCalculator() {
  const [currency, setCurrency] = useState<CurrencyCode>("INR");
  const [selectedPlan, setSelectedPlan] = useState<"STARTER" | "GROWTH" | "SCALE">("GROWTH");
  const [expectedRegistrations, setExpectedRegistrations] = useState(1800);
  const [expectedClaims, setExpectedClaims] = useState(140);

  const estimate = estimateMonthlyWithOveragesMinor({
    planCode: selectedPlan,
    currency,
    expectedRegistrations,
    expectedClaims,
  });

  return (
    <div className="space-y-10">
      {/* Currency Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-4 cd-surface rounded-lg p-4">
        <div className="space-y-0.5">
          <div className="text-sm font-semibold text-[var(--text-primary)]">
            Billing Currency &amp; Regional Rails
          </div>
          <p className="m-0 text-xs text-[var(--text-muted)]">
            INR plans bill via Razorpay (exclusive of 18% Indian GST). USD plans bill via Stripe.
          </p>
        </div>

        <div className="inline-flex rounded-md border border-[var(--border-subtle)] bg-[var(--bg-canvas)] p-1">
          {(["INR", "USD"] as const).map((curr) => (
            <button
              key={curr}
              type="button"
              onClick={() => setCurrency(curr)}
              aria-pressed={currency === curr}
              className={`rounded px-3.5 py-1.5 font-mono text-xs font-semibold cursor-pointer ${
                currency === curr
                  ? "bg-[var(--signal-orange)] text-[var(--on-signal)]"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              {curr === "INR" ? "INR (₹ · India)" : "USD ($ · Global)"}
            </button>
          ))}
        </div>
      </div>

      {/* 4 Plan Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {ORDERED_PLANS.map((code) => {
          const plan = PLAN_CATALOG[code];
          const priceMinor = plan.monthlyMinor[currency];
          const isGrowth = code === "GROWTH";

          return (
            <div
              key={code}
              className={`rounded-xl p-5 flex flex-col justify-between gap-5 ${
                isGrowth
                  ? "border-2 border-[var(--signal-orange)] bg-[var(--bg-elevated)]"
                  : "cd-surface"
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="m-0 text-lg font-bold text-[var(--text-primary)]">{plan.name}</h2>
                  {isGrowth && <StatusBadge tone="warn">Recommended</StatusBadge>}
                </div>

                <div className="font-mono text-3xl font-extrabold text-[var(--text-primary)] tabular-nums">
                  {priceMinor !== null
                    ? formatMoneyMinor(priceMinor, currency, { compactZeroDecimals: true })
                    : "Custom"}
                  {priceMinor !== null && (
                    <span className="text-xs font-normal text-[var(--text-muted)]"> / month</span>
                  )}
                </div>

                <p className="m-0 text-xs text-[var(--text-secondary)] leading-relaxed">
                  {plan.tagline}
                </p>

                <div className="border-t border-[var(--border-subtle)] pt-3 space-y-1.5 text-xs">
                  {plan.features.map((f) => (
                    <div key={f} className="flex items-start gap-2 text-[var(--text-secondary)]">
                      <span className="text-[var(--signal-orange)] font-mono">+</span>
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2 border-t border-[var(--border-subtle)] pt-3">
                {priceMinor !== null ? (
                  <div className="font-mono text-[11px] text-[var(--text-muted)]">
                    Overage:{" "}
                    {formatMoneyMinor(plan.overageMinor.perRegistration[currency], currency)}/reg
                    &middot; {formatMoneyMinor(plan.overageMinor.perClaim[currency], currency)}
                    /claim
                  </div>
                ) : (
                  <div className="font-mono text-[11px] text-[var(--text-muted)]">
                    Committed volume contract
                  </div>
                )}

                <Link
                  href={code === "ENTERPRISE" ? "/contact" : "/signup"}
                  className={`inline-flex h-10 w-full items-center justify-center rounded-md text-xs font-semibold no-underline ${
                    isGrowth
                      ? "bg-[var(--signal-orange)] text-[var(--on-signal)]"
                      : "border border-[var(--border-strong)] bg-[var(--bg-surface)] text-[var(--text-primary)]"
                  }`}
                >
                  {code === "ENTERPRISE" ? "Request custom quote" : `Start ${plan.name} trial`}
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {/* Interactive Volume, Overage & Tax Estimator */}
      <section className="cd-surface rounded-xl p-5 sm:p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="m-0 text-lg font-bold text-[var(--text-primary)]">
              Monthly Usage, Overage &amp; Tax Estimator
            </h2>
            <p className="m-0 text-xs text-[var(--text-muted)]">
              Model monthly registration and warranty claim volume with zero hidden fees.
            </p>
          </div>
          <StatusBadge tone="info">Deterministic Calculator</StatusBadge>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="lg:col-span-7 space-y-4">
            <div>
              <label
                htmlFor="calc-plan"
                className="block font-mono text-xs uppercase text-[var(--text-muted)] mb-1.5"
              >
                Select Plan Tier
              </label>
              <select
                id="calc-plan"
                value={selectedPlan}
                onChange={(e) =>
                  setSelectedPlan(e.target.value as "STARTER" | "GROWTH" | "SCALE")
                }
                className="h-10 w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--text-primary)]"
              >
                <option value="STARTER">Starter</option>
                <option value="GROWTH">Growth</option>
                <option value="SCALE">Scale</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="calc-regs"
                className="flex justify-between font-mono text-xs text-[var(--text-secondary)] mb-1"
              >
                <span>Monthly Warranty Registrations</span>
                <span>{expectedRegistrations.toLocaleString()} / month</span>
              </label>
              <input
                id="calc-regs"
                type="range"
                min={100}
                max={12000}
                step={100}
                value={expectedRegistrations}
                onChange={(e) => setExpectedRegistrations(Number(e.target.value))}
                className="w-full accent-[var(--signal-orange)]"
              />
            </div>

            <div>
              <label
                htmlFor="calc-claims"
                className="flex justify-between font-mono text-xs text-[var(--text-secondary)] mb-1"
              >
                <span>Monthly Warranty Claims</span>
                <span>{expectedClaims.toLocaleString()} / month</span>
              </label>
              <input
                id="calc-claims"
                type="range"
                min={10}
                max={2000}
                step={10}
                value={expectedClaims}
                onChange={(e) => setExpectedClaims(Number(e.target.value))}
                className="w-full accent-[var(--signal-cobalt)]"
              />
            </div>
          </div>

          <div className="lg:col-span-5 cd-elevated rounded-lg p-4 space-y-2.5 text-sm">
            <div className="flex justify-between">
              <span className="text-[var(--text-secondary)]">Base recurring plan</span>
              <span className="font-mono">{formatMoneyMinor(estimate.baseMinor, currency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-secondary)]">Registration overages</span>
              <span className="font-mono">
                {formatMoneyMinor(estimate.regOverageMinor, currency)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-secondary)]">Claim overages</span>
              <span className="font-mono">
                {formatMoneyMinor(estimate.claimOverageMinor, currency)}
              </span>
            </div>
            {currency === "INR" && (
              <div className="flex justify-between text-xs text-[var(--text-muted)]">
                <span>18% Indian GST (B2B SaaS ITC eligible)</span>
                <span className="font-mono">
                  {formatMoneyMinor(estimate.indianGst18Minor, currency)}
                </span>
              </div>
            )}
            <div className="border-t border-[var(--border-subtle)] pt-2.5 flex justify-between font-bold text-[var(--text-primary)]">
              <span>Estimated monthly total</span>
              <span className="font-mono text-lg">
                {formatMoneyMinor(estimate.totalWithGstMinor, currency)}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Transparent $2K MRR Unit Economics */}
      <section className="space-y-3">
        <div className="space-y-1">
          <h2 className="m-0 text-lg font-bold text-[var(--text-primary)]">
            Transparent SaaS Unit Economics ($2,000 MRR Target Math)
          </h2>
          <p className="m-0 text-xs text-[var(--text-muted)]">
            Target cohort math for recurring paid subscriptions only (excluding free trials, demo
            workspaces, setup fees, and variable overages). Published for operational transparency,
            not as a revenue forecast or claim of live subscribers.
          </p>
        </div>

        <DataTableWrap label="Target $2,000 MRR unit economics table">
          <table className="w-full min-w-[600px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] font-mono text-xs uppercase text-[var(--text-muted)]">
                <th className="p-3">Cohort Model</th>
                <th className="p-3">Paid Plan Mix</th>
                <th className="p-3">Recurring MRR</th>
                <th className="p-3">Target Buyer Profile</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {TARGET_2K_MRR_SCENARIOS.map((sc) => (
                <tr key={sc.name}>
                  <td className="p-3 font-medium text-[var(--text-primary)]">{sc.name}</td>
                  <td className="p-3">
                    <TechCode>{sc.composition}</TechCode>
                  </td>
                  <td className="p-3 font-mono font-bold text-[var(--signal-orange)]">
                    ${sc.mrrUsd.toLocaleString()}/mo
                  </td>
                  <td className="p-3 text-xs text-[var(--text-secondary)]">{sc.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataTableWrap>
      </section>
    </div>
  );
}
