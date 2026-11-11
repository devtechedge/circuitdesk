import type { Metadata } from "next";
import { requirePageSession } from "@/auth/page-auth";
import { BillingActionPanel } from "@/components/admin-panels";
import {
  AlertBanner,
  DataTableWrap,
  MetricTile,
  SectionHeader,
  StatusBadge,
  TechCode,
} from "@/components/ui/primitives";
import { formatMoneyMinor } from "@/domain/money";
import { hasPermission } from "@/security/rbac";
import { getBillingOverview } from "@/services/billing";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Billing, Usage & Entitlements",
};

export default async function BillingPage() {
  const session = await requirePageSession("console:read");
  const billing = await getBillingOverview(session);
  const sub = billing.subscription;

  return (
    <div data-testid="billing-page" className="space-y-6">
      <SectionHeader
        eyebrow={`Period ${billing.periodYm} UTC`}
        title="Subscription, Quotas & Billing Rails"
        description="Stripe (USD) and Razorpay (INR) integrations with idempotent webhook verification."
      />

      {(!billing.providers.isLiveChargingAvailable || sub?.isNonChargingDemo) && (
        <AlertBanner tone="warn" title="Non-Charging Demo Billing Mode">
          Live Stripe/Razorpay credentials are not active for this workspace. Plan switches update
          feature entitlements for evaluation with $0 / INR 0 charged, and are strictly excluded
          from recurring MRR accounting.
        </AlertBanner>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricTile
          label="Active Plan"
          value={billing.plan.name}
          unitNote={`Status: ${sub?.status ?? "TRIALING"} · Provider: ${sub?.provider ?? "DEMO"}`}
          badge={<TechCode>{billing.plan.code}</TechCode>}
        />
        <MetricTile
          label="Monthly Rate"
          value={formatMoneyMinor(sub?.monthlyAmountMinor ?? 0, sub?.billingCurrency ?? "INR")}
          unitNote={
            sub?.isNonChargingDemo
              ? "Simulated ($0 charged in demo mode)"
              : "Recurring monthly subscription"
          }
        />
        <MetricTile
          label="Registrations Meter"
          value={`${billing.usage.registrationsCount} / ${billing.plan.limits.registrationsPerMonth}`}
          unitNote={`Period ${billing.periodYm}`}
        />
        <MetricTile
          label="Claims Meter"
          value={`${billing.usage.claimsCount} / ${billing.plan.limits.claimsPerMonth}`}
          unitNote={`AI summaries used: ${billing.usage.aiSummariesCount}`}
        />
      </div>

      <BillingActionPanel
        currentPlan={billing.plan.code}
        currentCurrency={sub?.billingCurrency ?? session.tenantCurrency}
        canManage={hasPermission(session.role, "billing:manage")}
      />

      <section className="space-y-3">
        <h2 className="m-0 text-base font-bold text-[var(--text-primary)]">
          Invoice &amp; Simulation Ledger ({billing.invoices.length})
        </h2>
        <DataTableWrap label="Billing invoices table">
          <table className="w-full min-w-[600px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] font-mono text-xs uppercase text-[var(--text-muted)]">
                <th className="p-3">Invoice ID</th>
                <th className="p-3">Provider</th>
                <th className="p-3">Amount</th>
                <th className="p-3">Mode</th>
                <th className="p-3">Status</th>
                <th className="p-3">Issued</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {billing.invoices.map((inv) => (
                <tr key={inv.id}>
                  <td className="p-3">
                    <TechCode>{inv.externalInvoiceId}</TechCode>
                  </td>
                  <td className="p-3 font-mono text-xs">{inv.provider}</td>
                  <td className="p-3 font-mono text-xs">
                    {formatMoneyMinor(inv.amountMinor, inv.currency)}
                  </td>
                  <td className="p-3 text-xs text-[var(--text-muted)]">
                    {inv.isDemoSimulated ? "Non-Charging Demo" : "Live Charge"}
                  </td>
                  <td className="p-3">
                    <StatusBadge tone={inv.status === "PAID" ? "ok" : "neutral"}>
                      {inv.status}
                    </StatusBadge>
                  </td>
                  <td className="p-3 font-mono text-xs text-[var(--text-muted)]">
                    {inv.issuedAt.toISOString().slice(0, 10)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataTableWrap>
      </section>
    </div>
  );
}
