import type { Role } from "@/db/schema";
import { AppError } from "@/lib/errors";

export const PERMISSIONS = [
  "console:read",
  "serial:unmask",
  "catalog:write",
  "serials:write",
  "registrations:review",
  "claims:adjudicate",
  "repairs:execute",
  "inventory:write",
  "analytics:read",
  "exports:gst",
  "automations:write",
  "integrations:write",
  "team:manage",
  "settings:write",
  "privacy:execute",
  "recall:approve",
  "billing:manage",
  "audit:read",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  OWNER: PERMISSIONS,
  ADMIN: PERMISSIONS,
  OPERATIONS: [
    "console:read",
    "serial:unmask",
    "catalog:write",
    "serials:write",
    "registrations:review",
    "claims:adjudicate",
    "repairs:execute",
    "inventory:write",
    "analytics:read",
    "exports:gst",
    "automations:write",
    "integrations:write",
  ],
  SUPPORT: [
    "console:read",
    "serial:unmask",
    "registrations:review",
    "claims:adjudicate",
  ],
  TECHNICIAN: ["console:read", "serial:unmask", "repairs:execute"],
  ANALYST: ["console:read", "analytics:read", "exports:gst", "audit:read"],
  READ_ONLY: ["console:read", "audit:read"],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function assertPermission(role: Role, permission: Permission): void {
  if (!hasPermission(role, permission)) {
    throw new AppError(
      403,
      "FORBIDDEN_ROLE",
      `Role ${role} does not hold required permission "${permission}".`
    );
  }
}

export function listPermissionsForRole(role: Role): readonly Permission[] {
  return ROLE_PERMISSIONS[role];
}
