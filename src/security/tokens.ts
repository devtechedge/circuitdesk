import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { getEnv } from "@/env";

export type TokenPrefix = "cd_sess" | "cd_cert" | "cd_trk" | "cd_live" | "cd_inv";

export function generateOpaqueToken(prefix: TokenPrefix): {
  raw: string;
  hash: string;
  preview: string;
} {
  const secretPart = randomBytes(24).toString("base64url");
  const raw = `${prefix}_${secretPart}`;
  return {
    raw,
    hash: hashToken(raw),
    preview: `${raw.slice(0, 12)}...${raw.slice(-5)}`,
  };
}

export function hashToken(raw: string): string {
  return createHash("sha256").update(raw, "utf8").digest("hex");
}

export function hashIpAddress(ip: string | null | undefined): string {
  const clean = (ip ?? "unknown").split(",")[0]?.trim() || "unknown";
  return createHmac("sha256", getEnv().AUTH_SECRET)
    .update(`ip:${clean}`)
    .digest("hex")
    .slice(0, 24);
}

export function constantTimeHexEquals(aHex: string, bHex: string): boolean {
  if (aHex.length !== bHex.length || aHex.length % 2 !== 0) return false;
  try {
    const a = Buffer.from(aHex, "hex");
    const b = Buffer.from(bHex, "hex");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function constantTimeStringEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
