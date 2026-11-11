import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { withTenantDb } from "@/db/tenant";
import { products, serialUnits } from "@/db/schema";
import { jsonErrorResponse } from "@/lib/errors";
import { verifyBearerApiKey } from "@/security/api-keys";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const auth = await verifyBearerApiKey(request, "serials:read");

    const rows = await withTenantDb(auth.tenantId, async (tx) => {
      return tx
        .select({
          id: serialUnits.id,
          sku: products.sku,
          serialMasked: serialUnits.serialMasked,
          salesChannel: serialUnits.salesChannel,
          status: serialUnits.status,
          soldAt: serialUnits.soldAt,
          createdAt: serialUnits.createdAt,
        })
        .from(serialUnits)
        .innerJoin(products, eq(serialUnits.productId, products.id))
        .where(eq(serialUnits.tenantId, auth.tenantId))
        .orderBy(desc(serialUnits.createdAt))
        .limit(100);
    });

    return NextResponse.json({
      ok: true,
      tenantId: auth.tenantId,
      count: rows.length,
      serials: rows,
    });
  } catch (error) {
    return jsonErrorResponse(error);
  }
}
