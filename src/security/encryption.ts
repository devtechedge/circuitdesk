import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { getEnv } from "@/env";

function resolveKey(): Buffer {
  const raw = getEnv().ENCRYPTION_KEY.trim();
  if (raw.length === 64 && /^[0-9a-fA-F]+$/.test(raw)) {
    return Buffer.from(raw, "hex");
  }
  const asBase64 = Buffer.from(raw, "base64");
  if (asBase64.length === 32) {
    return asBase64;
  }
  return createHash("sha256").update(raw, "utf8").digest();
}

export function encryptBuffer(plain: Buffer): string {
  const key = resolveKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64url")}:${tag.toString("base64url")}:${ciphertext.toString("base64url")}`;
}

export function decryptBuffer(envelope: string): Buffer {
  const parts = envelope.split(":");
  if (parts.length !== 3) {
    throw new Error("Malformed encrypted envelope.");
  }
  const [ivB64, tagB64, cipherB64] = parts;
  if (!ivB64 || !tagB64 || cipherB64 === undefined) {
    throw new Error("Malformed encrypted envelope segments.");
  }
  const key = resolveKey();
  const iv = Buffer.from(ivB64, "base64url");
  const tag = Buffer.from(tagB64, "base64url");
  const ciphertext = Buffer.from(cipherB64, "base64url");
  if (
    iv.toString("base64url") !== ivB64 ||
    tag.toString("base64url") !== tagB64 ||
    ciphertext.toString("base64url") !== cipherB64
  ) {
    throw new Error("Non-canonical base64url envelope rejected.");
  }
  if (iv.length !== 12 || tag.length !== 16) {
    throw new Error("Invalid AES-256-GCM IV or authentication tag length.");
  }
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

export function encryptSecret(plaintext: string): {
  envelope: string;
  fingerprint: string;
  masked: string;
} {
  const clean = plaintext.trim();
  const envelope = encryptBuffer(Buffer.from(clean, "utf8"));
  const fingerprint = `sha256:${createHash("sha256").update(clean, "utf8").digest("hex").slice(0, 12)}`;
  const masked =
    clean.length <= 6
      ? "******"
      : `${clean.slice(0, 3)}******${clean.slice(-3)}`;
  return { envelope, fingerprint, masked };
}

export function decryptSecret(envelope: string): string {
  return decryptBuffer(envelope).toString("utf8");
}
