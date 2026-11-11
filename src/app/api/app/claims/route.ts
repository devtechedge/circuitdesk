import { NextResponse } from "next/server";
import { requireApiSession } from "@/auth/session";
import { jsonErrorResponse } from "@/lib/errors";
import { listTenantClaims } from "@/services/claims";

export async function GET(request: Request) {
  try {
    const session = await requireApiSession(request, "console:read");
    const claims = await listTenantClaims(session);
    return NextResponse.json({ claims });
  } catch (error) {
    return jsonErrorResponse(error);
  }
}
