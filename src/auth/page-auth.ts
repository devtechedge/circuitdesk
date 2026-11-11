import { redirect } from "next/navigation";
import { hasPermission, type Permission } from "@/security/rbac";
import { type AuthenticatedSession, getCurrentSession } from "./session";

export async function requirePageSession(
  permission: Permission = "console:read"
): Promise<AuthenticatedSession> {
  const session = await getCurrentSession();
  if (!session) {
    redirect("/login");
  }
  if (!hasPermission(session.role, permission)) {
    redirect("/app?denied=1");
  }
  return session;
}
