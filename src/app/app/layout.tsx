import type { ReactNode } from "react";
import { requirePageSession } from "@/auth/page-auth";
import { AppShell } from "@/components/app-shell";
import { getBillingOverview } from "@/services/billing";

export const dynamic = "force-dynamic";

export default async function ConsoleLayout({ children }: { children: ReactNode }) {
  const session = await requirePageSession("console:read");
  const billing = await getBillingOverview(session);

  return (
    <AppShell
      tenantName={session.tenantName}
      isDemoTenant={session.isDemoTenant}
      userFullName={session.fullName}
      role={session.role}
      planName={billing.plan.name}
      regUsed={billing.usage.registrationsCount}
      regLimit={billing.plan.limits.registrationsPerMonth}
      claimUsed={billing.usage.claimsCount}
      claimLimit={billing.plan.limits.claimsPerMonth}
    >
      {children}
    </AppShell>
  );
}
