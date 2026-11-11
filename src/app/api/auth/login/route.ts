import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  buildSessionCookieOptions,
  createDatabaseSession,
  SESSION_COOKIE_NAME,
} from "@/auth/session";
import { getDb } from "@/db/client";
import { memberships, users } from "@/db/schema";
import { AppError, jsonErrorResponse } from "@/lib/errors";
import { sanitizeNextPath, verifySameOrigin } from "@/security/csrf";
import { verifyPassword } from "@/security/password";
import { enforceRateLimit, extractClientIpHash } from "@/security/rate-limit";
import { recordAuditLog } from "@/services/audit";

const loginSchema = z.object({
  email: z.string().trim().email().max(160),
  password: z.string().min(1).max(128),
  next: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    verifySameOrigin(request);
    const ipHash = extractClientIpHash(request);
    const body = loginSchema.parse(await request.json());
    const normalizedEmail = body.email.toLowerCase();

    await enforceRateLimit(
      { bucket: "auth:login", limit: 30, windowSeconds: 900 },
      `${ipHash}:${normalizedEmail}`
    );

    const db = await getDb();
    const foundUsers = await db
      .select()
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    const user = foundUsers[0];
    if (!user || user.disabledAt || !verifyPassword(body.password, user.passwordHash)) {
      throw new AppError(401, "INVALID_CREDENTIALS", "Invalid email or password.");
    }

    const userMemberships = await db
      .select()
      .from(memberships)
      .where(eq(memberships.userId, user.id))
      .limit(1);

    const primaryMembership = userMemberships[0];
    if (!primaryMembership) {
      throw new AppError(403, "NO_TENANT_MEMBERSHIP", "Account has no active workspace access.");
    }

    const session = await createDatabaseSession(
      {
        userId: user.id,
        tenantId: primaryMembership.tenantId,
        ipHash,
        userAgent: request.headers.get("user-agent") ?? "",
      },
      db
    );

    await recordAuditLog(
      {
        tenantId: primaryMembership.tenantId,
        actorUserId: user.id,
        actorRole: primaryMembership.role,
        action: "AUTH_LOGIN",
        entityType: "SESSION",
        entityId: session.sessionId,
        ipHash,
        summary: `Signed in as ${user.fullName} (${primaryMembership.role}).`,
      },
      db
    );

    const redirectTo = sanitizeNextPath(body.next, "/app");
    const response = NextResponse.json({ ok: true, redirectTo, role: primaryMembership.role });
    response.cookies.set(
      SESSION_COOKIE_NAME,
      session.rawToken,
      buildSessionCookieOptions(session.expiresAt)
    );
    return response;
  } catch (error) {
    return jsonErrorResponse(error);
  }
}
