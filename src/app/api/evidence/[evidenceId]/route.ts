import { NextResponse } from "next/server";
import { getCurrentSession } from "@/auth/session";
import { assertValidUuid } from "@/db/tenant";
import { AppError, jsonErrorResponse } from "@/lib/errors";
import {
  readDecryptedEvidence,
  verifySignedEvidenceParams,
} from "@/storage/private-blobs";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ evidenceId: string }> }
) {
  try {
    const { evidenceId } = await context.params;
    assertValidUuid(evidenceId, "evidenceId");

    const url = new URL(request.url);
    const tidParam = url.searchParams.get("tid");
    const expParam = url.searchParams.get("exp");
    const sigParam = url.searchParams.get("sig");

    let authorizedTenantId: string | null = null;

    if (
      tidParam &&
      verifySignedEvidenceParams({
        tenantId: tidParam,
        evidenceId,
        expRaw: expParam,
        sigRaw: sigParam,
      })
    ) {
      authorizedTenantId = tidParam;
    } else {
      const session = await getCurrentSession();
      if (!session) {
        throw new AppError(
          401,
          "EVIDENCE_AUTH_REQUIRED",
          "Valid operator session or expiring signed URL required."
        );
      }
      authorizedTenantId = session.tenantId;
    }

    const file = await readDecryptedEvidence({
      tenantId: authorizedTenantId,
      evidenceId,
    });

    return new NextResponse(new Uint8Array(file.bytes), {
      status: 200,
      headers: {
        "Content-Type": file.mimeType,
        "Content-Length": String(file.bytes.byteLength),
        "Content-Disposition": `attachment; filename="${file.fileName}"`,
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  } catch (error) {
    return jsonErrorResponse(error);
  }
}
