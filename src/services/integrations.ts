import { and, eq } from "drizzle-orm";
import { z } from "zod";
import type { AuthenticatedSession } from "@/auth/session";
import { getEnv, getProviderCapabilities } from "@/env";
import { getDb, type Database } from "@/db/client";
import { withTenantDb } from "@/db/tenant";
import {
  integrationConnections,
  products,
  serialUnits,
  tenants,
} from "@/db/schema";
import { AppError } from "@/lib/errors";
import { decryptSecret, encryptSecret } from "@/security/encryption";
import { assertPermission } from "@/security/rbac";
import { maskSerialNumber } from "@/security/serial-mask";
import { claimIdempotentWebhookEvent, verifyBase64HmacSignature } from "@/security/webhooks";
import { recordAuditLog } from "./audit";

export const upsertIntegrationSchema = z.object({
  provider: z.enum([
    "SHOPIFY",
    "WOOCOMMERCE",
    "MARKETPLACE_CSV",
    "WHATSAPP",
    "EMAIL",
    "OUTBOUND_WEBHOOK",
  ]),
  displayName: z.string().trim().min(3).max(120),
  externalDomain: z.string().trim().max(160).optional(),
  secretValue: z.string().trim().max(500).optional(),
  config: z.record(z.string(), z.unknown()).default({}),
});

export async function listTenantIntegrations(
  session: AuthenticatedSession,
  dbOverride?: Database
) {
  const caps = getProviderCapabilities();
  return withTenantDb(
    session.tenantId,
    async (tx) => {
      const rows = await tx
        .select({
          id: integrationConnections.id,
          provider: integrationConnections.provider,
          status: integrationConnections.status,
          displayName: integrationConnections.displayName,
          externalDomain: integrationConnections.externalDomain,
          secretFingerprint: integrationConnections.secretFingerprint,
          hasEncryptedSecret: integrationConnections.encryptedSecret,
          config: integrationConnections.config,
          lastSyncedAt: integrationConnections.lastSyncedAt,
          createdAt: integrationConnections.createdAt,
        })
        .from(integrationConnections)
        .where(eq(integrationConnections.tenantId, session.tenantId));

      return {
        capabilities: caps,
        connections: rows.map((r) => ({
          id: r.id,
          provider: r.provider,
          status: r.status,
          displayName: r.displayName,
          externalDomain: r.externalDomain,
          secretFingerprint: r.secretFingerprint,
          hasSecretConfigured: Boolean(r.hasEncryptedSecret),
          config: r.config,
          lastSyncedAt: r.lastSyncedAt,
        })),
      };
    },
    dbOverride
  );
}

export async function upsertTenantIntegration(
  session: AuthenticatedSession,
  input: z.infer<typeof upsertIntegrationSchema>,
  ipHash?: string,
  dbOverride?: Database
) {
  assertPermission(session.role, "integrations:write");
  const parsed = upsertIntegrationSchema.parse(input);
  const caps = getProviderCapabilities();

  const encrypted = parsed.secretValue ? encryptSecret(parsed.secretValue) : null;

  let status: "CONNECTED" | "DISCONNECTED" | "DEV_SINK" | "PENDING_APP_REVIEW" = "CONNECTED";
  if (parsed.provider === "SHOPIFY" && !caps.shopifyOAuth) {
    status = "PENDING_APP_REVIEW";
  } else if (parsed.provider === "EMAIL" && !caps.emailLive && !encrypted) {
    status = "DEV_SINK";
  } else if (parsed.provider === "WHATSAPP" && !caps.whatsappLive && !encrypted) {
    status = "DEV_SINK";
  }

  return withTenantDb(
    session.tenantId,
    async (tx) => {
      const [saved] = await tx
        .insert(integrationConnections)
        .values({
          tenantId: session.tenantId,
          provider: parsed.provider,
          status,
          displayName: parsed.displayName,
          externalDomain: parsed.externalDomain || null,
          encryptedSecret: encrypted?.envelope ?? null,
          secretFingerprint: encrypted?.fingerprint ?? null,
          config: parsed.config,
          lastSyncedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [integrationConnections.tenantId, integrationConnections.provider],
          set: {
            status,
            displayName: parsed.displayName,
            externalDomain: parsed.externalDomain || null,
            ...(encrypted
              ? {
                  encryptedSecret: encrypted.envelope,
                  secretFingerprint: encrypted.fingerprint,
                }
              : {}),
            config: parsed.config,
            lastSyncedAt: new Date(),
          },
        })
        .returning({
          id: integrationConnections.id,
          provider: integrationConnections.provider,
          status: integrationConnections.status,
          secretFingerprint: integrationConnections.secretFingerprint,
        });

      await recordAuditLog(
        {
          tenantId: session.tenantId,
          actorUserId: session.userId,
          actorRole: session.role,
          action: "INTEGRATION_UPDATED",
          entityType: "INTEGRATION",
          entityId: saved!.id,
          ipHash,
          summary: `Configured ${parsed.provider} connector (${saved!.status}${
            encrypted ? `, secret ${encrypted.fingerprint}` : ""
          }).`,
        },
        tx
      );

      return saved!;
    },
    dbOverride
  );
}

export async function ingestSignedCommerceOrderWebhook(
  params: {
    provider: "SHOPIFY" | "WOOCOMMERCE";
    tenantSlug: string;
    externalEventId: string;
    signatureHeader: string | null;
    rawBody: string;
  },
  dbOverride?: Database
): Promise<{ duplicate: boolean; syncedSerials: number }> {
  const db = dbOverride ?? (await getDb());
  const env = getEnv();

  const [tenantRow] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.slug, params.tenantSlug.trim().toLowerCase()))
    .limit(1);

  if (!tenantRow) {
    throw new AppError(404, "TENANT_NOT_FOUND", "Unknown workspace slug for webhook.");
  }

  return withTenantDb(
    tenantRow.id,
    async (tx) => {
      const [conn] = await tx
        .select()
        .from(integrationConnections)
        .where(
          and(
            eq(integrationConnections.tenantId, tenantRow.id),
            eq(integrationConnections.provider, params.provider)
          )
        )
        .limit(1);

      const fallbackSecret =
        params.provider === "SHOPIFY"
          ? env.SHOPIFY_WEBHOOK_SECRET?.trim() || env.WEBHOOK_SIGNING_SECRET
          : env.WOOCOMMERCE_WEBHOOK_SECRET?.trim() || env.WEBHOOK_SIGNING_SECRET;

      const secret = conn?.encryptedSecret
        ? decryptSecret(conn.encryptedSecret)
        : fallbackSecret;

      verifyBase64HmacSignature(params.rawBody, params.signatureHeader, secret);

      const claim = await claimIdempotentWebhookEvent(
        {
          provider: params.provider,
          externalEventId: params.externalEventId,
          tenantId: tenantRow.id,
          eventType: "order.fulfilled",
          rawPayload: params.rawBody,
        },
        db
      );

      if (claim.alreadyProcessed) {
        return { duplicate: true, syncedSerials: 0 };
      }

      const payload = JSON.parse(params.rawBody) as {
        id?: string | number;
        name?: string;
        number?: string;
        line_items?: Array<{
          sku?: string;
          serial_number?: string;
          properties?: Array<{ name?: string; value?: string }>;
        }>;
      };

      const orderRef = String(payload.name ?? payload.number ?? payload.id ?? "ORDER");
      const items = payload.line_items ?? [];
      const tenantProducts = await tx
        .select()
        .from(products)
        .where(eq(products.tenantId, tenantRow.id));
      const productBySku = new Map(tenantProducts.map((p) => [p.sku.toUpperCase(), p]));

      let syncedSerials = 0;
      const now = new Date();

      for (const item of items) {
        const sku = item.sku?.trim().toUpperCase();
        if (!sku) continue;
        const prod = productBySku.get(sku);
        if (!prod) continue;

        const propSerial = item.properties?.find(
          (pr) => pr.name?.toLowerCase() === "serial" || pr.name?.toLowerCase() === "serial_number"
        )?.value;
        const serialRaw = (item.serial_number ?? propSerial)?.trim().toUpperCase();
        if (!serialRaw || serialRaw.length < 4) continue;

        await tx
          .insert(serialUnits)
          .values({
            tenantId: tenantRow.id,
            brandId: prod.brandId,
            productId: prod.id,
            serialNumber: serialRaw,
            serialMasked: maskSerialNumber(serialRaw),
            salesChannel: "D2C_WEB",
            externalOrderId: orderRef,
            soldAt: now,
            status: "SOLD",
            isDemo: tenantRow.isDemo,
          })
          .onConflictDoUpdate({
            target: [serialUnits.tenantId, serialUnits.serialNumber],
            set: {
              externalOrderId: orderRef,
              soldAt: now,
              status: "SOLD",
            },
          });
        syncedSerials += 1;
      }

      return { duplicate: false, syncedSerials };
    },
    db
  );
}
