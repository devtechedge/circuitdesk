import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiSession } from "@/auth/session";
import { jsonErrorResponse } from "@/lib/errors";
import { extractClientIpHash } from "@/security/rate-limit";
import {
  consumePartSchema,
  consumeSparePartOnRepair,
  listTenantRepairs,
  updateRepairBenchStage,
  updateRepairStageSchema,
} from "@/services/repairs";

const repairActionSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("stage"),
    repairId: z.string().uuid(),
    payload: updateRepairStageSchema,
  }),
  z.object({
    kind: z.literal("consume_part"),
    repairId: z.string().uuid(),
    payload: consumePartSchema,
  }),
]);

export async function GET(request: Request) {
  try {
    const session = await requireApiSession(request, "console:read");
    const repairs = await listTenantRepairs(session);
    return NextResponse.json({ repairs });
  } catch (error) {
    return jsonErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireApiSession(request, "repairs:execute");
    const ipHash = extractClientIpHash(request);
    const body = repairActionSchema.parse(await request.json());

    if (body.kind === "consume_part") {
      const res = await consumeSparePartOnRepair(session, body.repairId, body.payload, ipHash);
      revalidatePath(`/app/repairs/${body.repairId}`);
      revalidatePath("/app/inventory");
      return NextResponse.json({ ok: true, ...res });
    }

    const updated = await updateRepairBenchStage(session, body.repairId, body.payload, ipHash);
    revalidatePath(`/app/repairs/${body.repairId}`);
    revalidatePath("/app/repairs");
    revalidatePath("/app/claims");
    revalidatePath("/app/analytics");
    return NextResponse.json({ ok: true, repair: updated });
  } catch (error) {
    return jsonErrorResponse(error);
  }
}
