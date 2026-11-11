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
    const deliveryId = request.headers.get("x-wc-webhook-delivery-id");
    if (!deliveryId) {
      throw new AppError(400, "WEBHOOK_ID_REQUIRED", "Missing X-WC-Webhook-Delivery-ID header.");
    }
    const rawBody = await request.text();
    const signatureHeader = request.headers.get("x-wc-webhook-signature");

    const result = await ingestSignedCommerceOrderWebhook({
      provider: "WOOCOMMERCE",
      tenantSlug,
      externalEventId: deliveryId,
      signatureHeader,
      rawBody,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return jsonErrorResponse(error);
  }
}
