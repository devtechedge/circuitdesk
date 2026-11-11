import { createHash, createHmac } from "node:crypto";
import { getDb, type DbExecutor } from "@/db/client";
import { webhookEvents } from "@/db/schema";
import { AppError } from "@/lib/errors";
import { constantTimeHexEquals, constantTimeStringEquals } from "./tokens";

const DEFAULT_REPLAY_TOLERANCE_SEC = 300; // 5 minutes

export function signTimestampedWebhook(
  payload: string,
  secret: string,
  timestampSec = Math.floor(Date.now() / 1000)
): string {
  const signedPayload = `${timestampSec}.${payload}`;
  const sig = createHmac("sha256", secret).update(signedPayload, "utf8").digest("hex");
  return `t=${timestampSec},v1=${sig}`;
}

/**
 * Verifies Stripe-style or CircuitDesk-style `t=<unix>,v1=<hmac_hex>` header
 * with strict replay window enforcement and constant-time comparison.
 */
export function verifyTimestampedHmacSignature(params: {
  payload: string;
  headerValue: string | null;
  secret: string;
  nowSec?: number;
  toleranceSec?: number;
}): void {
  const {
    payload,
    headerValue,
    secret,
    nowSec = Math.floor(Date.now() / 1000),
    toleranceSec = DEFAULT_REPLAY_TOLERANCE_SEC,
  } = params;

  if (!headerValue) {
    throw new AppError(401, "WEBHOOK_SIGNATURE_MISSING", "Missing webhook signature header.");
  }

  let timestampStr: string | undefined;
  const signatures: string[] = [];

  for (const part of headerValue.split(",")) {
    const [k, v] = part.trim().split("=");
    if (k === "t" && v) timestampStr = v;
    if (k === "v1" && v) signatures.push(v);
  }

  if (!timestampStr || signatures.length === 0) {
    throw new AppError(401, "WEBHOOK_SIGNATURE_MALFORMED", "Malformed webhook signature header.");
  }

  const timestamp = Number(timestampStr);
  if (!Number.isFinite(timestamp) || Math.abs(nowSec - timestamp) > toleranceSec) {
    throw new AppError(
      401,
      "WEBHOOK_TIMESTAMP_EXPIRED",
      "Webhook timestamp outside allowed replay window."
    );
  }

  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${payload}`, "utf8")
    .digest("hex");

  const matched = signatures.some((candidate) => constantTimeHexEquals(candidate, expected));
  if (!matched) {
    throw new AppError(401, "WEBHOOK_SIGNATURE_INVALID", "Webhook HMAC verification failed.");
  }
}

export function verifyHexHmacSignature(
  payload: string,
  headerValue: string | null,
  secret: string
): void {
  if (!headerValue) {
    throw new AppError(401, "WEBHOOK_SIGNATURE_MISSING", "Missing webhook signature header.");
  }
  const expected = createHmac("sha256", secret).update(payload, "utf8").digest("hex");
  if (!constantTimeHexEquals(headerValue.trim(), expected)) {
    throw new AppError(401, "WEBHOOK_SIGNATURE_INVALID", "Webhook HMAC verification failed.");
  }
}

export function verifyBase64HmacSignature(
  payload: string,
  headerValue: string | null,
  secret: string
): void {
  if (!headerValue) {
    throw new AppError(401, "WEBHOOK_SIGNATURE_MISSING", "Missing webhook signature header.");
  }
  const expected = createHmac("sha256", secret).update(payload, "utf8").digest("base64");
  if (!constantTimeStringEquals(headerValue.trim(), expected)) {
    throw new AppError(401, "WEBHOOK_SIGNATURE_INVALID", "Webhook HMAC verification failed.");
  }
}

export async function claimIdempotentWebhookEvent(
  params: {
    provider: "STRIPE" | "RAZORPAY" | "SHOPIFY" | "WOOCOMMERCE" | "WHATSAPP";
    externalEventId: string;
    tenantId?: string | null;
    eventType: string;
    rawPayload: string;
  },
  executor?: DbExecutor
): Promise<{ alreadyProcessed: boolean }> {
  const db = executor ?? (await getDb());
  const payloadSha256 = createHash("sha256").update(params.rawPayload, "utf8").digest("hex");

  const inserted = await db
    .insert(webhookEvents)
    .values({
      provider: params.provider,
      externalEventId: params.externalEventId,
      tenantId: params.tenantId ?? null,
      eventType: params.eventType,
      payloadSha256,
      status: "PROCESSED",
      processedAt: new Date(),
    })
    .onConflictDoNothing({
      target: [webhookEvents.provider, webhookEvents.externalEventId],
    })
    .returning({ id: webhookEvents.id });

  return { alreadyProcessed: inserted.length === 0 };
}
