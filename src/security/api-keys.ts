import { and, eq, isNull } from "drizzle-orm";
import { getDb, type Database } from "@/db/client";
import { apiKeys, subscriptions } from "@/db/schema";
import { AppError } from "@/lib/errors";
import { generateOpaqueToken, hashToken } from "./tokens";

export async function createTenantApiKey(
  params: {
    tenantId: string;
    name: string;
    scopes: string[];
    createdByUserId: string;
  },
  dbOverride?: Database
): Promise<{ id: string; rawKey: string; keyPrefix: string }> {
  const db = dbOverride ?? (await getDb());
  const generated = generateOpaqueToken("cd_live");
  const keyPrefix = generated.raw.slice(0, 14);

  const inserted = await db
    .insert(apiKeys)
    .values({
      tenantId: params.tenantId,
      name: params.name.trim(),
      keyPrefix,
      keyHash: generated.hash,
      scopes: params.scopes,
      createdByUserId: params.createdByUserId,
    })
    .returning({ id: apiKeys.id });

  const row = inserted[0];
  if (!row) {
    throw new AppError(500, "API_KEY_CREATE_FAILED", "Could not persist API key.");
  }

  return { id: row.id, rawKey: generated.raw, keyPrefix };
}

export async function verifyBearerApiKey(
  request: Request,
  requiredScope: string,
  dbOverride?: Database
): Promise<{ tenantId: string; apiKeyId: string; scopes: string[] }> {
  const auth = request.headers.get("authorization");
  if (!auth || !auth.toLowerCase().startsWith("bearer ")) {
    throw new AppError(401, "API_KEY_MISSING", "Bearer API key required.");
  }
  const raw = auth.slice(7).trim();
  if (!raw.startsWith("cd_live_")) {
    throw new AppError(401, "API_KEY_INVALID", "Unrecognized API key prefix.");
  }

  const db = dbOverride ?? (await getDb());
  const keyHash = hashToken(raw);

  const found = await db
    .select({
      id: apiKeys.id,
      tenantId: apiKeys.tenantId,
      scopes: apiKeys.scopes,
      planCode: subscriptions.planCode,
    })
    .from(apiKeys)
    .leftJoin(subscriptions, eq(subscriptions.tenantId, apiKeys.tenantId))
    .where(and(eq(apiKeys.keyHash, keyHash), isNull(apiKeys.revokedAt)))
    .limit(1);

  const keyRow = found[0];
  if (!keyRow) {
    throw new AppError(401, "API_KEY_REVOKED_OR_INVALID", "Invalid or revoked API key.");
  }

  if (keyRow.planCode && keyRow.planCode !== "SCALE" && keyRow.planCode !== "ENTERPRISE") {
    throw new AppError(
      403,
      "PLAN_API_ENTITLEMENT_REQUIRED",
      "REST API access requires Scale or Enterprise plan entitlement."
    );
  }

  if (!keyRow.scopes.includes(requiredScope) && !keyRow.scopes.includes("*")) {
    throw new AppError(
      403,
      "API_KEY_SCOPE_DENIED",
      `API key lacks required scope "${requiredScope}".`
    );
  }

  await db
    .update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeys.id, keyRow.id));

  return { tenantId: keyRow.tenantId, apiKeyId: keyRow.id, scopes: keyRow.scopes };
}
