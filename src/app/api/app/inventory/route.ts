import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiSession } from "@/auth/session";
import { jsonErrorResponse } from "@/lib/errors";
import { extractClientIpHash } from "@/security/rate-limit";
import {
  createOrRestockSparePart,
  createServiceCentre,
  createServiceCentreSchema,
  createSparePartSchema,
  listServiceNetworkAndInventory,
} from "@/services/inventory";
import { listTenantRmas, updateRmaDisposition, updateRmaSchema } from "@/services/rma";

const inventoryActionSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("centre"), payload: createServiceCentreSchema }),
  z.object({ kind: z.literal("part"), payload: createSparePartSchema }),
  z.object({ kind: z.literal("rma"), payload: updateRmaSchema }),
]);

export async function GET(request: Request) {
  try {
    const session = await requireApiSession(request, "console:read");
    const [network, rmas] = await Promise.all([
      listServiceNetworkAndInventory(session),
      listTenantRmas(session),
    ]);
    return NextResponse.json({ ...network, rmas });
  } catch (error) {
    return jsonErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireApiSession(request, "inventory:write");
    const ipHash = extractClientIpHash(request);
    const body = inventoryActionSchema.parse(await request.json());

    if (body.kind === "centre") {
      const centre = await createServiceCentre(session, body.payload, ipHash);
      revalidatePath("/app/service-network");
      revalidatePath("/app/inventory");
      return NextResponse.json({ ok: true, centre }, { status: 201 });
    }

    if (body.kind === "part") {
      const part = await createOrRestockSparePart(session, body.payload, ipHash);
      revalidatePath("/app/inventory");
      return NextResponse.json({ ok: true, part }, { status: 201 });
    }

    const rma = await updateRmaDisposition(session, body.payload, ipHash);
    revalidatePath("/app/inventory");
    revalidatePath("/app/repairs");
    return NextResponse.json({ ok: true, rma });
  } catch (error) {
    return jsonErrorResponse(error);
  }
}
