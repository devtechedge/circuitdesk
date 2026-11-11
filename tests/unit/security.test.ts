import { describe, expect, it } from "vitest";
import { sanitizeNextPath, verifySameOrigin } from "@/security/csrf";
import { decryptSecret, encryptSecret } from "@/security/encryption";
import { hashPassword, verifyPassword } from "@/security/password";
import { assertPermission, hasPermission } from "@/security/rbac";
import { maskEmail, maskImei, maskSerialNumber } from "@/security/serial-mask";
import { generateOpaqueToken } from "@/security/tokens";
import {
  signTimestampedWebhook,
  verifyTimestampedHmacSignature,
} from "@/security/webhooks";

describe("security primitives", () => {
  it("hashes and verifies scrypt passwords in constant time", () => {
    const hash = hashPassword("Strong-Circuit-Pass-99!");
    expect(hash.startsWith("scrypt$")).toBe(true);
    expect(verifyPassword("Strong-Circuit-Pass-99!", hash)).toBe(true);
    expect(verifyPassword("Wrong-Circuit-Pass-99!", hash)).toBe(false);
  });

  it("encrypts secrets with AES-256-GCM and rejects guaranteed-mutated ciphertext", () => {
    const rawSecret = "shpss_live_connector_secret_key_991122";
    const { envelope, fingerprint, masked } = encryptSecret(rawSecret);

    expect(envelope).not.toContain(rawSecret);
    expect(fingerprint.startsWith("sha256:")).toBe(true);
    expect(masked).not.toContain("connector");
    expect(decryptSecret(envelope)).toBe(rawSecret);

    // Guaranteed-different tamper mutation (never constant-char no-op)
    const mutatedChar = envelope.endsWith("A") ? "B" : "A";
    const tampered = `${envelope.slice(0, -1)}${mutatedChar}`;
    expect(() => decryptSecret(tampered)).toThrow();
  });

  it("masks serials, IMEIs, and emails safely", () => {
    expect(maskSerialNumber("KNX-P2-2608-8901")).toBe("KNX-****8901");
    expect(maskImei("359881094401228")).toBe("35*********1228");
    expect(maskEmail("ananya.sharma@customer.demo")).toBe("an***@customer.demo");
  });

  it("enforces 7-role RBAC boundaries strictly", () => {
    expect(hasPermission("OWNER", "recall:approve")).toBe(true);
    expect(hasPermission("OPERATIONS", "claims:adjudicate")).toBe(true);
    expect(hasPermission("OPERATIONS", "recall:approve")).toBe(false);
    expect(hasPermission("TECHNICIAN", "repairs:execute")).toBe(true);
    expect(hasPermission("TECHNICIAN", "claims:adjudicate")).toBe(false);
    expect(hasPermission("ANALYST", "serial:unmask")).toBe(false);
    expect(hasPermission("READ_ONLY", "catalog:write")).toBe(false);
    expect(() => assertPermission("READ_ONLY", "billing:manage")).toThrow(/does not hold/i);
  });

  it("blocks CSRF cross-origin requests and open-redirect vectors", () => {
    expect(sanitizeNextPath("//evil.example/phish")).toBe("/app");
    expect(sanitizeNextPath("https://evil.example")).toBe("/app");
    expect(sanitizeNextPath("/\\evil.example")).toBe("/app");
    expect(sanitizeNextPath("/app/claims")).toBe("/app/claims");

    const badReq = new Request("https://circuitdesk.vercel.app/api/app/catalog", {
      method: "POST",
      headers: {
        host: "circuitdesk.vercel.app",
        origin: "https://attacker.example",
      },
    });
    expect(() => verifySameOrigin(badReq)).toThrow(/rejected/i);
  });

  it("verifies timestamped webhook HMACs and rejects expired replay windows", () => {
    const payload = JSON.stringify({ id: "evt_1", type: "invoice.payment_succeeded" });
    const secret = "whsec_test_secret_circuitdesk_32bytes_long";
    const ts = 1_760_000_000;
    const header = signTimestampedWebhook(payload, secret, ts);

    expect(() =>
      verifyTimestampedHmacSignature({
        payload,
        headerValue: header,
        secret,
        nowSec: ts + 60,
      })
    ).not.toThrow();

    expect(() =>
      verifyTimestampedHmacSignature({
        payload,
        headerValue: header,
        secret,
        nowSec: ts + 600, // > 300s tolerance
      })
    ).toThrow(/replay window/i);

    const tok = generateOpaqueToken("cd_cert");
    expect(tok.raw.startsWith("cd_cert_")).toBe(true);
    expect(tok.hash).toHaveLength(64);
  });
});
