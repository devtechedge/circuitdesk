import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiSession } from "@/auth/session";
import { SERIAL_CSV_TEMPLATE } from "@/domain/serial-csv";
import { jsonErrorResponse } from "@/lib/errors";
import { extractClientIpHash } from "@/security/rate-limit";
import {
  createBatchSchema,
  createProductionBatch,
  listBatchesAndSerials,
  previewOrCommitSerialCsv,
} from "@/services/serials";

const serialMutationSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("batch"), payload: createBatchSchema }),
  z.object({
    kind: z.literal("csv"),
    csvText: z.string().min(5).max(500_000),
    dryRun: z.boolean().default(true),
  }),
]);

export async function GET(request: Request) {
  try {
    const session = await requireApiSession(request, "console:read");
    const url = new URL(request.url);
    if (url.searchParams.get("template") === "1") {
      return new NextResponse(SERIAL_CSV_TEMPLATE, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="circuitdesk-serials-template.csv"',
        },
      });
    }
    const batchId = url.searchParams.get("batchId") ?? undefined;
    const data = await listBatchesAndSerials(session, { batchId });
    return NextResponse.json(data);
  } catch (error) {
    return jsonErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireApiSession(request, "serials:write");
    const ipHash = extractClientIpHash(request);
    const body = serialMutationSchema.parse(await request.json());

    if (body.kind === "batch") {
      const batch = await createProductionBatch(session, body.payload, ipHash);
      revalidatePath("/app/serials");
      return NextResponse.json({ ok: true, batch }, { status: 201 });
    }

    const result = await previewOrCommitSerialCsv(session, {
      csvText: body.csvText,
      dryRun: body.dryRun,
      ipHash,
    });
    if (!body.dryRun) {
      revalidatePath("/app/serials");
      revalidatePath("/app/onboarding");
    }
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return jsonErrorResponse(error);
  }
}
