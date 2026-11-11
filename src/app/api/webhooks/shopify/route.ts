import { NextResponse } from "next/server";
import { AppError, jsonErrorResponse } from "@/lib/errors";
import { ingestSignedCommerceOrderWebhook } from "@/services/integrations";

export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const tenantSlug = url.searchParams.get("tenant");
    if (!tenantSlug) {
      throw new AppError(400, "TENANT_QUERY_REQUIRED", "Query parameter ?tenant=<slug> required.");
    }
    const webhookId = request.headers.get("x-shopify-webhook-id");
    if (!webhookId) {
      throw new AppError(400, "WEBHOOK_ID_REQUIRED", "Missing X-Shopify-Webhook-Id header.");
    }
    const rawBody = await request.text();
    const signatureHeader = request.headers.get("x-shopify-hmac-sha256");

    const result = await ingestSignedCommerceOrderWebhook({
      provider: "SHOPIFY",
      tenantSlug,
      externalEventId: webhookId,
      signatureHeader,
      rawBody,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return jsonErrorResponse(error);
  }
}
