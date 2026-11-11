import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiSession } from "@/auth/session";
import { withTenantDb } from "@/db/tenant";
import { apiKeys, brands, recallCampaigns, subscriptions, tenants } from "@/db/schema";
import { PLAN_CATALOG } from "@/domain/plans";
import { AppError, jsonErrorResponse } from "@/lib/errors";
import { createTenantApiKey } from "@/security/api-keys";
import { extractClientIpHash } from "@/security/rate-limit";
import { recordAuditLog } from "@/services/audit";
import {
  approveRecallCampaign,
  createRecallDraft,
  eraseDataPrincipalPii,
  exportDataPrincipalRecord,
} from "@/services/privacy";

const settingsMutationSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("create_api_key"),
    name: z.string().trim().min(2).max(80),
    scopes: z.array(z.enum(["serials:read", "claims:read"])).min(1),
  }),
  z.object({
    kind: z.literal("revoke_api_key"),
    keyId: z.string().uuid(),
  }),
  z.object({
    kind: z.literal("dpdp_export"),
    customerEmail: z.string().trim().email(),
  }),
  z.object({
    kind: z.literal("dpdp_erase"),
    customerEmail: z.string().trim().email(),
    confirmPhrase: z.literal("ERASE PII"),
  }),
  z.object({
    kind: z.literal("create_recall"),
    batchId: z.string().uuid(),
    title: z.string().trim().min(4).max(140),
    reason: z.string().trim().min(8).max(500),
  }),
  z.object({
    kind: z.literal("approve_recall"),
    campaignId: z.string().uuid(),
  }),
  z.object({
    kind: z.literal("portal_branding"),
    brandId: z.string().uuid(),
    hideCircuitdeskBadge: z.boolean(),
  }),
]);

export async function GET(request: Request) {
  try {
    const session = await requireApiSession(request, "console:read");
    const data = await withTenantDb(session.tenantId, async (tx) => {
      const [tenant] = await tx
        .select()
        .from(tenants)
        .where(eq(tenants.id, session.tenantId))
        .limit(1);

      const keys = await tx
        .select({
          id: apiKeys.id,
          name: apiKeys.name,
          keyPrefix: apiKeys.keyPrefix,
          scopes: apiKeys.scopes,
          lastUsedAt: apiKeys.lastUsedAt,
          revokedAt: apiKeys.revokedAt,
          createdAt: apiKeys.createdAt,
        })
        .from(apiKeys)
        .where(eq(apiKeys.tenantId, session.tenantId))
        .orderBy(desc(apiKeys.createdAt));

      const recalls = await tx
        .select()
        .from(recallCampaigns)
        .where(eq(recallCampaigns.tenantId, session.tenantId))
        .orderBy(desc(recallCampaigns.createdAt));

      return { tenant: tenant ?? null, apiKeys: keys, recalls };
    });

    return NextResponse.json(data);
  } catch (error) {
    return jsonErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = settingsMutationSchema.parse(await request.json());
    const ipHash = extractClientIpHash(request);

    if (body.kind === "create_api_key") {
      const session = await requireApiSession(request, "settings:write");
      const created = await createTenantApiKey({
        tenantId: session.tenantId,
        name: body.name,
        scopes: body.scopes,
        createdByUserId: session.userId,
      });
      await recordAuditLog({
        tenantId: session.tenantId,
        actorUserId: session.userId,
        actorRole: session.role,
        action: "API_KEY_CREATED",
        entityType: "API_KEY",
        entityId: created.id,
        ipHash,
        summary: `Created SHA-256 hashed API key "${body.name}" (${created.keyPrefix}...).`,
      });
      revalidatePath("/app/settings");
      return NextResponse.json({ ok: true, ...created }, { status: 201 });
    }

    if (body.kind === "revoke_api_key") {
      const session = await requireApiSession(request, "settings:write");
      await withTenantDb(session.tenantId, async (tx) => {
        await tx
          .update(apiKeys)
          .set({ revokedAt: new Date() })
          .where(and(eq(apiKeys.id, body.keyId), eq(apiKeys.tenantId, session.tenantId)));
      });
      revalidatePath("/app/settings");
      return NextResponse.json({ ok: true });
    }

    if (body.kind === "dpdp_export") {
      const session = await requireApiSession(request, "privacy:execute");
      const dossier = await exportDataPrincipalRecord({
        session,
        customerEmail: body.customerEmail,
        ipHash,
      });
      return NextResponse.json({ ok: true, dossier });
    }

    if (body.kind === "dpdp_erase") {
      const session = await requireApiSession(request, "privacy:execute");
      const erased = await eraseDataPrincipalPii({
        session,
        customerEmail: body.customerEmail,
        ipHash,
      });
      revalidatePath("/app/registrations");
      revalidatePath("/app/claims");
      revalidatePath("/app/settings");
      return NextResponse.json({ ok: true, ...erased });
    }

    if (body.kind === "create_recall") {
      const session = await requireApiSession(request, "catalog:write");
      const recall = await createRecallDraft({
        session,
        batchId: body.batchId,
        title: body.title,
        reason: body.reason,
        ipHash,
      });
      revalidatePath("/app/settings");
      return NextResponse.json({ ok: true, recall }, { status: 201 });
    }

    if (body.kind === "approve_recall") {
      const session = await requireApiSession(request, "recall:approve");
      const recall = await approveRecallCampaign({
        session,
        campaignId: body.campaignId,
        ipHash,
      });
      revalidatePath("/app/settings");
      return NextResponse.json({ ok: true, recall });
    }

    // portal_branding
    const session = await requireApiSession(request, "settings:write");
    await withTenantDb(session.tenantId, async (tx) => {
      if (body.hideCircuitdeskBadge) {
        const [sub] = await tx
          .select({ planCode: subscriptions.planCode })
          .from(subscriptions)
          .where(eq(subscriptions.tenantId, session.tenantId))
          .limit(1);
        const allowed = PLAN_CATALOG[sub?.planCode ?? "STARTER"].entitlements.customPortalBranding;
        if (!allowed) {
          throw new AppError(
            403,
            "SCALE_PLAN_REQUIRED",
            "Removing the discreet portal referral badge requires Scale or Enterprise plan."
          );
        }
      }
      await tx
        .update(brands)
        .set({ hideCircuitdeskBadge: body.hideCircuitdeskBadge })
        .where(and(eq(brands.id, body.brandId), eq(brands.tenantId, session.tenantId)));
    });
    revalidatePath("/app/settings");
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonErrorResponse(error);
  }
}
