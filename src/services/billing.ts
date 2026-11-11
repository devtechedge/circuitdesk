import { randomBytes } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import type { AuthenticatedSession } from "@/auth/session";
import { getEnv, getProviderCapabilities } from "@/env";
import { getDb, type Database } from "@/db/client";
import { withTenantDb } from "@/db/tenant";
import {
  billingInvoices,
  type CurrencyCode,
  PLAN_CODES,
  type PlanCode,
  subscriptions,
  type SubscriptionStatus,
  usageCounters,
} from "@/db/schema";
import { PLAN_CATALOG } from "@/domain/plans";
import { AppError } from "@/lib/errors";
import { assertPermission } from "@/security/rbac";
import {
  claimIdempotentWebhookEvent,
  verifyHexHmacSignature,
  verifyTimestampedHmacSignature,
} from "@/security/webhooks";
import { recordAuditLog } from "./audit";

export const changePlanSchema = z.object({
  planCode: z.enum(PLAN_CODES),
  currency: z.enum(["INR", "USD"]),
  action: z.enum(["SWITCH_PLAN", "CANCEL_AT_PERIOD_END", "RESUME"]).default("SWITCH_PLAN"),
});

export async function getBillingOverview(
  session: AuthenticatedSession,
  dbOverride?: Database
) {
  const caps = getProviderCapabilities();
  const now = new Date();
  const periodYm = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;

  return withTenantDb(
    session.tenantId,
    async (tx) => {
      const [sub] = await tx
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.tenantId, session.tenantId))
        .limit(1);

      const [usage] = await tx
        .select()
        .from(usageCounters)
        .where(
          and(eq(usageCounters.tenantId, session.tenantId), eq(usageCounters.periodYm, periodYm))
        )
        .limit(1);

      const invoices = await tx
        .select()
        .from(billingInvoices)
        .where(eq(billingInvoices.tenantId, session.tenantId))
        .orderBy(desc(billingInvoices.issuedAt))
        .limit(24);

      const activePlanCode: PlanCode = sub?.planCode ?? "STARTER";
      const planDef = PLAN_CATALOG[activePlanCode];

      return {
        subscription: sub ?? null,
        plan: planDef,
        periodYm,
        usage: {
          registrationsCount: usage?.registrationsCount ?? 0,
          claimsCount: usage?.claimsCount ?? 0,
          aiSummariesCount: usage?.aiSummariesCount ?? 0,
        },
        invoices,
        providers: {
          stripeConfigured: caps.stripe,
          razorpayConfigured: caps.razorpay,
          isLiveChargingAvailable: caps.stripe || caps.razorpay,
        },
      };
    },
    dbOverride
  );
}

function getStripePriceId(planCode: PlanCode): string | undefined {
  const env = getEnv();
  if (planCode === "STARTER") return env.STRIPE_PRICE_STARTER_USD;
  if (planCode === "GROWTH") return env.STRIPE_PRICE_GROWTH_USD;
  if (planCode === "SCALE") return env.STRIPE_PRICE_SCALE_USD;
  return undefined;
}

function getRazorpayPlanId(planCode: PlanCode): string | undefined {
  const env = getEnv();
  if (planCode === "STARTER") return env.RAZORPAY_PLAN_STARTER_INR;
  if (planCode === "GROWTH") return env.RAZORPAY_PLAN_GROWTH_INR;
  if (planCode === "SCALE") return env.RAZORPAY_PLAN_SCALE_INR;
  return undefined;
}

export async function updateSubscriptionOrCheckout(
  session: AuthenticatedSession,
  input: z.infer<typeof changePlanSchema>,
  ipHash?: string,
  dbOverride?: Database
): Promise<{
  mode: "LIVE_STRIPE_CHECKOUT" | "LIVE_RAZORPAY_SUBSCRIPTION" | "NON_CHARGING_DEMO";
  checkoutUrl: string | null;
  message: string;
}> {
  assertPermission(session.role, "billing:manage");
  const parsed = changePlanSchema.parse(input);
  const env = getEnv();

  if (parsed.planCode === "ENTERPRISE") {
    throw new AppError(
      422,
      "ENTERPRISE_QUOTE_REQUIRED",
      "Enterprise plans are provisioned via custom quote on /contact."
    );
  }

  // 1. Live Stripe Checkout when USD + STRIPE_SECRET_KEY + price ID are configured
  const stripePrice = getStripePriceId(parsed.planCode);
  if (
    parsed.action === "SWITCH_PLAN" &&
    parsed.currency === "USD" &&
    env.STRIPE_SECRET_KEY?.trim() &&
    stripePrice?.trim()
  ) {
    const form = new URLSearchParams();
    form.set("mode", "subscription");
    form.set("client_reference_id", session.tenantId);
    form.set("customer_email", session.email);
    form.set("line_items[0][price]", stripePrice.trim());
    form.set("line_items[0][quantity]", "1");
    form.set("metadata[tenantId]", session.tenantId);
    form.set("metadata[planCode]", parsed.planCode);
    form.set("success_url", `${env.APP_URL}/app/billing?checkout=success`);
    form.set("cancel_url", `${env.APP_URL}/app/billing?checkout=cancelled`);

    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.STRIPE_SECRET_KEY.trim()}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    });

    if (!res.ok) {
      throw new AppError(502, "STRIPE_UPSTREAM_ERROR", "Failed to create Stripe Checkout session.");
    }
    const json = (await res.json()) as { url?: string };
    return {
      mode: "LIVE_STRIPE_CHECKOUT",
      checkoutUrl: json.url ?? null,
      message: "Redirecting to Stripe Checkout.",
    };
  }

  // 2. Live Razorpay Subscription when INR + RAZORPAY_KEY_ID/SECRET + plan ID are configured
  const rzpPlan = getRazorpayPlanId(parsed.planCode);
  if (
    parsed.action === "SWITCH_PLAN" &&
    parsed.currency === "INR" &&
    env.RAZORPAY_KEY_ID?.trim() &&
    env.RAZORPAY_KEY_SECRET?.trim() &&
    rzpPlan?.trim()
  ) {
    const basicAuth = Buffer.from(
      `${env.RAZORPAY_KEY_ID.trim()}:${env.RAZORPAY_KEY_SECRET.trim()}`
    ).toString("base64");

    const res = await fetch("https://api.razorpay.com/v1/subscriptions", {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicAuth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        plan_id: rzpPlan.trim(),
        total_count: 12,
        customer_notify: 1,
        notes: {
          tenantId: session.tenantId,
          planCode: parsed.planCode,
        },
      }),
    });

    if (!res.ok) {
      throw new AppError(502, "RAZORPAY_UPSTREAM_ERROR", "Failed to create Razorpay subscription.");
    }
    const json = (await res.json()) as { short_url?: string };
    return {
      mode: "LIVE_RAZORPAY_SUBSCRIPTION",
      checkoutUrl: json.short_url ?? null,
      message: "Redirecting to Razorpay hosted mandate page.",
    };
  }

  // 3. Honest Non-Charging Demo Mode when provider keys are absent
  const planDef = PLAN_CATALOG[parsed.planCode];
  const monthlyMinor = planDef.monthlyMinor[parsed.currency] ?? 0;
  const now = new Date();
  const periodEnd = new Date(now.getTime() + 30 * 86_400_000);

  return withTenantDb(
    session.tenantId,
    async (tx) => {
      const nextStatus: SubscriptionStatus =
        parsed.action === "CANCEL_AT_PERIOD_END" ? "CANCELED" : "TRIALING";

      await tx
        .insert(subscriptions)
        .values({
          tenantId: session.tenantId,
          planCode: parsed.planCode,
          billingCurrency: parsed.currency,
          provider: "DEMO",
          status: nextStatus,
          monthlyAmountMinor: monthlyMinor,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          cancelAtPeriodEnd: parsed.action === "CANCEL_AT_PERIOD_END",
          isNonChargingDemo: true,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: subscriptions.tenantId,
          set: {
            planCode: parsed.planCode,
            billingCurrency: parsed.currency,
            provider: "DEMO",
            status: nextStatus,
            monthlyAmountMinor: monthlyMinor,
            cancelAtPeriodEnd: parsed.action === "CANCEL_AT_PERIOD_END",
            isNonChargingDemo: true,
            updatedAt: now,
          },
        });

      await tx.insert(billingInvoices).values({
        tenantId: session.tenantId,
        provider: "DEMO",
        externalInvoiceId: `DEMO-SIM-${now.getUTCFullYear()}-${randomBytes(3).toString("hex").toUpperCase()}`,
        amountMinor: 0,
        taxMinor: 0,
        currency: parsed.currency,
        status: "DRAFT",
        isDemoSimulated: true,
        issuedAt: now,
      });

      await recordAuditLog(
        {
          tenantId: session.tenantId,
          actorUserId: session.userId,
          actorRole: session.role,
          action: `BILLING_DEMO_${parsed.action}`,
          entityType: "SUBSCRIPTION",
          entityId: session.tenantId,
          ipHash,
          summary: `Updated non-charging demo plan to ${parsed.planCode} (${parsed.currency}, status ${nextStatus}).`,
        },
        tx
      );

      return {
        mode: "NON_CHARGING_DEMO" as const,
        checkoutUrl: null,
        message:
          "Updated plan entitlements in Non-Charging Demo Mode (live Stripe/Razorpay credentials are not configured; $0 charged and excluded from MRR).",
      };
    },
    dbOverride
  );
}

export async function processStripeWebhookPayload(
  params: { rawBody: string; signatureHeader: string | null; nowSec?: number },
  dbOverride?: Database
): Promise<{ duplicate: boolean; appliedStatus?: SubscriptionStatus }> {
  const env = getEnv();
  const secret = env.STRIPE_WEBHOOK_SECRET?.trim() || env.WEBHOOK_SIGNING_SECRET;

  verifyTimestampedHmacSignature({
    payload: params.rawBody,
    headerValue: params.signatureHeader,
    secret,
    nowSec: params.nowSec,
  });

  const event = JSON.parse(params.rawBody) as {
    id?: string;
    type?: string;
    data?: {
      object?: {
        id?: string;
        customer?: string;
        subscription?: string;
        client_reference_id?: string;
        amount_paid?: number;
        tax?: number;
        currency?: string;
        status?: string;
        metadata?: { tenantId?: string; planCode?: PlanCode };
      };
    };
  };

  if (!event.id || !event.type) {
    throw new AppError(400, "INVALID_STRIPE_EVENT", "Missing Stripe event id or type.");
  }

  const obj = event.data?.object ?? {};
  const tenantId = obj.metadata?.tenantId ?? obj.client_reference_id ?? null;

  const claim = await claimIdempotentWebhookEvent(
    {
      provider: "STRIPE",
      externalEventId: event.id,
      tenantId,
      eventType: event.type,
      rawPayload: params.rawBody,
    },
    dbOverride
  );

  if (claim.alreadyProcessed) {
    return { duplicate: true };
  }

  if (!tenantId) {
    return { duplicate: false };
  }

  const db = dbOverride ?? (await getDb());
  const now = new Date();
  const planCode: PlanCode =
    obj.metadata?.planCode && (PLAN_CODES as readonly string[]).includes(obj.metadata.planCode)
      ? obj.metadata.planCode
      : "GROWTH";

  let mappedStatus: SubscriptionStatus = "ACTIVE";
  if (event.type === "invoice.payment_failed") mappedStatus = "FAILED";
  else if (event.type === "customer.subscription.deleted") mappedStatus = "CANCELED";
  else if (obj.status === "past_due") mappedStatus = "PAST_DUE";
  else if (obj.status === "trialing") mappedStatus = "TRIALING";

  const amountMinor = PLAN_CATALOG[planCode].monthlyMinor.USD ?? 12900;

  await withTenantDb(
    tenantId,
    async (tx) => {
      await tx
        .insert(subscriptions)
        .values({
          tenantId,
          planCode,
          billingCurrency: "USD",
          provider: "STRIPE",
          status: mappedStatus,
          monthlyAmountMinor: amountMinor,
          externalCustomerId: obj.customer ?? null,
          externalSubscriptionId: obj.subscription ?? obj.id ?? null,
          currentPeriodStart: now,
          currentPeriodEnd: new Date(now.getTime() + 30 * 86_400_000),
          isNonChargingDemo: false,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: subscriptions.tenantId,
          set: {
            planCode,
            billingCurrency: "USD",
            provider: "STRIPE",
            status: mappedStatus,
            monthlyAmountMinor: amountMinor,
            externalCustomerId: obj.customer ?? null,
            externalSubscriptionId: obj.subscription ?? obj.id ?? null,
            isNonChargingDemo: false,
            updatedAt: now,
          },
        });

      if (event.type === "invoice.payment_succeeded" && obj.id) {
        const currency: CurrencyCode =
          obj.currency?.toUpperCase() === "INR" ? "INR" : "USD";
        await tx
          .insert(billingInvoices)
          .values({
            tenantId,
            provider: "STRIPE",
            externalInvoiceId: obj.id,
            amountMinor: obj.amount_paid ?? amountMinor,
            taxMinor: obj.tax ?? 0,
            currency,
            status: "PAID",
            isDemoSimulated: false,
            issuedAt: now,
          })
          .onConflictDoNothing();
      }
    },
    db
  );

  return { duplicate: false, appliedStatus: mappedStatus };
}

export async function processRazorpayWebhookPayload(
  params: { rawBody: string; signatureHeader: string | null },
  dbOverride?: Database
): Promise<{ duplicate: boolean; appliedStatus?: SubscriptionStatus }> {
  const env = getEnv();
  const secret = env.RAZORPAY_WEBHOOK_SECRET?.trim() || env.WEBHOOK_SIGNING_SECRET;

  verifyHexHmacSignature(params.rawBody, params.signatureHeader, secret);

  const event = JSON.parse(params.rawBody) as {
    event?: string;
    created_at?: number;
    payload?: {
      subscription?: {
        entity?: {
          id?: string;
          status?: string;
          notes?: { tenantId?: string; planCode?: PlanCode };
        };
      };
    };
  };

  const subEntity = event.payload?.subscription?.entity;
  const externalEventId = `${event.event ?? "rzp"}:${subEntity?.id ?? "none"}:${event.created_at ?? 0}`;
  const tenantId = subEntity?.notes?.tenantId ?? null;

  const claim = await claimIdempotentWebhookEvent(
    {
      provider: "RAZORPAY",
      externalEventId,
      tenantId,
      eventType: event.event ?? "unknown",
      rawPayload: params.rawBody,
    },
    dbOverride
  );

  if (claim.alreadyProcessed) {
    return { duplicate: true };
  }

  if (!tenantId) {
    return { duplicate: false };
  }

  const planCode: PlanCode =
    subEntity?.notes?.planCode &&
    (PLAN_CODES as readonly string[]).includes(subEntity.notes.planCode)
      ? subEntity.notes.planCode
      : "GROWTH";

  let mappedStatus: SubscriptionStatus = "ACTIVE";
  if (event.event === "subscription.halted") mappedStatus = "PAST_DUE";
  else if (event.event === "subscription.cancelled") mappedStatus = "CANCELED";

  const amountMinor = PLAN_CATALOG[planCode].monthlyMinor.INR ?? 999900;
  const db = dbOverride ?? (await getDb());
  const now = new Date();

  await withTenantDb(
    tenantId,
    async (tx) => {
      await tx
        .insert(subscriptions)
        .values({
          tenantId,
          planCode,
          billingCurrency: "INR",
          provider: "RAZORPAY",
          status: mappedStatus,
          monthlyAmountMinor: amountMinor,
          externalSubscriptionId: subEntity?.id ?? null,
          currentPeriodStart: now,
          currentPeriodEnd: new Date(now.getTime() + 30 * 86_400_000),
          isNonChargingDemo: false,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: subscriptions.tenantId,
          set: {
            planCode,
            billingCurrency: "INR",
            provider: "RAZORPAY",
            status: mappedStatus,
            monthlyAmountMinor: amountMinor,
            externalSubscriptionId: subEntity?.id ?? null,
            isNonChargingDemo: false,
            updatedAt: now,
          },
        });
    },
    db
  );

  return { duplicate: false, appliedStatus: mappedStatus };
}
