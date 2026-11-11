import { NextResponse } from "next/server";
import { jsonErrorResponse } from "@/lib/errors";
import { verifySameOrigin } from "@/security/csrf";
import { enforceRateLimit, extractClientIpHash } from "@/security/rate-limit";
import { publicClaimSchema, submitPublicWarrantyClaim } from "@/services/claims";

export async function POST(
  request: Request,
  context: { params: Promise<{ brand: string }> }
) {
  try {
    verifySameOrigin(request);
    const { brand } = await context.params;
    const ipHash = extractClientIpHash(request);
    await enforceRateLimit({ bucket: "portal:claim", limit: 25, windowSeconds: 900 }, ipHash);

    const contentType = request.headers.get("content-type") ?? "";
    let rawInput: Record<string, unknown>;
    let evidenceFile: {
      fileName: string;
      mimeType: string;
      bytes: Buffer;
      kind: "RECEIPT" | "FAULT_PHOTO" | "SERIAL_PHOTO";
    } | null = null;

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      rawInput = {
        serialNumber: String(form.get("serialNumber") ?? ""),
        submittedByType: String(form.get("submittedByType") ?? "CUSTOMER"),
        customerName: String(form.get("customerName") ?? ""),
        customerEmail: String(form.get("customerEmail") ?? ""),
        customerPhone: String(form.get("customerPhone") ?? ""),
        shippingPinCode: String(form.get("shippingPinCode") ?? ""),
        shippingCity: String(form.get("shippingCity") ?? ""),
        shippingAddress: String(form.get("shippingAddress") ?? ""),
        faultCategory: String(form.get("faultCategory") ?? "BATTERY"),
        symptomSummary: String(form.get("symptomSummary") ?? ""),
        customerDescription: String(form.get("customerDescription") ?? ""),
        purchaseDate: String(form.get("purchaseDate") ?? ""),
      };

      const maybeFile = form.get("evidence");
      if (maybeFile instanceof File && maybeFile.size > 0) {
        const arr = await maybeFile.arrayBuffer();
        const kindRaw = String(form.get("evidenceKind") ?? "RECEIPT");
        const kind =
          kindRaw === "FAULT_PHOTO" || kindRaw === "SERIAL_PHOTO" ? kindRaw : "RECEIPT";
        evidenceFile = {
          fileName: maybeFile.name,
          mimeType: maybeFile.type || "application/octet-stream",
          bytes: Buffer.from(arr),
          kind,
        };
      }
    } else {
      rawInput = (await request.json()) as Record<string, unknown>;
    }

    const parsed = publicClaimSchema.parse(rawInput);
    const result = await submitPublicWarrantyClaim({
      brandSlug: brand,
      input: parsed,
      evidenceFile,
      ipHash,
    });

    return NextResponse.json(
      {
        ok: true,
        claimId: result.claim.id,
        claimNumber: result.claim.claimNumber,
        status: result.claim.status,
        duplicateSignals: result.claim.duplicateSignals,
        trackingToken: result.rawTrackingToken,
        trackingPath: result.trackingPath,
      },
      { status: 201 }
    );
  } catch (error) {
    return jsonErrorResponse(error);
  }
}
