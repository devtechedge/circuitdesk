import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import type { AuthenticatedSession } from "@/auth/session";
import type { Database } from "@/db/client";
import { withTenantDb } from "@/db/tenant";
import { AUTOMATION_ACTIONS, automationRules } from "@/db/schema";
import { AppError } from "@/lib/errors";
import { assertPermission } from "@/security/rbac";
import { recordAuditLog } from "./audit";

export const createAutomationRuleSchema = z.object({
  name: z.string().trim().min(4).max(140),
  triggerEvent: z.enum([
    "CLAIM_SUBMITTED",
    "REPAIR_DISPATCHED",
    "SLA_75_PERCENT",
    "BATCH_SPIKE",
  ]),
  conditionJson: z.record(z.string(), z.unknown()).default({}),
  // Strictly non-rejecting actions; claims can never be auto-declined by automation
  actionType: z.enum(AUTOMATION_ACTIONS),
  actionConfig: z.record(z.string(), z.unknown()).default({}),
});

export async function listAutomationRules(
  session: AuthenticatedSession,
  dbOverride?: Database
) {
  return withTenantDb(
    session.tenantId,
    async (tx) =>
      tx
        .select()
        .from(automationRules)
        .where(eq(automationRules.tenantId, session.tenantId))
        .orderBy(desc(automationRules.createdAt)),
    dbOverride
  );
}

export async function createAutomationRule(
  session: AuthenticatedSession,
  input: z.infer<typeof createAutomationRuleSchema>,
  ipHash?: string,
  dbOverride?: Database
) {
  assertPermission(session.role, "automations:write");
  const parsed = createAutomationRuleSchema.parse(input);

  return withTenantDb(
    session.tenantId,
    async (tx) => {
      const [created] = await tx
        .insert(automationRules)
        .values({
          tenantId: session.tenantId,
          name: parsed.name,
          triggerEvent: parsed.triggerEvent,
          conditionJson: parsed.conditionJson,
          actionType: parsed.actionType,
          actionConfig: parsed.actionConfig,
          enabled: true,
        })
        .returning();

      await recordAuditLog(
        {
          tenantId: session.tenantId,
          actorUserId: session.userId,
          actorRole: session.role,
          action: "AUTOMATION_RULE_CREATED",
          entityType: "AUTOMATION_RULE",
          entityId: created!.id,
          ipHash,
          summary: `Created workflow rule "${created!.name}" (${created!.triggerEvent} -> ${created!.actionType}).`,
        },
        tx
      );

      return created!;
    },
    dbOverride
  );
}

export async function toggleAutomationRule(
  session: AuthenticatedSession,
  params: { ruleId: string; enabled: boolean; ipHash?: string },
  dbOverride?: Database
) {
  assertPermission(session.role, "automations:write");

  return withTenantDb(
    session.tenantId,
    async (tx) => {
      const [updated] = await tx
        .update(automationRules)
        .set({ enabled: params.enabled })
        .where(
          and(
            eq(automationRules.id, params.ruleId),
            eq(automationRules.tenantId, session.tenantId)
          )
        )
        .returning();

      if (!updated) {
        throw new AppError(404, "RULE_NOT_FOUND", "Automation rule not found.");
      }

      await recordAuditLog(
        {
          tenantId: session.tenantId,
          actorUserId: session.userId,
          actorRole: session.role,
          action: "AUTOMATION_RULE_TOGGLED",
          entityType: "AUTOMATION_RULE",
          entityId: updated.id,
          ipHash: params.ipHash,
          summary: `${params.enabled ? "Enabled" : "Disabled"} workflow rule "${updated.name}".`,
        },
        tx
      );

      return updated;
    },
    dbOverride
  );
}
