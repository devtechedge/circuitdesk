import { eq } from "drizzle-orm";
import { getDb, type Database } from "@/db/client";
import { rateLimits } from "@/db/schema";
import { AppError } from "@/lib/errors";
import { hashIpAddress } from "./tokens";

export interface RateLimitPolicy {
  bucket: string;
  limit: number;
  windowSeconds: number;
}

export async function enforceRateLimit(
  policy: RateLimitPolicy,
  identifier: string,
  dbOverride?: Database
): Promise<void> {
  const db = dbOverride ?? (await getDb());
  const key = `${policy.bucket}:${identifier}`;
  const now = new Date();
  const cutoff = new Date(now.getTime() - policy.windowSeconds * 1000);

  const existing = await db.select().from(rateLimits).where(eq(rateLimits.key, key)).limit(1);
  const row = existing[0];

  if (!row || row.windowStart < cutoff) {
    await db
      .insert(rateLimits)
      .values({ key, count: 1, windowStart: now, updatedAt: now })
      .onConflictDoUpdate({
        target: rateLimits.key,
        set: { count: 1, windowStart: now, updatedAt: now },
      });
    return;
  }

  if (row.count >= policy.limit) {
    throw new AppError(
      429,
      "RATE_LIMITED",
      "Too many requests for this action. Please wait briefly and try again."
    );
  }

  await db
    .update(rateLimits)
    .set({ count: row.count + 1, updatedAt: now })
    .where(eq(rateLimits.key, key));
}

export function extractClientIpHash(request: Request): string {
  const raw =
    request.headers.get("x-vercel-forwarded-for") ??
    request.headers.get("x-forwarded-for") ??
    request.headers.get("x-real-ip") ??
    "local";
  return hashIpAddress(raw);
}
