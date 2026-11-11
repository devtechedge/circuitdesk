import type { ProductCategory } from "@/db/schema";

export interface ServiceCentreCandidate {
  id: string;
  name: string;
  code: string;
  city: string;
  pinPrefixes: string[];
  supportedCategories: ProductCategory[];
  centreType: "OWNED_BENCH" | "AUTHORISED_PARTNER";
  maxActiveRepairs: number;
  activeRepairsCount: number;
  active: boolean;
}

export function isValidIndianPinCode(pinCode: string): boolean {
  return /^[1-9][0-9]{5}$/.test(pinCode.trim());
}

export function routeServiceCentreByPinAndSkill(params: {
  centres: readonly ServiceCentreCandidate[];
  customerPinCode: string;
  productCategory: ProductCategory;
}): {
  selected: ServiceCentreCandidate | null;
  routingReason: string;
} {
  const pin = params.customerPinCode.trim();
  const eligible = params.centres.filter(
    (c) =>
      c.active &&
      c.supportedCategories.includes(params.productCategory) &&
      c.activeRepairsCount < c.maxActiveRepairs
  );

  if (eligible.length === 0) {
    return {
      selected: null,
      routingReason: `No active service centre with available capacity supports category ${params.productCategory}.`,
    };
  }

  const scored = eligible.map((centre) => {
    let longestPrefixLen = 0;
    let matchedPrefix = "";
    for (const rawPrefix of centre.pinPrefixes) {
      const p = rawPrefix.trim();
      if (p.length > 0 && pin.startsWith(p) && p.length > longestPrefixLen) {
        longestPrefixLen = p.length;
        matchedPrefix = p;
      }
    }
    const utilization = centre.activeRepairsCount / Math.max(centre.maxActiveRepairs, 1);
    const ownedBonus = centre.centreType === "OWNED_BENCH" ? 0.05 : 0;
    return {
      centre,
      longestPrefixLen,
      matchedPrefix,
      utilization,
      rankScore: longestPrefixLen * 10 - utilization + ownedBonus,
    };
  });

  scored.sort((a, b) => b.rankScore - a.rankScore);
  const winner = scored[0]!;

  if (winner.longestPrefixLen > 0) {
    return {
      selected: winner.centre,
      routingReason: `Matched PIN prefix "${winner.matchedPrefix}" + ${params.productCategory} skill (${winner.centre.name}, load ${winner.centre.activeRepairsCount}/${winner.centre.maxActiveRepairs})`,
    };
  }

  return {
    selected: winner.centre,
    routingReason: `National hub fallback for PIN "${pin}" + ${params.productCategory} skill (${winner.centre.name}, load ${winner.centre.activeRepairsCount}/${winner.centre.maxActiveRepairs})`,
  };
}
