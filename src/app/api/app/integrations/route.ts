import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiSession } from "@/auth/session";
import { jsonErrorResponse } from "@/lib/errors";
import { extractClientIpHash } from "@/security/rate-limit";
import {
  createAutomationRule,
  createAutomationRuleSchema,
  listAutomationRules,
  toggleAutomationRule,
} from "@/services/automations";
import {
  listTenantIntegrations,
  upsertIntegrationSchema,
  upsertTenantIntegration,
} from "@/services/integrations";

const integrationActionSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("connector"), payload: upsertIntegrationSchema }),
  z.object({ kind: z.literal("rule"), payload: createAutomationRuleSchema }),
  z.object({ kind: z.literal("toggle_rule"), ruleId: z.string().uuid(), enabled: z.boolean() }),
]);

export async function GET(request: Request) {
  try {
    const session = await requireApiSession(request, "console:read");
    const [integrations, rules] = await Promise.all([
      listTenantIntegrations(session),
      listAutomationRules(session),
    ]);
    return NextResponse.json({ ...integrations, rules });
  } catch (error) {
    return jsonErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = integrationActionSchema.parse(await request.json());
    const ipHash = extractClientIpHash(request);

    if (body.kind === "connector") {
      const session = await requireApiSession(request, "integrations:write");
      const saved = await upsertTenantIntegration(session, body.payload, ipHash);
      revalidatePath("/app/integrations");
      return NextResponse.json({ ok: true, connection: saved });
    }

    const session = await requireApiSession(request, "automations:write");
    if (body.kind === "rule") {
      const rule = await createAutomationRule(session, body.payload, ipHash);
      revalidatePath("/app/automations");
      return NextResponse.json({ ok: true, rule }, { status: 201 });
    }

    const updated = await toggleAutomationRule(session, {
      ruleId: body.ruleId,
      enabled: body.enabled,
      ipHash,
    });
    revalidatePath("/app/automations");
    return NextResponse.json({ ok: true, rule: updated });
  } catch (error) {
    return jsonErrorResponse(error);
  }
}
