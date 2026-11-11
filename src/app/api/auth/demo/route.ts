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
import { seedSyntheticDemo } from "@/demo/seed";
import { isDemoMode } from "@/env";
import { AppError, jsonErrorResponse } from "@/lib/errors";
import { sanitizeNextPath, verifySameOrigin } from "@/security/csrf";
import { extractClientIpHash } from "@/security/rate-limit";

const demoPersonaEmails = {
  OWNER: "ops@kinetix-audio.demo",
  SUPPORT: "support@kinetix-audio.demo",
  TECHNICIAN: "tech@kinetix-audio.demo",
  ANALYST: "analyst@kinetix-audio.demo",
  READ_ONLY: "viewer@kinetix-audio.demo",
} as const;

const demoSchema = z
  .object({
    persona: z
      .enum(["OWNER", "SUPPORT", "TECHNICIAN", "ANALYST", "READ_ONLY"])
      .default("OWNER"),
    next: z.string().optional(),
  })
  .default({ persona: "OWNER" });

export async function POST(request: Request) {
  try {
    verifySameOrigin(request);
    if (!isDemoMode()) {
      throw new AppError(403, "DEMO_DISABLED", "Synthetic demo sign-in is disabled.");
    }

    const rawText = await request.text();
    const parsedBody = rawText.trim() ? JSON.parse(rawText) : {};
    const body = demoSchema.parse(parsedBody);

    const db = await getDb();
    await seedSyntheticDemo(db);

    const email = demoPersonaEmails[body.persona];
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (!user) {
      throw new AppError(500, "DEMO_USER_MISSING", "Synthetic demo persona was not seeded.");
    }

    const [membership] = await db
      .select()
      .from(memberships)
      .where(eq(memberships.userId, user.id))
      .limit(1);

    if (!membership) {
      throw new AppError(500, "DEMO_MEMBERSHIP_MISSING", "Demo membership missing.");
    }

    const ipHash = extractClientIpHash(request);
    const session = await createDatabaseSession(
      {
        userId: user.id,
        tenantId: membership.tenantId,
        ipHash,
        userAgent: request.headers.get("user-agent") ?? "",
      },
      db
    );

    const redirectTo = sanitizeNextPath(body.next, "/app");
    const response = NextResponse.json({
      ok: true,
      redirectTo,
      persona: body.persona,
      email,
    });
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
