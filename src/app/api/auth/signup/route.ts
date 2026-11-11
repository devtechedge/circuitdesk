import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  buildSessionCookieOptions,
  createDatabaseSession,
  SESSION_COOKIE_NAME,
} from "@/auth/session";
import { getDb } from "@/db/client";
import {
  brands,
  memberships,
  subscriptions,
  tenants,
  usageCounters,
  users,
} from "@/db/schema";
import { AppError, jsonErrorResponse } from "@/lib/errors";
import { sanitizeNextPath, verifySameOrigin } from "@/security/csrf";
import { hashPassword } from "@/security/password";
import { enforceRateLimit, extractClientIpHash } from "@/security/rate-limit";
import { recordAuditLog } from "@/services/audit";

const signupSchema = z.object({
  fullName: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(160),
  password: z.string().min(10, "Password must be at least 10 characters.").max(128),
  companyName: z.string().trim().min(2).max(120),
  brandName: z.string().trim().min(2).max(80),
  currency: z.enum(["INR", "USD"]).default("INR"),
  next: z.string().optional(),
});

function slugify(value: string): string {
  const base = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 36);
  return base || "brand";
}

export async function POST(request: Request) {
  try {
    verifySameOrigin(request);
    const ipHash = extractClientIpHash(request);
    await enforceRateLimit({ bucket: "auth:signup", limit: 25, windowSeconds: 900 }, ipHash);

    const body = signupSchema.parse(await request.json());
    const normalizedEmail = body.email.toLowerCase();
    const db = await getDb();

    const existingUser = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    if (existingUser.length > 0) {
      throw new AppError(409, "EMAIL_EXISTS", "An account with this email already exists.");
    }

    const suffix = randomBytes(3).toString("hex");
    const tenantSlug = `${slugify(body.companyName)}-${suffix}`;
    const brandSlug = `${slugify(body.brandName)}-${suffix}`;
    const now = new Date();
    const periodEnd = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 14);
    const periodYm = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;

    const created = await db.transaction(async (tx) => {
      const [tenant] = await tx
        .insert(tenants)
        .values({
          slug: tenantSlug,
          name: body.companyName,
          primaryCountry: body.currency === "INR" ? "IN" : "US",
          defaultCurrency: body.currency,
          supportEmail: normalizedEmail,
          isDemo: false,
          onboardingCompletedSteps: ["brand"],
        })
        .returning();

      const [user] = await tx
        .insert(users)
        .values({
          email: normalizedEmail,
          fullName: body.fullName,
          passwordHash: hashPassword(body.password),
          isDemo: false,
        })
        .returning();

      await tx.insert(memberships).values({
        tenantId: tenant!.id,
        userId: user!.id,
        role: "OWNER",
      });

      const [brand] = await tx
        .insert(brands)
        .values({
          tenantId: tenant!.id,
          slug: brandSlug,
          name: body.brandName,
          supportEmail: normalizedEmail,
          portalHeadline: `${body.brandName} Warranty Registration & Repair Desk`,
        })
        .returning();

      await tx.insert(subscriptions).values({
        tenantId: tenant!.id,
        planCode: "STARTER",
        billingCurrency: body.currency,
        provider: "DEMO",
        status: "TRIALING",
        monthlyAmountMinor: body.currency === "INR" ? 399900 : 4900,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        isNonChargingDemo: true,
      });

      await tx.insert(usageCounters).values({
        tenantId: tenant!.id,
        periodYm,
        registrationsCount: 0,
        claimsCount: 0,
        aiSummariesCount: 0,
      });

      await recordAuditLog(
        {
          tenantId: tenant!.id,
          actorUserId: user!.id,
          actorRole: "OWNER",
          action: "TENANT_SIGNUP_CREATED",
          entityType: "TENANT",
          entityId: tenant!.id,
          ipHash,
          summary: `Created workspace "${tenant!.name}" and brand "${brand!.name}".`,
        },
        tx
      );

      return { tenant: tenant!, user: user!, brand: brand! };
    });

    const session = await createDatabaseSession(
      {
        userId: created.user.id,
        tenantId: created.tenant.id,
        ipHash,
        userAgent: request.headers.get("user-agent") ?? "",
      },
      db
    );

    const redirectTo = sanitizeNextPath(body.next, "/app/onboarding");
    const response = NextResponse.json(
      {
        ok: true,
        redirectTo,
        tenantSlug: created.tenant.slug,
        brandSlug: created.brand.slug,
      },
      { status: 201 }
    );
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
