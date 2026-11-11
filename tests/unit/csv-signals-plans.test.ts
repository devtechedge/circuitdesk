import { describe, expect, it } from "vitest";
import { evaluateClaimSignals } from "@/domain/claim-signals";
import {
  renderAscReimbursementGstCsv,
  renderOemWarrantyReplacementGstCsv,
} from "@/domain/gst-export";
import {
  computePaidRecurringMrrMinor,
  estimateMonthlyWithOveragesMinor,
  TARGET_2K_MRR_SCENARIOS,
} from "@/domain/plans";
import { renderRegistrationQrSvg } from "@/domain/qr-svg";
import { previewSerialCsvImport } from "@/domain/serial-csv";

describe("domain/serial-csv & qr-svg", () => {
  it("flags unknown SKUs, intra-file duplicates, existing serials, bad IMEIs, and formula injection", () => {
    const csv = [
      "sku,serial_number,imei,batch_code,sales_channel,external_order_id,sold_at",
      "KNX-ANC-PRO2,KNX-GOOD-0001,,BATCH-1,D2C_WEB,ORD-1,2026-11-01",
      "KNX-ANC-PRO2,KNX-GOOD-0001,,BATCH-1,D2C_WEB,ORD-2,2026-11-01",
      "UNKNOWN-SKU,KNX-GOOD-0002,,BATCH-1,D2C_WEB,ORD-3,2026-11-01",
      "KNX-ANC-PRO2,KNX-EXISTING-01,,BATCH-1,D2C_WEB,ORD-4,2026-11-01",
      "KNX-ANC-PRO2,KNX-BAD-IMEI,12345,BATCH-1,D2C_WEB,ORD-5,2026-11-01",
      "KNX-ANC-PRO2,=CMD|' /C calc'!A0,,BATCH-1,D2C_WEB,ORD-6,2026-11-01",
    ].join("\n");

    const preview = previewSerialCsvImport({
      csvText: csv,
      knownSkus: new Set(["KNX-ANC-PRO2"]),
      existingSerials: new Set(["KNX-EXISTING-01"]),
    });

    expect(preview.totalRows).toBe(6);
    expect(preview.validRows).toHaveLength(1);
    expect(preview.validRows[0]?.serialNumber).toBe("KNX-GOOD-0001");
    expect(preview.errors).toHaveLength(5);
    expect(preview.errors.some((e) => /formula/i.test(e.reason))).toBe(true);
    expect(preview.errors.some((e) => /IMEI/i.test(e.reason))).toBe(true);
  });

  it("renders valid offline SVG QR codes with registration prefill URL", async () => {
    const qr = await renderRegistrationQrSvg({
      baseUrl: "https://circuitdesk.vercel.app",
      brandSlug: "kinetix",
      serialNumber: "KNX-P2-2609-0018",
      sku: "KNX-ANC-PRO2",
    });
    expect(qr.targetUrl).toBe(
      "https://circuitdesk.vercel.app/w/kinetix/register?serial=KNX-P2-2609-0018&sku=KNX-ANC-PRO2&source=qr"
    );
    expect(qr.svgMarkup).toContain("<svg");
  });
});

describe("domain/claim-signals, plans/MRR & GST CSV exports", () => {
  it("flags duplicate active claims, out-of-window dates, and velocity without auto-rejecting", () => {
    const signals = evaluateClaimSignals({
      policySnapshot: {
        policyId: "p1",
        policyName: "Standard",
        durationMonths: 12,
        doaWindowDays: 7,
        repairExtensionMonths: 0,
        coveredFaults: ["BATTERY"],
        withinCoverageWindow: false,
        withinDoaWindow: false,
        faultCoveredByPolicy: false,
      },
      openClaimsOnSameSerial: 1,
      priorResolvedClaimsOnSameSerial: 1,
      recentClaimsFromSameEmail30d: 4,
      registrationStatus: "PENDING_REVIEW",
    });

    const codes = signals.map((s) => s.code);
    expect(codes).toContain("DUPLICATE_ACTIVE_CLAIM");
    expect(codes).toContain("OUT_OF_COVERAGE_WINDOW");
    expect(codes).toContain("UNCOVERED_FAULT_CATEGORY");
    expect(codes).toContain("PENDING_OFFLINE_REGISTRATION");
    expect(codes).toContain("RAPID_CONTACT_VELOCITY");
  });

  it("computes MRR strictly from active paid non-demo recurring subscriptions and verifies $2K scenarios", () => {
    const mrrCents = computePaidRecurringMrrMinor(
      [
        {
          status: "ACTIVE",
          isNonChargingDemo: false,
          provider: "STRIPE",
          monthlyAmountMinor: 12900,
          billingCurrency: "USD",
        },
        {
          status: "TRIALING",
          isNonChargingDemo: false,
          provider: "STRIPE",
          monthlyAmountMinor: 12900,
          billingCurrency: "USD",
        },
        {
          status: "ACTIVE",
          isNonChargingDemo: true,
          provider: "DEMO",
          monthlyAmountMinor: 29900,
          billingCurrency: "USD",
        },
      ],
      "USD"
    );
    expect(mrrCents).toBe(12900);

    expect(16 * 129).toBe(TARGET_2K_MRR_SCENARIOS[0]!.mrrUsd); // $2,064
    expect(7 * 299).toBe(TARGET_2K_MRR_SCENARIOS[1]!.mrrUsd); // $2,093

    const est = estimateMonthlyWithOveragesMinor({
      planCode: "STARTER",
      currency: "INR",
      expectedRegistrations: 600, // +100 over 500
      expectedClaims: 60, // +10 over 50
    });
    expect(est.baseMinor).toBe(399900);
    expect(est.regOverageMinor).toBe(100 * 600);
    expect(est.claimOverageMinor).toBe(10 * 4500);
    expect(est.indianGst18Minor).toBeGreaterThan(0);
  });

  it("renders CBIC 195/2023 zero-GST OEM replacement and SAC 9987 ASC reimbursement CSVs", () => {
    const oemCsv = renderOemWarrantyReplacementGstCsv([
      {
        claimNumber: "CLM-1",
        rmaNumber: "RMA-1",
        decidedDateIso: "2026-11-06T00:00:00.000Z",
        sku: "KNX-GAN-100W",
        hsnCode: "85044030",
        defectiveSerialMasked: "KNX-****1105",
        originalOrderRef: "SHP-IN-10819",
        replacementCostMinor: 112000,
      },
    ]);
    expect(oemCsv).toContain("0.00,0.00,NO,CBIC Circular 195/07/2023-GST");

    const ascCsv = renderAscReimbursementGstCsv([
      {
        jobNumber: "JOB-BLR-1",
        completedDateIso: "2026-11-09T00:00:00.000Z",
        ascName: "ElectroFix BLR",
        ascGstin: "29AAFCE3310K1Z4",
        oemGstin: "27AABCK9401L1Z8",
        taxableMinor: 50000,
      },
    ]);
    expect(ascCsv).toContain("9987,INTER_STATE,500.00,0.00,0.00,90.00,590.00");
  });
});
