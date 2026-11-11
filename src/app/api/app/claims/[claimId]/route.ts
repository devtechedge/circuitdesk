import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { requireApiSession } from "@/auth/session";
import { assertValidUuid } from "@/db/tenant";
import { jsonErrorResponse } from "@/lib/errors";
import { extractClientIpHash } from "@/security/rate-limit";
import { generateClaimTriageSummary } from "@/services/ai-triage";
import {
  adjudicateClaimByHuman,
  getTenantClaimDetail,
  humanAdjudicationSchema,
} from "@/services/claims";

export async function GET(
  request: Request,
  context: { params: Promise<{ claimId: string }> }
) {
  try {
    const session = await requireApiSession(request, "console:read");
    const { claimId } = await context.params;
    assertValidUuid(claimId, "claimId");
    const detail = await getTenantClaimDetail(session, claimId);
    return NextResponse.json(detail);
  } catch (error) {
    return jsonErrorResponse(error);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ claimId: string }> }
) {
  try {
    const session = await requireApiSession(request, "claims:adjudicate");
    const { claimId } = await context.params;
    assertValidUuid(claimId, "claimId");
    const ipHash = extractClientIpHash(request);

    const payload = (await request.json()) as Record<string, unknown>;
    if (payload.kind === "ai_summary") {
      const summary = await generateClaimTriageSummary(session, claimId, ipHash);
      revalidatePath(`/app/claims/${claimId}`);
      return NextResponse.json({ ok: true, aiSummary: summary });
    }

    const parsed = humanAdjudicationSchema.parse(payload);
    const result = await adjudicateClaimByHuman(session, claimId, parsed, ipHash);
    revalidatePath(`/app/claims/${claimId}`);
    revalidatePath("/app/claims");
    revalidatePath("/app/repairs");
    revalidatePath("/app/analytics");
    revalidatePath("/app");
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return jsonErrorResponse(error);
  }
}
