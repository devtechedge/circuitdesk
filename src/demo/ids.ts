import { createHash } from "node:crypto";

/**
 * Deterministically derives a valid RFC 4122 v4-formatted UUID from a natural key.
 * Keeps demo entities stable across serverless instances and repeatable seeds.
 */
export function did(naturalKey: string): string {
  const hex = createHash("sha256").update(`circuitdesk-demo:${naturalKey}`).digest("hex");
  const p1 = hex.slice(0, 8);
  const p2 = hex.slice(8, 12);
  const p3 = `4${hex.slice(13, 16)}`;
  const variantNibble = ((parseInt(hex.slice(16, 17), 16) & 0x3) | 0x8).toString(16);
  const p4 = `${variantNibble}${hex.slice(17, 20)}`;
  const p5 = hex.slice(20, 32);
  return `${p1}-${p2}-${p3}-${p4}-${p5}`;
}

export function sha256Hex(input: string | Buffer): string {
  return createHash("sha256").update(input).digest("hex");
}

export const DEMO_CONSTANTS = {
  PASSWORD: "CircuitDesk-Demo-2026!",
  KINETIX_TENANT_ID: did("tenant:kinetix-audio"),
  KINETIX_BRAND_ID: did("brand:kinetix"),
  KINETIX_BRAND_SLUG: "kinetix",
  VOLTGRID_TENANT_ID: did("tenant:voltgrid-home"),
  VOLTGRID_BRAND_ID: did("brand:voltgrid"),
  VOLTGRID_BRAND_SLUG: "voltgrid",
  ACTIVE_CERT_TOKEN: "cd_cert_demo_kinetix_active_01",
  ACTIVE_TRACK_TOKEN: "cd_trk_demo_kinetix_repair_01",
  UNCLAIMED_SERIAL: "KNX-P2-2609-0018",
  OFFLINE_UNCLAIMED_SERIAL: "KNX-W1-2609-0042",
} as const;
