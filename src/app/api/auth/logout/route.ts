import { NextResponse } from "next/server";
import {
  getCurrentSession,
  revokeCurrentSession,
  SESSION_COOKIE_NAME,
} from "@/auth/session";
import { jsonErrorResponse } from "@/lib/errors";
import { verifySameOrigin } from "@/security/csrf";

export async function POST(request: Request) {
  try {
    verifySameOrigin(request);
    const session = await getCurrentSession();
    if (session) {
      await revokeCurrentSession(session.sessionId, session.tenantId);
    }
    const response = NextResponse.json({ ok: true, redirectTo: "/login" });
    response.cookies.set(SESSION_COOKIE_NAME, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0,
    });
    return response;
  } catch (error) {
    return jsonErrorResponse(error);
  }
}
