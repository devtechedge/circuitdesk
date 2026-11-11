import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { dbSource, getDb } from "@/db/client";
import { getProviderCapabilities, isDemoMode } from "@/env";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = await getDb();
    await db.execute(sql`SELECT 1`);
    const capabilities = getProviderCapabilities();

    return NextResponse.json(
      {
        status: "ok",
        service: "circuitdesk",
        db: dbSource(),
        demoMode: isDemoMode(),
        commitSha: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? "local",
        providers: {
          stripe: capabilities.stripe ? "live" : "non-charging-demo",
          razorpay: capabilities.razorpay ? "live" : "non-charging-demo",
          email: capabilities.emailLive ? "live" : "dev-sink",
          whatsapp: capabilities.whatsappLive ? "live-meta-api" : "dev-sink",
          aiTriage: capabilities.aiLive ? "openai-compatible" : "deterministic-fallback",
        },
        checkedAt: new Date().toISOString(),
      },
      {
        status: 200,
        headers: { "Cache-Control": "no-store, max-age=0" },
      }
    );
  } catch {
    return NextResponse.json(
      { status: "degraded", service: "circuitdesk" },
      { status: 503, headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  }
}
