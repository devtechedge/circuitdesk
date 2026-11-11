import type { Metadata } from "next";
import { requirePageSession } from "@/auth/page-auth";
import { AutomationRuleCreator } from "@/components/ops-panels";
import { SectionHeader } from "@/components/ui/primitives";
import { hasPermission } from "@/security/rbac";
import { listAutomationRules } from "@/services/automations";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Workflow Automations",
};

export default async function AutomationsPage() {
  const session = await requirePageSession("console:read");
  const rules = await listAutomationRules(session);

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Deterministic Event Rules"
        title="Workflow Automations"
        description="Automate DOA priority tagging, SLA risk escalations, and dispatch notifications without ever auto-denying a customer claim."
      />
      <AutomationRuleCreator
        rules={rules}
        canWrite={hasPermission(session.role, "automations:write")}
      />
    </div>
  );
}
