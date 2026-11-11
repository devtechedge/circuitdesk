import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiSession } from "@/auth/session";
import { withTenantDb } from "@/db/tenant";
import { invitations, memberships, ROLES, subscriptions, users } from "@/db/schema";
import { PLAN_CATALOG } from "@/domain/plans";
import { AppError, jsonErrorResponse } from "@/lib/errors";
import { extractClientIpHash } from "@/security/rate-limit";
import { generateOpaqueToken } from "@/security/tokens";
import { recordAuditLog } from "@/services/audit";

const teamMutationSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("invite"),
    email: z.string().trim().email().max(160),
    role: z.enum(ROLES),
  }),
  z.object({
    kind: z.literal("update_role"),
    membershipId: z.string().uuid(),
    role: z.enum(ROLES),
  }),
]);

export async function GET(request: Request) {
  try {
    const session = await requireApiSession(request, "console:read");
    const data = await withTenantDb(session.tenantId, async (tx) => {
      const members = await tx
        .select({
          membershipId: memberships.id,
          role: memberships.role,
          serviceCentreId: memberships.serviceCentreId,
          userId: users.id,
          email: users.email,
          fullName: users.fullName,
          createdAt: memberships.createdAt,
        })
        .from(memberships)
        .innerJoin(users, eq(memberships.userId, users.id))
        .where(eq(memberships.tenantId, session.tenantId));

      const invites = await tx
        .select()
        .from(invitations)
        .where(eq(invitations.tenantId, session.tenantId))
        .orderBy(desc(invitations.createdAt));

      return { members, invitations: invites };
    });

    return NextResponse.json(data);
  } catch (error) {
    return jsonErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireApiSession(request, "team:manage");
    const ipHash = extractClientIpHash(request);
    const body = teamMutationSchema.parse(await request.json());

    const result = await withTenantDb(session.tenantId, async (tx) => {
      if (body.kind === "invite") {
        const currentMembers = await tx
          .select({ id: memberships.id })
          .from(memberships)
          .where(eq(memberships.tenantId, session.tenantId));

        const [sub] = await tx
          .select({ planCode: subscriptions.planCode })
          .from(subscriptions)
          .where(eq(subscriptions.tenantId, session.tenantId))
          .limit(1);

        const maxSeats = PLAN_CATALOG[sub?.planCode ?? "STARTER"].limits.seats;
        if (currentMembers.length >= maxSeats) {
          throw new AppError(
            403,
            "PLAN_SEAT_LIMIT_REACHED",
            `Current plan permits up to ${maxSeats} seats. Upgrade plan to invite more teammates.`
          );
        }

        const token = generateOpaqueToken("cd_inv");
        const expiresAt = new Date(Date.now() + 7 * 86_400_000);
        const [inv] = await tx
          .insert(invitations)
          .values({
            tenantId: session.tenantId,
            email: body.email.toLowerCase(),
            role: body.role,
            tokenHash: token.hash,
            invitedByUserId: session.userId,
            expiresAt,
          })
          .returning();

        await recordAuditLog(
          {
            tenantId: session.tenantId,
            actorUserId: session.userId,
            actorRole: session.role,
            action: "TEAM_MEMBER_INVITED",
            entityType: "INVITATION",
            entityId: inv!.id,
            ipHash,
            summary: `Invited ${body.email.toLowerCase()} with role ${body.role}.`,
          },
          tx
        );

        return { invitation: inv!, inviteTokenPreview: token.preview };
      }

      const [updated] = await tx
        .update(memberships)
        .set({ role: body.role })
        .where(
          and(
            eq(memberships.id, body.membershipId),
            eq(memberships.tenantId, session.tenantId)
          )
        )
        .returning();

      if (!updated) {
        throw new AppError(404, "MEMBERSHIP_NOT_FOUND", "Team membership not found.");
      }

      await recordAuditLog(
        {
          tenantId: session.tenantId,
          actorUserId: session.userId,
          actorRole: session.role,
          action: "TEAM_ROLE_UPDATED",
          entityType: "MEMBERSHIP",
          entityId: updated.id,
          ipHash,
          summary: `Updated member role -> ${body.role}.`,
        },
        tx
      );

      return { membership: updated };
    });

    revalidatePath("/app/team");
    revalidatePath("/app/onboarding");
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return jsonErrorResponse(error);
  }
}
