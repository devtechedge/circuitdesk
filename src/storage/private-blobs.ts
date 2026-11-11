import { createHash, createHmac, randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { getEnv } from "@/env";
import { getDb, type Database, type DbExecutor } from "@/db/client";
import { claimEvidence, privateBlobs } from "@/db/schema";
import { AppError } from "@/lib/errors";
import { decryptBuffer, encryptBuffer } from "@/security/encryption";
import { constantTimeHexEquals } from "@/security/tokens";

export const MAX_EVIDENCE_BYTES = 4 * 1024 * 1024; // 4 MB (under Vercel 4.5 MB limit)

const ALLOWED_UPLOAD_MIMES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/pdf",
]);

function matchesMagicBytes(mime: string, bytes: Buffer): boolean {
  if (bytes.length < 8) return false;
  if (mime === "image/png") {
    return (
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47
    );
  }
  if (mime === "image/jpeg") {
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (mime === "image/webp") {
    return (
      bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
      bytes.subarray(8, 12).toString("ascii") === "WEBP"
    );
  }
  if (mime === "application/pdf") {
    return bytes.subarray(0, 5).toString("ascii") === "%PDF-";
  }
  return false;
}

export function sanitizeFileName(name: string): string {
  const cleaned = name
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_{2,}/g, "_")
    .slice(0, 80);
  return cleaned || "evidence.bin";
}

export async function storePrivateEvidence(
  params: {
    tenantId: string;
    claimId?: string | null;
    registrationId?: string | null;
    kind: "RECEIPT" | "FAULT_PHOTO" | "SERIAL_PHOTO" | "BENCH_INSPECTION";
    fileName: string;
    mimeType: string;
    bytes: Buffer;
    uploadedBy: string;
  },
  executor?: DbExecutor
): Promise<{ evidenceId: string; sha256Hex: string; byteSize: number }> {
  if (params.bytes.byteLength === 0) {
    throw new AppError(422, "EMPTY_FILE", "Uploaded evidence file is empty.");
  }
  if (params.bytes.byteLength > MAX_EVIDENCE_BYTES) {
    throw new AppError(422, "FILE_TOO_LARGE", "Evidence upload exceeds the 4 MB maximum.");
  }
  if (!ALLOWED_UPLOAD_MIMES.has(params.mimeType)) {
    throw new AppError(
      422,
      "UNSUPPORTED_MIME",
      "Allowed evidence formats are PNG, JPEG, WebP, and PDF."
    );
  }
  if (!matchesMagicBytes(params.mimeType, params.bytes)) {
    throw new AppError(
      422,
      "FILE_HEADER_MISMATCH",
      "Uploaded file content does not match declared file format."
    );
  }

  const db = executor ?? (await getDb());
  const sha256Hex = createHash("sha256").update(params.bytes).digest("hex");
  const storageKey = `tenant/${params.tenantId}/${randomUUID()}`;
  const encryptedEnvelope = encryptBuffer(params.bytes);

  await db.insert(privateBlobs).values({
    storageKey,
    tenantId: params.tenantId,
    mimeType: params.mimeType,
    byteSize: params.bytes.byteLength,
    sha256Hex,
    encryptedEnvelope,
  });

  const inserted = await db
    .insert(claimEvidence)
    .values({
      tenantId: params.tenantId,
      claimId: params.claimId ?? null,
      registrationId: params.registrationId ?? null,
      kind: params.kind,
      fileName: sanitizeFileName(params.fileName),
      mimeType: params.mimeType,
      byteSize: params.bytes.byteLength,
      sha256Hex,
      storageKey,
      uploadedBy: params.uploadedBy.slice(0, 120),
    })
    .returning({ id: claimEvidence.id });

  const row = inserted[0];
  if (!row) {
    throw new AppError(500, "EVIDENCE_STORE_FAILED", "Failed to store evidence record.");
  }

  return { evidenceId: row.id, sha256Hex, byteSize: params.bytes.byteLength };
}

export function createSignedEvidenceUrl(params: {
  tenantId: string;
  evidenceId: string;
  ttlSeconds?: number;
}): string {
  const exp = Math.floor(Date.now() / 1000) + (params.ttlSeconds ?? 600);
  const sig = createHmac("sha256", getEnv().FILE_SIGNING_SECRET)
    .update(`${params.tenantId}:${params.evidenceId}:${exp}`, "utf8")
    .digest("hex");
  return `/api/evidence/${encodeURIComponent(params.evidenceId)}?tid=${encodeURIComponent(
    params.tenantId
  )}&exp=${exp}&sig=${sig}`;
}

export function verifySignedEvidenceParams(params: {
  tenantId: string;
  evidenceId: string;
  expRaw: string | null;
  sigRaw: string | null;
  nowSec?: number;
}): boolean {
  const { tenantId, evidenceId, expRaw, sigRaw, nowSec = Math.floor(Date.now() / 1000) } = params;
  if (!expRaw || !sigRaw) return false;
  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || exp < nowSec) return false;
  const expected = createHmac("sha256", getEnv().FILE_SIGNING_SECRET)
    .update(`${tenantId}:${evidenceId}:${exp}`, "utf8")
    .digest("hex");
  return constantTimeHexEquals(sigRaw, expected);
}

export async function readDecryptedEvidence(
  params: { tenantId: string; evidenceId: string },
  dbOverride?: Database
): Promise<{
  fileName: string;
  mimeType: string;
  sha256Hex: string;
  bytes: Buffer;
}> {
  const db = dbOverride ?? (await getDb());
  const rows = await db
    .select({
      fileName: claimEvidence.fileName,
      mimeType: claimEvidence.mimeType,
      sha256Hex: claimEvidence.sha256Hex,
      encryptedEnvelope: privateBlobs.encryptedEnvelope,
    })
    .from(claimEvidence)
    .innerJoin(privateBlobs, eq(claimEvidence.storageKey, privateBlobs.storageKey))
    .where(
      and(
        eq(claimEvidence.id, params.evidenceId),
        eq(claimEvidence.tenantId, params.tenantId),
        eq(privateBlobs.tenantId, params.tenantId)
      )
    )
    .limit(1);

  const row = rows[0];
  if (!row) {
    throw new AppError(404, "EVIDENCE_NOT_FOUND", "Evidence attachment not found.");
  }

  const bytes = decryptBuffer(row.encryptedEnvelope);
  return {
    fileName: row.fileName,
    mimeType: row.mimeType,
    sha256Hex: row.sha256Hex,
    bytes,
  };
}
