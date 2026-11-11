import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { requireApiSession } from "@/auth/session";
import { jsonErrorResponse } from "@/lib/errors";
import { extractClientIpHash } from "@/security/rate-limit";
import {
  changePlanSchema,
  getBillingOverview,
  updateSubscriptionOrCheckout,
} from "@/services/billing";

export async function GET(request: Request) {
  try {
    const session = await requireApiSession(request, "console:read");
    const billing = await getBillingOverview(session);
    return NextResponse.json(billing);
  } catch (error) {
    return jsonErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireApiSession(request, "billing:manage");
    const body = changePlanSchema.parse(await request.json());
    const result = await updateSubscriptionOrCheckout(
      session,
      body,
      extractClientIpHash(request)
    );
    revalidatePath("/app/billing");
    revalidatePath("/app");
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return jsonErrorResponse(error);
  }
}
