import type { CurrencyCode, PlanCode, SubscriptionStatus } from "@/db/schema";

export interface PlanDefinition {
  code: PlanCode;
  name: string;
  tagline: string;
  monthlyMinor: Record<CurrencyCode, number | null>;
  limits: {
    brands: number;
    seats: number;
    registrationsPerMonth: number;
    claimsPerMonth: number;
  };
  overageMinor: {
    perRegistration: Record<CurrencyCode, number>;
    perClaim: Record<CurrencyCode, number>;
  };
  features: string[];
  entitlements: {
    repairsAndPinRouting: boolean;
    automations: boolean;
    whatsappSlot: boolean;
    shopifyConnector: boolean;
    apiAndWebhooks: boolean;
    customPortalBranding: boolean;
    batchCostAnalytics: boolean;
  };
}

export const PLAN_CATALOG: Record<PlanCode, PlanDefinition> = {
  STARTER: {
    code: "STARTER",
    name: "Starter",
    tagline: "Structured warranty registration and claim triage for single-brand D2C launches.",
    monthlyMinor: { USD: 4900, INR: 399900 },
    limits: {
      brands: 1,
      seats: 3,
      registrationsPerMonth: 500,
      claimsPerMonth: 50,
    },
    overageMinor: {
      perRegistration: { USD: 8, INR: 600 },
      perClaim: { USD: 60, INR: 4500 },
    },
    features: [
      "1 brand portal (/w/[brand])",
      "3 operator seats with RBAC",
      "500 registrations + 50 claims / month",
      "QR label SVG sheets & CSV serial import",
      "Private encrypted claim photo/receipt storage",
      "Transactional email notifications",
    ],
    entitlements: {
      repairsAndPinRouting: false,
      automations: false,
      whatsappSlot: false,
      shopifyConnector: false,
      apiAndWebhooks: false,
      customPortalBranding: false,
      batchCostAnalytics: false,
    },
  },
  GROWTH: {
    code: "GROWTH",
    name: "Growth",
    tagline: "End-to-end bench repairs, PIN routing, Shopify sync and failure analytics.",
    monthlyMinor: { USD: 12900, INR: 999900 },
    limits: {
      brands: 3,
      seats: 10,
      registrationsPerMonth: 2500,
      claimsPerMonth: 300,
    },
    overageMinor: {
      perRegistration: { USD: 6, INR: 450 },
      perClaim: { USD: 45, INR: 3500 },
    },
    features: [
      "Up to 3 brands & 10 operator/technician seats",
      "2,500 registrations + 300 claims / month",
      "Repair orders, PIN-code service routing & SLA clocks",
      "Deterministic workflow automations",
      "Meta WhatsApp Business template slot",
      "SKU failure analytics & CBIC GST CSV exports",
      "Shopify & WooCommerce order connectors",
    ],
    entitlements: {
      repairsAndPinRouting: true,
      automations: true,
      whatsappSlot: true,
      shopifyConnector: true,
      apiAndWebhooks: false,
      customPortalBranding: false,
      batchCostAnalytics: false,
    },
  },
  SCALE: {
    code: "SCALE",
    name: "Scale",
    tagline: "Multi-centre hardware operations with supplier batch recovery and REST API.",
    monthlyMinor: { USD: 29900, INR: 2499900 },
    limits: {
      brands: 10,
      seats: 25,
      registrationsPerMonth: 10000,
      claimsPerMonth: 1500,
    },
    overageMinor: {
      perRegistration: { USD: 4, INR: 300 },
      perClaim: { USD: 30, INR: 2200 },
    },
    features: [
      "Up to 10 brands & 25 seats across multiple hubs",
      "10,000 registrations + 1,500 claims / month",
      "SHA-256 hashed REST API & signed outbound webhooks",
      "Multi-location spare parts & RTV supplier recovery",
      "Custom portal branding (optional badge removal)",
      "Supplier lot & factory batch failure-cost analytics",
    ],
    entitlements: {
      repairsAndPinRouting: true,
      automations: true,
      whatsappSlot: true,
      shopifyConnector: true,
      apiAndWebhooks: true,
      customPortalBranding: true,
      batchCostAnalytics: true,
    },
  },
  ENTERPRISE: {
    code: "ENTERPRISE",
    name: "Enterprise",
    tagline: "Custom high-volume serial commitments, dedicated SLA and legal DPA review.",
    monthlyMinor: { USD: null, INR: null },
    limits: {
      brands: 100,
      seats: 250,
      registrationsPerMonth: 100000,
      claimsPerMonth: 15000,
    },
    overageMinor: {
      perRegistration: { USD: 2, INR: 150 },
      perClaim: { USD: 20, INR: 1500 },
    },
    features: [
      "Custom brand, seat, registration and claim volume",
      "Dedicated onboarding & ERP/WMS webhook mapping",
      "Custom data retention & DPDP/GDPR DPA countersignature",
      "Priority SLA support",
    ],
    entitlements: {
      repairsAndPinRouting: true,
      automations: true,
      whatsappSlot: true,
      shopifyConnector: true,
      apiAndWebhooks: true,
      customPortalBranding: true,
      batchCostAnalytics: true,
    },
  },
};

export interface SubscriptionMrrInput {
  status: SubscriptionStatus;
  isNonChargingDemo: boolean;
  provider: "DEMO" | "STRIPE" | "RAZORPAY";
  monthlyAmountMinor: number;
  billingCurrency: CurrencyCode;
}

/**
 * Computes true recurring MRR in minor units for a single currency, strictly
 * excluding trials, non-charging demos, failed/canceled plans, and one-off fees.
 */
export function computePaidRecurringMrrMinor(
  rows: readonly SubscriptionMrrInput[],
  currency: CurrencyCode
): number {
  let total = 0;
  for (const row of rows) {
    if (
      row.billingCurrency === currency &&
      row.status === "ACTIVE" &&
      !row.isNonChargingDemo &&
      row.provider !== "DEMO" &&
      row.monthlyAmountMinor > 0
    ) {
      total += row.monthlyAmountMinor;
    }
  }
  return total;
}

export function estimateMonthlyWithOveragesMinor(params: {
  planCode: Exclude<PlanCode, "ENTERPRISE">;
  currency: CurrencyCode;
  expectedRegistrations: number;
  expectedClaims: number;
}): {
  baseMinor: number;
  regOverageMinor: number;
  claimOverageMinor: number;
  subtotalExclTaxMinor: number;
  indianGst18Minor: number;
  totalWithGstMinor: number;
} {
  const plan = PLAN_CATALOG[params.planCode];
  const baseMinor = plan.monthlyMinor[params.currency] ?? 0;
  const extraRegs = Math.max(0, params.expectedRegistrations - plan.limits.registrationsPerMonth);
  const extraClaims = Math.max(0, params.expectedClaims - plan.limits.claimsPerMonth);

  const regOverageMinor = extraRegs * plan.overageMinor.perRegistration[params.currency];
  const claimOverageMinor = extraClaims * plan.overageMinor.perClaim[params.currency];
  const subtotalExclTaxMinor = baseMinor + regOverageMinor + claimOverageMinor;
  const indianGst18Minor =
    params.currency === "INR" ? Math.round(subtotalExclTaxMinor * 0.18) : 0;

  return {
    baseMinor,
    regOverageMinor,
    claimOverageMinor,
    subtotalExclTaxMinor,
    indianGst18Minor,
    totalWithGstMinor: subtotalExclTaxMinor + indianGst18Minor,
  };
}

export const TARGET_2K_MRR_SCENARIOS = [
  {
    name: "Growth-led cohort (USD)",
    composition: "16 Growth subscriptions x $129/month",
    paidSubscribers: 16,
    mrrUsd: 2064,
    notes: "Fits D2C audio, wearable and charging brands shipping 1,500-8,000 units/month.",
  },
  {
    name: "Scale-led multi-centre cohort (USD)",
    composition: "7 Scale subscriptions x $299/month",
    paidSubscribers: 7,
    mrrUsd: 2093,
    notes: "Fits appliance and multi-brand electronics distributors running regional ASCs.",
  },
  {
    name: "Blended India + Global cohort",
    composition: "10 Growth ($1,290) + 2 Scale ($598) + 4 Starter ($196)",
    paidSubscribers: 16,
    mrrUsd: 2084,
    notes: "Excludes trials, setup fees, and variable overage usage.",
  },
] as const;
