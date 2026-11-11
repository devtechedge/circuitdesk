import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiSession } from "@/auth/session";
import { jsonErrorResponse } from "@/lib/errors";
import { extractClientIpHash } from "@/security/rate-limit";
import {
  listTenantRegistrations,
  reviewOrRevokeRegistration,
} from "@/services/registrations";

const reviewSchema = z.object({
  registrationId: z.string().uuid(),
  action: z.enum(["APPROVE", "REJECT", "REVOKE_TOKEN"]),
  notes: z.string().trim().max(500).optional(),
});

export async function GET(request: Request) {
  try {
    const session = await requireApiSession(request, "console:read");
    const registrations = await listTenantRegistrations(session);
    return NextResponse.json({ registrations });
  } catch (error) {
    return jsonErrorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await requireApiSession(request, "registrations:review");
    const body = reviewSchema.parse(await request.json());
    const updated = await reviewOrRevokeRegistration(session, {
      ...body,
      ipHash: extractClientIpHash(request),
    });
    revalidatePath("/app/registrations");
    revalidatePath("/app");
    return NextResponse.json({ ok: true, registration: updated });
  } catch (error) {
    return jsonErrorResponse(error);
  }
}
