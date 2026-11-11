import { describe, expect, it } from "vitest";
import {
  addMinor,
  computeAscGstSplit,
  formatMoneyMinor,
  sumMinor,
} from "@/domain/money";
import {
  isValidIndianPinCode,
  routeServiceCentreByPinAndSkill,
  type ServiceCentreCandidate,
} from "@/domain/pin-routing";
import {
  evaluateCoverageWindow,
  type PolicyRuleInput,
  selectApplicablePolicy,
} from "@/domain/policy-engine";
import { computeClaimSlaDeadlines, evaluateSlaWindow } from "@/domain/sla";

describe("domain/money", () => {
  it("computes integer minor-unit sums and rejects floating-point inputs", () => {
    expect(addMinor(399900, 100)).toBe(400000);
    expect(sumMinor([185000, 240000, 112000])).toBe(537000);
    expect(() => addMinor(12.5, 100)).toThrow(/integer/i);
  });

  it("splits 18% GST into CGST+SGST intra-state and IGST inter-state by 2-digit GSTIN state code", () => {
    const intra = computeAscGstSplit({
      taxableMinor: 100000,
      oemGstin: "27AABCK9401L1Z8",
      ascGstin: "27AAFCE3310K1Z4",
    });
    expect(intra.supplyType).toBe("INTRA_STATE");
    expect(intra.cgstMinor).toBe(9000);
    expect(intra.sgstMinor).toBe(9000);
    expect(intra.igstMinor).toBe(0);
    expect(intra.grossMinor).toBe(118000);

    const inter = computeAscGstSplit({
      taxableMinor: 100000,
      oemGstin: "27AABCK9401L1Z8",
      ascGstin: "29AAFCE3310K1Z4",
    });
    expect(inter.supplyType).toBe("INTER_STATE");
    expect(inter.cgstMinor).toBe(0);
    expect(inter.sgstMinor).toBe(0);
    expect(inter.igstMinor).toBe(18000);
  });

  it("formats INR and USD minor units accurately", () => {
    expect(formatMoneyMinor(999900, "INR", { compactZeroDecimals: true })).toContain("9,999");
    expect(formatMoneyMinor(12900, "USD", { compactZeroDecimals: true })).toBe("$129");
  });
});

describe("domain/policy-engine", () => {
  const basePolicy: PolicyRuleInput = {
    id: "pol-1",
    name: "EU 24m + 12m Repair Extension",
    productId: "prod-1",
    regionCode: "EU",
    salesChannel: "ALL",
    durationMonths: 24,
    doaWindowDays: 14,
    repairExtensionMonths: 12,
    requiresReceipt: true,
    offlineReviewRequired: true,
    coveredFaults: ["DOA", "BATTERY", "CHARGING"],
    active: true,
  };

  it("applies DOA window, offline dealer review gate, and EU repair extension months", () => {
    const purchaseDate = new Date("2025-01-10T00:00:00.000Z");
    const eval26m = new Date("2027-03-01T00:00:00.000Z");

    const withoutRepair = evaluateCoverageWindow({
      policy: basePolicy,
      purchaseDate,
      evaluatedAt: eval26m,
      salesChannel: "D2C_WEB",
      faultCategory: "BATTERY",
      priorCompletedRepairsCount: 0,
    });
    expect(withoutRepair.snapshot.withinCoverageWindow).toBe(false);
    expect(withoutRepair.requiresManualReview).toBe(false);

    const withEuRepair = evaluateCoverageWindow({
      policy: basePolicy,
      purchaseDate,
      evaluatedAt: eval26m,
      salesChannel: "OFFLINE_RETAIL",
      faultCategory: "PHYSICAL_DAMAGE",
      priorCompletedRepairsCount: 1,
    });
    expect(withEuRepair.snapshot.withinCoverageWindow).toBe(true);
    expect(withEuRepair.snapshot.faultCoveredByPolicy).toBe(false);
    expect(withEuRepair.requiresManualReview).toBe(true);
  });

  it("prefers exact region + channel policy over GLOBAL wildcard", () => {
    const globalPol: PolicyRuleInput = { ...basePolicy, id: "g", regionCode: "GLOBAL" };
    const indiaOffline: PolicyRuleInput = {
      ...basePolicy,
      id: "in-off",
      regionCode: "IN",
      salesChannel: "OFFLINE_RETAIL",
    };
    const selected = selectApplicablePolicy([globalPol, indiaOffline], {
      productId: "prod-1",
      regionCode: "IN",
      salesChannel: "OFFLINE_RETAIL",
    });
    expect(selected?.id).toBe("in-off");
  });
});

describe("domain/pin-routing & sla", () => {
  const centres: ServiceCentreCandidate[] = [
    {
      id: "bom",
      name: "Mumbai Hub",
      code: "BOM-01",
      city: "Mumbai",
      pinPrefixes: ["400", "411"],
      supportedCategories: ["AUDIO", "WEARABLE"],
      centreType: "OWNED_BENCH",
      maxActiveRepairs: 20,
      activeRepairsCount: 5,
      active: true,
    },
    {
      id: "blr-full",
      name: "BLR Full Bench",
      code: "BLR-FULL",
      city: "Bengaluru",
      pinPrefixes: ["560"],
      supportedCategories: ["WEARABLE"],
      centreType: "AUTHORISED_PARTNER",
      maxActiveRepairs: 10,
      activeRepairsCount: 10,
      active: true,
    },
  ];

  it("validates Indian PIN codes and skips full-capacity service centres", () => {
    expect(isValidIndianPinCode("400053")).toBe(true);
    expect(isValidIndianPinCode("012345")).toBe(false);

    const routedMumbai = routeServiceCentreByPinAndSkill({
      centres,
      customerPinCode: "400053",
      productCategory: "WEARABLE",
    });
    expect(routedMumbai.selected?.id).toBe("bom");

    // 560xxx bench is at 10/10 maxActiveRepairs, so router falls back to Mumbai national hub
    const routedBlrOverflow = routeServiceCentreByPinAndSkill({
      centres,
      customerPinCode: "560034",
      productCategory: "WEARABLE",
    });
    expect(routedBlrOverflow.selected?.id).toBe("bom");
  });

  it("evaluates SLA deadlines and 75% at-risk threshold", () => {
    const start = new Date("2026-11-01T00:00:00.000Z");
    const deadlines = computeClaimSlaDeadlines({
      createdAt: start,
      priority: "URGENT",
      withinDoaWindow: true,
    });
    expect(deadlines.firstResponseDueAt.getTime() - start.getTime()).toBe(8 * 3_600_000);
    expect(deadlines.resolutionDueAt.getTime() - start.getTime()).toBe(72 * 3_600_000);

    const atRisk = evaluateSlaWindow({
      startedAt: start,
      dueAt: deadlines.resolutionDueAt,
      now: new Date("2026-11-03T19:00:00.000Z"), // 67h / 72h > 75%
    });
    expect(atRisk.state).toBe("AT_RISK");
  });
});
