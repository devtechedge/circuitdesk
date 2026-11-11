import type { FaultCategory, PolicySnapshot, SalesChannel } from "@/db/schema";

export interface PolicyRuleInput {
  id: string;
  name: string;
  productId: string;
  regionCode: string;
  salesChannel: SalesChannel;
  durationMonths: number;
  doaWindowDays: number;
  repairExtensionMonths: number;
  requiresReceipt: boolean;
  offlineReviewRequired: boolean;
  coveredFaults: FaultCategory[];
  active: boolean;
}

export function addUtcMonths(start: Date, months: number): Date {
  const result = new Date(start.getTime());
  result.setUTCMonth(result.getUTCMonth() + months);
  return result;
}

export function selectApplicablePolicy(
  policies: readonly PolicyRuleInput[],
  criteria: {
    productId: string;
    regionCode: string;
    salesChannel: SalesChannel;
  }
): PolicyRuleInput | null {
  const active = policies.filter((p) => p.active && p.productId === criteria.productId);
  if (active.length === 0) return null;

  const region = criteria.regionCode.toUpperCase();
  const channel = criteria.salesChannel;

  const score = (policy: PolicyRuleInput): number => {
    const pRegion = policy.regionCode.toUpperCase();
    const regionMatch = pRegion === region ? 4 : pRegion === "GLOBAL" ? 2 : 0;
    if (regionMatch === 0) return -1;
    const channelMatch =
      policy.salesChannel === channel ? 2 : policy.salesChannel === "ALL" ? 1 : -1;
    if (channelMatch < 0) return -1;
    return regionMatch + channelMatch;
  };

  let best: PolicyRuleInput | null = null;
  let bestScore = -1;
  for (const p of active) {
    const s = score(p);
    if (s > bestScore) {
      bestScore = s;
      best = p;
    }
  }
  return best ?? active[0] ?? null;
}

export function evaluateCoverageWindow(params: {
  policy: PolicyRuleInput;
  purchaseDate: Date;
  evaluatedAt?: Date;
  salesChannel: SalesChannel;
  faultCategory?: FaultCategory;
  priorCompletedRepairsCount?: number;
}): {
  coverageStartDate: Date;
  coverageEndDate: Date;
  requiresManualReview: boolean;
  snapshot: PolicySnapshot;
} {
  const evaluatedAt = params.evaluatedAt ?? new Date();
  const extensionMonths =
    (params.priorCompletedRepairsCount ?? 0) > 0 ? params.policy.repairExtensionMonths : 0;
  const totalMonths = params.policy.durationMonths + extensionMonths;

  const coverageStartDate = new Date(params.purchaseDate.getTime());
  const coverageEndDate = addUtcMonths(coverageStartDate, totalMonths);

  const doaDeadlineMs =
    coverageStartDate.getTime() + params.policy.doaWindowDays * 24 * 60 * 60 * 1000;

  const withinCoverageWindow =
    evaluatedAt.getTime() >= coverageStartDate.getTime() - 24 * 60 * 60 * 1000 &&
    evaluatedAt.getTime() <= coverageEndDate.getTime();

  const withinDoaWindow =
    evaluatedAt.getTime() >= coverageStartDate.getTime() - 24 * 60 * 60 * 1000 &&
    evaluatedAt.getTime() <= doaDeadlineMs;

  const faultCoveredByPolicy = params.faultCategory
    ? params.policy.coveredFaults.includes(params.faultCategory)
    : true;

  const requiresManualReview =
    params.policy.offlineReviewRequired &&
    (params.salesChannel === "OFFLINE_RETAIL" || params.salesChannel === "AUTHORISED_DEALER");

  return {
    coverageStartDate,
    coverageEndDate,
    requiresManualReview,
    snapshot: {
      policyId: params.policy.id,
      policyName: params.policy.name,
      durationMonths: params.policy.durationMonths,
      doaWindowDays: params.policy.doaWindowDays,
      repairExtensionMonths: params.policy.repairExtensionMonths,
      coveredFaults: [...params.policy.coveredFaults],
      withinCoverageWindow,
      withinDoaWindow,
      faultCoveredByPolicy,
    },
  };
}
