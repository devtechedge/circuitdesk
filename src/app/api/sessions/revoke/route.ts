import { NextResponse } from "next/server";
import { requireApiSession, revokeOtherUserSessions } from "@/auth/session";
import { jsonErrorResponse } from "@/lib/errors";
import { extractClientIpHash } from "@/security/rate-limit";
import { recordAuditLog } from "@/services/audit";

export async function POST(request: Request) {
  try {
    const session = await requireApiSession(request, "console:read");
    const revokedCount = await revokeOtherUserSessions({
      userId: session.userId,
      tenantId: session.tenantId,
      keepSessionId: session.sessionId,
    });

    await recordAuditLog({
      tenantId: session.tenantId,
      actorUserId: session.userId,
      actorRole: session.role,
      action: "AUTH_OTHER_SESSIONS_REVOKED",
      entityType: "SESSION",
      entityId: session.sessionId,
      ipHash: extractClientIpHash(request),
      summary: `Revoked ${revokedCount} other active session(s).`,
    });

    return NextResponse.json({ ok: true, revokedCount });
  } catch (error) {
    return jsonErrorResponse(error);
  }
}
