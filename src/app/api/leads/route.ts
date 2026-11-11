import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db/client";
import { marketingLeads } from "@/db/schema";
import { jsonErrorResponse } from "@/lib/errors";
import { verifySameOrigin } from "@/security/csrf";
import { enforceRateLimit, extractClientIpHash } from "@/security/rate-limit";

const leadSchema = z.object({
  kind: z.enum(["DEMO_REQUEST", "CONTACT", "MIGRATION_HELP"]).default("DEMO_REQUEST"),
  name: z.string().trim().min(2).max(100),
  workEmail: z.string().trim().email().max(160),
  company: z.string().trim().min(2).max(120),
  monthlyUnitsBand: z.string().trim().min(2).max(60),
  channels: z.string().trim().min(2).max(160),
  message: z.string().trim().max(1500).default(""),
});

export async function POST(request: Request) {
  try {
    verifySameOrigin(request);
    const ipHash = extractClientIpHash(request);
    await enforceRateLimit({ bucket: "public:lead", limit: 20, windowSeconds: 900 }, ipHash);

    const parsed = leadSchema.parse(await request.json());
    const db = await getDb();

    const [created] = await db
      .insert(marketingLeads)
      .values({
        kind: parsed.kind,
        name: parsed.name,
        workEmail: parsed.workEmail.toLowerCase(),
        company: parsed.company,
        monthlyUnitsBand: parsed.monthlyUnitsBand,
        channels: parsed.channels,
        message: parsed.message,
        ipHash,
      })
      .returning({ id: marketingLeads.id });

    return NextResponse.json({ ok: true, leadId: created!.id }, { status: 201 });
  } catch (error) {
    return jsonErrorResponse(error);
  }
}
