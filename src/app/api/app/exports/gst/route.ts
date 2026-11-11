import { NextResponse } from "next/server";
import { requireApiSession } from "@/auth/session";
import { jsonErrorResponse } from "@/lib/errors";
import { extractClientIpHash } from "@/security/rate-limit";
import { buildTenantGstCsvExport } from "@/services/analytics";
import { recordAuditLog } from "@/services/audit";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const session = await requireApiSession(request, "exports:gst");
    const url = new URL(request.url);
    const type =
      url.searchParams.get("type") === "asc_reimbursements"
        ? "asc_reimbursements"
        : "oem_replacements";

    const exported = await buildTenantGstCsvExport(session, type);

    await recordAuditLog({
      tenantId: session.tenantId,
      actorUserId: session.userId,
      actorRole: session.role,
      action: "GST_CSV_EXPORTED",
      entityType: "GST_EXPORT",
      entityId: type,
      ipHash: extractClientIpHash(request),
      summary: `Exported India GST warranty CSV register (${type}).`,
    });

    return new NextResponse(exported.csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${exported.fileName}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return jsonErrorResponse(error);
  }
}
