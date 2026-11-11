import type { CurrencyCode } from "@/db/schema";

export function assertSafeMinor(amountMinor: number, label = "amountMinor"): number {
  if (!Number.isSafeInteger(amountMinor)) {
    throw new Error(`${label} must be an integer in minor currency units.`);
  }
  return amountMinor;
}

export function addMinor(a: number, b: number): number {
  return assertSafeMinor(assertSafeMinor(a) + assertSafeMinor(b));
}

export function sumMinor(values: readonly number[]): number {
  let total = 0;
  for (const val of values) {
    total = addMinor(total, val);
  }
  return total;
}

export function majorToMinor(majorAmount: number): number {
  if (!Number.isFinite(majorAmount) || majorAmount < 0) {
    throw new Error("Monetary input must be a non-negative finite number.");
  }
  return Math.round(majorAmount * 100);
}

export function formatMoneyMinor(
  amountMinor: number,
  currency: CurrencyCode,
  options?: { compactZeroDecimals?: boolean }
): string {
  assertSafeMinor(amountMinor);
  const major = amountMinor / 100;
  const hasSubunits = Math.abs(amountMinor) % 100 !== 0;
  const fractionDigits = options?.compactZeroDecimals && !hasSubunits ? 0 : 2;
  const locale = currency === "INR" ? "en-IN" : "en-US";

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: 2,
  }).format(major);
}

export interface IndianGstSplit {
  taxableMinor: number;
  cgstMinor: number;
  sgstMinor: number;
  igstMinor: number;
  totalGstMinor: number;
  grossMinor: number;
  supplyType: "INTRA_STATE" | "INTER_STATE";
}

/**
 * Computes 18% GST split for B2B Authorised Service Centre (ASC) repair invoices
 * (SAC 9987) per CBIC Circular No. 195/07/2023-GST by comparing 2-digit GSTIN state codes.
 */
export function computeAscGstSplit(params: {
  taxableMinor: number;
  oemGstin?: string | null;
  ascGstin?: string | null;
  gstRateBps?: number; // default 1800 = 18.00%
}): IndianGstSplit {
  assertSafeMinor(params.taxableMinor, "taxableMinor");
  const rateBps = params.gstRateBps ?? 1800;
  const oemState = params.oemGstin?.trim().slice(0, 2) || "";
  const ascState = params.ascGstin?.trim().slice(0, 2) || "";
  const isIntra = oemState.length === 2 && oemState === ascState;

  const totalGstMinor = Math.round((params.taxableMinor * rateBps) / 10_000);
  if (isIntra) {
    const cgstMinor = Math.floor(totalGstMinor / 2);
    const sgstMinor = totalGstMinor - cgstMinor;
    return {
      taxableMinor: params.taxableMinor,
      cgstMinor,
      sgstMinor,
      igstMinor: 0,
      totalGstMinor,
      grossMinor: params.taxableMinor + totalGstMinor,
      supplyType: "INTRA_STATE",
    };
  }

  return {
    taxableMinor: params.taxableMinor,
    cgstMinor: 0,
    sgstMinor: 0,
    igstMinor: totalGstMinor,
    totalGstMinor,
    grossMinor: params.taxableMinor + totalGstMinor,
    supplyType: "INTER_STATE",
  };
}
