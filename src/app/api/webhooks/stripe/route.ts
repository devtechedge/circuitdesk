import { NextResponse } from "next/server";
import { jsonErrorResponse } from "@/lib/errors";
import { processStripeWebhookPayload } from "@/services/billing";

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const signatureHeader = request.headers.get("stripe-signature");
    const result = await processStripeWebhookPayload({ rawBody, signatureHeader });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return jsonErrorResponse(error);
  }
}
