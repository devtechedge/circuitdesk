import { count, eq } from "drizzle-orm";
import type { AuthenticatedSession } from "@/auth/session";
import type { Database } from "@/db/client";
import { withTenantDb } from "@/db/tenant";
import {
  brands,
  invitations,
  memberships,
  products,
  serialUnits,
  tenants,
  warrantyClaims,
  warrantyPolicies,
} from "@/db/schema";

export interface OnboardingStepStatus {
  key: "brand" | "product_policy" | "serials" | "portal" | "team" | "test_claim";
  title: string;
  description: string;
  href: string;
  completed: boolean;
}

export async function getOnboardingStatus(
  session: AuthenticatedSession,
  dbOverride?: Database
): Promise<{
  steps: OnboardingStepStatus[];
  completedCount: number;
  totalCount: number;
  primaryBrandSlug: string | null;
}> {
  return withTenantDb(
    session.tenantId,
    async (tx) => {
      const [tenantRow] = await tx
        .select()
        .from(tenants)
        .where(eq(tenants.id, session.tenantId))
        .limit(1);

      const brandRows = await tx
        .select({ slug: brands.slug })
        .from(brands)
        .where(eq(brands.tenantId, session.tenantId));

      const [prodCount] = await tx
        .select({ n: count() })
        .from(products)
        .where(eq(products.tenantId, session.tenantId));

      const [polCount] = await tx
        .select({ n: count() })
        .from(warrantyPolicies)
        .where(eq(warrantyPolicies.tenantId, session.tenantId));

      const [serialCount] = await tx
        .select({ n: count() })
        .from(serialUnits)
        .where(eq(serialUnits.tenantId, session.tenantId));

      const [memberCount] = await tx
        .select({ n: count() })
        .from(memberships)
        .where(eq(memberships.tenantId, session.tenantId));

      const [inviteCount] = await tx
        .select({ n: count() })
        .from(invitations)
        .where(eq(invitations.tenantId, session.tenantId));

      const [claimCount] = await tx
        .select({ n: count() })
        .from(warrantyClaims)
        .where(eq(warrantyClaims.tenantId, session.tenantId));

      const manualDone = new Set(tenantRow?.onboardingCompletedSteps ?? []);
      const primaryBrandSlug = brandRows[0]?.slug ?? null;

      const steps: OnboardingStepStatus[] = [
        {
          key: "brand",
          title: "1. Configure Brand Identity",
          description: "Set public portal slug, support email, and accent token.",
          href: "/app/settings",
          completed: brandRows.length > 0 || manualDone.has("brand"),
        },
        {
          key: "product_policy",
          title: "2. Add Hardware SKU & Warranty Policy",
          description: "Define HSN code, replacement cost, coverage months, and DOA window.",
          href: "/app/products",
          completed:
            ((prodCount?.n ?? 0) > 0 && (polCount?.n ?? 0) > 0) ||
            manualDone.has("product_policy"),
        },
        {
          key: "serials",
          title: "3. Import Serial / Batch Registry & Print QR Sheet",
          description: "Upload serialized units via CSV preview and print packaging QR labels.",
          href: "/app/serials",
          completed: (serialCount?.n ?? 0) > 0 || manualDone.has("serials"),
        },
        {
          key: "portal",
          title: "4. Preview Branded Customer Portal",
          description: "Open your zero-account customer registration & claim surface.",
          href: primaryBrandSlug ? `/w/${primaryBrandSlug}/register` : "/app/settings",
          completed: manualDone.has("portal") || brandRows.length > 0,
        },
        {
          key: "team",
          title: "5. Invite Support or Bench Teammate",
          description: "Assign Support, Operations, or Service Bench Technician RBAC roles.",
          href: "/app/team",
          completed:
            (memberCount?.n ?? 0) > 1 ||
            (inviteCount?.n ?? 0) > 0 ||
            manualDone.has("team"),
        },
        {
          key: "test_claim",
          title: "6. Run Test Warranty Claim & Triage",
          description: "Submit a claim on a registered serial and walk through human triage.",
          href: "/app/claims",
          completed: (claimCount?.n ?? 0) > 0 || manualDone.has("test_claim"),
        },
      ];

      const completedCount = steps.filter((s) => s.completed).length;
      return {
        steps,
        completedCount,
        totalCount: steps.length,
        primaryBrandSlug,
      };
    },
    dbOverride
  );
}
