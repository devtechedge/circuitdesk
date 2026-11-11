import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiSession } from "@/auth/session";
import { jsonErrorResponse } from "@/lib/errors";
import { extractClientIpHash } from "@/security/rate-limit";
import {
  createBrand,
  createBrandSchema,
  createPolicySchema,
  createProduct,
  createProductSchema,
  createWarrantyPolicy,
  listCatalogOverview,
} from "@/services/catalog";

const catalogMutationSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("brand"), payload: createBrandSchema }),
  z.object({ kind: z.literal("product"), payload: createProductSchema }),
  z.object({ kind: z.literal("policy"), payload: createPolicySchema }),
]);

export async function GET(request: Request) {
  try {
    const session = await requireApiSession(request, "console:read");
    const data = await listCatalogOverview(session);
    return NextResponse.json(data);
  } catch (error) {
    return jsonErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireApiSession(request, "catalog:write");
    const ipHash = extractClientIpHash(request);
    const body = catalogMutationSchema.parse(await request.json());

    if (body.kind === "brand") {
      const created = await createBrand(session, body.payload, ipHash);
      revalidatePath("/app/products");
      revalidatePath("/app/onboarding");
      return NextResponse.json({ ok: true, brand: created }, { status: 201 });
    }

    if (body.kind === "product") {
      const created = await createProduct(session, body.payload, ipHash);
      revalidatePath("/app/products");
      revalidatePath("/app/serials");
      return NextResponse.json({ ok: true, product: created }, { status: 201 });
    }

    const created = await createWarrantyPolicy(session, body.payload, ipHash);
    revalidatePath("/app/products");
    revalidatePath("/app/onboarding");
    return NextResponse.json({ ok: true, policy: created }, { status: 201 });
  } catch (error) {
    return jsonErrorResponse(error);
  }
}
