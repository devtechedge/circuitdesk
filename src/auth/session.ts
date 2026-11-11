import { and, eq, gt, isNull, ne } from "drizzle-orm";
import { cookies } from "next/headers";
import { getEnv } from "@/env";
import { getDb, type Database } from "@/db/client";
import {
  type CurrencyCode,
  memberships,
  type Role,
  sessions,
  tenants,
  users,
} from "@/db/schema";
import { AppError } from "@/lib/errors";
import { verifySameOrigin } from "@/security/csrf";
import { assertPermission, type Permission } from "@/security/rbac";
import { generateOpaqueToken, hashToken } from "@/security/tokens";

export const SESSION_COOKIE_NAME = "cd_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

export interface AuthenticatedSession {
  sessionId: string;
  userId: string;
  email: string;
  fullName: string;
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  tenantCurrency: CurrencyCode;
  isDemoTenant: boolean;
  role: Role;
  serviceCentreId: string | null;
}

export function buildSessionCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: getEnv().NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  };
}

export async function createDatabaseSession(
  params: {
    userId: string;
    tenantId: string;
    ipHash: string;
    userAgent: string;
  },
  dbOverride?: Database
): Promise<{ rawToken: string; sessionId: string; expiresAt: Date }> {
  const db = dbOverride ?? (await getDb());
  const token = generateOpaqueToken("cd_sess");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  const inserted = await db
    .insert(sessions)
    .values({
      tokenHash: token.hash,
      userId: params.userId,
      tenantId: params.tenantId,
      ipHash: params.ipHash,
      userAgent: params.userAgent.slice(0, 255),
      expiresAt,
    })
    .returning({ id: sessions.id });

  const row = inserted[0];
  if (!row) {
    throw new AppError(500, "SESSION_CREATE_FAILED", "Failed to create session.");
  }

  return { rawToken: token.raw, sessionId: row.id, expiresAt };
}

export async function resolveSessionFromRawToken(
  rawToken: string | undefined | null,
  dbOverride?: Database
): Promise<AuthenticatedSession | null> {
  if (!rawToken || !rawToken.startsWith("cd_sess_")) {
    return null;
  }
  const db = dbOverride ?? (await getDb());
  const tokenHash = hashToken(rawToken);
  const now = new Date();

  const rows = await db
    .select({
      sessionId: sessions.id,
      userId: users.id,
      email: users.email,
      fullName: users.fullName,
      tenantId: tenants.id,
      tenantSlug: tenants.slug,
      tenantName: tenants.name,
      tenantCurrency: tenants.defaultCurrency,
      isDemoTenant: tenants.isDemo,
      role: memberships.role,
      serviceCentreId: memberships.serviceCentreId,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .innerJoin(tenants, eq(sessions.tenantId, tenants.id))
    .innerJoin(
      memberships,
      and(eq(memberships.tenantId, tenants.id), eq(memberships.userId, users.id))
    )
    .where(
      and(
        eq(sessions.tokenHash, tokenHash),
        isNull(sessions.revokedAt),
        gt(sessions.expiresAt, now),
        isNull(users.disabledAt)
      )
    )
    .limit(1);

  return rows[0] ?? null;
}

export async function getCurrentSession(): Promise<AuthenticatedSession | null> {
  const store = await cookies();
  const raw = store.get(SESSION_COOKIE_NAME)?.value;
  return resolveSessionFromRawToken(raw);
}

function readCookieFromHeader(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) {
      return decodeURIComponent(rest.join("="));
    }
  }
  return null;
}

export async function requireApiSession(
  request: Request,
  permission: Permission = "console:read",
  dbOverride?: Database
): Promise<AuthenticatedSession> {
  verifySameOrigin(request);
  const raw = readCookieFromHeader(request.headers.get("cookie"), SESSION_COOKIE_NAME);
  const session = await resolveSessionFromRawToken(raw, dbOverride);
  if (!session) {
    throw new AppError(401, "UNAUTHENTICATED", "Authentication required.");
  }
  assertPermission(session.role, permission);
  return session;
}

export async function revokeCurrentSession(
  sessionId: string,
  tenantId: string,
  dbOverride?: Database
): Promise<void> {
  const db = dbOverride ?? (await getDb());
  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(sessions.id, sessionId), eq(sessions.tenantId, tenantId)));
}

export async function revokeOtherUserSessions(
  params: { userId: string; tenantId: string; keepSessionId: string },
  dbOverride?: Database
): Promise<number> {
  const db = dbOverride ?? (await getDb());
  const updated = await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(sessions.userId, params.userId),
        eq(sessions.tenantId, params.tenantId),
        ne(sessions.id, params.keepSessionId),
        isNull(sessions.revokedAt)
      )
    )
    .returning({ id: sessions.id });
  return updated.length;
}
