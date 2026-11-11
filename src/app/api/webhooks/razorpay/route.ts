import { NextResponse } from "next/server";
import { jsonErrorResponse } from "@/lib/errors";
import { processRazorpayWebhookPayload } from "@/services/billing";

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const signatureHeader = request.headers.get("x-razorpay-signature");
    const result = await processRazorpayWebhookPayload({ rawBody, signatureHeader });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return jsonErrorResponse(error);
  }
}
