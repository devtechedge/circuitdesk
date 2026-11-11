import { computeAscGstSplit } from "./money";
import { escapeCsvCell } from "./serial-csv";

export interface OemWarrantyReplacementGstRow {
  claimNumber: string;
  rmaNumber: string;
  decidedDateIso: string;
  sku: string;
  hsnCode: string;
  defectiveSerialMasked: string;
  originalOrderRef: string | null;
  replacementCostMinor: number;
}

export interface AscReimbursementGstRow {
  jobNumber: string;
  completedDateIso: string;
  ascName: string;
  ascGstin: string | null;
  oemGstin: string | null;
  taxableMinor: number;
}

export function renderOemWarrantyReplacementGstCsv(
  rows: readonly OemWarrantyReplacementGstRow[]
): string {
  const header = [
    "claim_number",
    "rma_number",
    "decision_date_utc",
    "sku",
    "hsn_code",
    "defective_serial_masked",
    "original_order_ref",
    "internal_cogs_inr",
    "customer_taxable_value_inr",
    "gst_charged_inr",
    "itc_reversal_required",
    "cbic_circular_basis",
  ].join(",");

  const body = rows.map((r) =>
    [
      escapeCsvCell(r.claimNumber),
      escapeCsvCell(r.rmaNumber),
      escapeCsvCell(r.decidedDateIso),
      escapeCsvCell(r.sku),
      escapeCsvCell(r.hsnCode),
      escapeCsvCell(r.defectiveSerialMasked),
      escapeCsvCell(r.originalOrderRef ?? ""),
      escapeCsvCell((r.replacementCostMinor / 100).toFixed(2)),
      "0.00",
      "0.00",
      "NO",
      "CBIC Circular 195/07/2023-GST & 216/10/2024-GST",
    ].join(",")
  );

  return [header, ...body].join("\n");
}

export function renderAscReimbursementGstCsv(rows: readonly AscReimbursementGstRow[]): string {
  const header = [
    "job_number",
    "completion_date_utc",
    "asc_name",
    "asc_gstin",
    "oem_gstin",
    "sac_code",
    "supply_type",
    "taxable_value_inr",
    "cgst_9_pct_inr",
    "sgst_9_pct_inr",
    "igst_18_pct_inr",
    "gross_invoice_inr",
    "oem_itc_eligibility",
  ].join(",");

  const body = rows.map((r) => {
    const split = computeAscGstSplit({
      taxableMinor: r.taxableMinor,
      oemGstin: r.oemGstin,
      ascGstin: r.ascGstin,
    });
    return [
      escapeCsvCell(r.jobNumber),
      escapeCsvCell(r.completedDateIso),
      escapeCsvCell(r.ascName),
      escapeCsvCell(r.ascGstin ?? "UNREGISTERED"),
      escapeCsvCell(r.oemGstin ?? ""),
      "9987",
      split.supplyType,
      escapeCsvCell((split.taxableMinor / 100).toFixed(2)),
      escapeCsvCell((split.cgstMinor / 100).toFixed(2)),
      escapeCsvCell((split.sgstMinor / 100).toFixed(2)),
      escapeCsvCell((split.igstMinor / 100).toFixed(2)),
      escapeCsvCell((split.grossMinor / 100).toFixed(2)),
      "ELIGIBLE_SECTION_16_CGST",
    ].join(",");
  });

  return [header, ...body].join("\n");
}
