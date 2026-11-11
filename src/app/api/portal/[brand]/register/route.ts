import { NextResponse } from "next/server";
import { jsonErrorResponse } from "@/lib/errors";
import { verifySameOrigin } from "@/security/csrf";
import { enforceRateLimit, extractClientIpHash } from "@/security/rate-limit";
import {
  publicRegistrationSchema,
  submitPublicWarrantyRegistration,
} from "@/services/registrations";

export async function POST(
  request: Request,
  context: { params: Promise<{ brand: string }> }
) {
  try {
    verifySameOrigin(request);
    const { brand } = await context.params;
    const ipHash = extractClientIpHash(request);
    await enforceRateLimit({ bucket: "portal:register", limit: 30, windowSeconds: 900 }, ipHash);

    const body = publicRegistrationSchema.parse(await request.json());
    const result = await submitPublicWarrantyRegistration({
      brandSlug: brand,
      input: body,
      ipHash,
    });

    return NextResponse.json(
      {
        ok: true,
        registrationNumber: result.registration.registrationNumber,
        status: result.registration.status,
        coverageEndDate: result.registration.coverageEndDate.toISOString(),
        certificateToken: result.rawCertificateToken,
        certificatePath: result.certificatePath,
      },
      { status: 201 }
    );
  } catch (error) {
    return jsonErrorResponse(error);
  }
}
