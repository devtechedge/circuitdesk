import { desc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { requirePageSession } from "@/auth/page-auth";
import { TeamInvitePanel } from "@/components/admin-panels";
import { DataTableWrap, SectionHeader, StatusBadge, TechCode } from "@/components/ui/primitives";
import { withTenantDb } from "@/db/tenant";
import { invitations, memberships, users } from "@/db/schema";
import { hasPermission, listPermissionsForRole } from "@/security/rbac";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Team Members & 7-Role RBAC",
};

export default async function TeamPage() {
  const session = await requirePageSession("console:read");

  const data = await withTenantDb(session.tenantId, async (tx) => {
    const members = await tx
      .select({
        membershipId: memberships.id,
        role: memberships.role,
        serviceCentreId: memberships.serviceCentreId,
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

    return { members, invites };
  });

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Role-Based Access Control"
        title="Workspace Team & Permissions"
        description="Enforced server-side across Owner, Admin, Operations, Support, Technician, Analyst, and Read-Only roles."
      />

      <TeamInvitePanel canManage={hasPermission(session.role, "team:manage")} />

      <DataTableWrap label="Workspace team members table">
        <table className="w-full min-w-[680px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] font-mono text-xs uppercase text-[var(--text-muted)]">
              <th className="p-3">Operator</th>
              <th className="p-3">Email</th>
              <th className="p-3">Role</th>
              <th className="p-3">Effective Scopes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)]">
            {data.members.map((m) => (
              <tr key={m.membershipId}>
                <td className="p-3 font-medium text-[var(--text-primary)]">{m.fullName}</td>
                <td className="p-3 font-mono text-xs text-[var(--text-secondary)]">{m.email}</td>
                <td className="p-3">
                  <TechCode>{m.role}</TechCode>
                </td>
                <td className="p-3 font-mono text-[11px] text-[var(--text-muted)]">
                  {listPermissionsForRole(m.role).slice(0, 5).join(", ")}
                  {listPermissionsForRole(m.role).length > 5 ? " ..." : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </DataTableWrap>

      {data.invites.length > 0 && (
        <section className="cd-surface rounded-xl p-5 space-y-2">
          <h2 className="m-0 text-sm font-bold text-[var(--text-primary)]">
            Pending Invitations ({data.invites.length})
          </h2>
          <ul className="m-0 list-none space-y-2 p-0 text-xs">
            {data.invites.map((inv) => (
              <li key={inv.id} className="flex items-center justify-between gap-2">
                <span className="font-mono">{inv.email}</span>
                <div className="flex items-center gap-2">
                  <TechCode>{inv.role}</TechCode>
                  <StatusBadge tone={inv.acceptedAt ? "ok" : "info"}>
                    {inv.acceptedAt ? "ACCEPTED" : "PENDING"}
                  </StatusBadge>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
