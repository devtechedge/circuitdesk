import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { getEnv } from "@/env";
import { createTenantApiKey, verifyBearerApiKey } from "@/security/api-keys";
import { signTimestampedWebhook } from "@/security/webhooks";
import {
  getBillingOverview,
  processRazorpayWebhookPayload,
  processStripeWebhookPayload,
  updateSubscriptionOrCheckout,
} from "@/services/billing";
import {
  ingestSignedCommerceOrderWebhook,
  upsertTenantIntegration,
} from "@/services/integrations";
import {
  eraseDataPrincipalPii,
  exportDataPrincipalRecord,
} from "@/services/privacy";
import { getCertificateBySecureToken } from "@/services/registrations";
import { getTestDatabase, sessionForEmail } from "./helpers";

describe("webhooks idempotency, billing entitlements, API keys & DPDP privacy", () => {
  it("processes Stripe & Razorpay signed webhooks idempotently and rejects forged signatures", async () => {
    const db = await getTestDatabase();
    const owner = await sessionForEmail(db, "ops@kinetix-audio.demo");
    const secret = getEnv().WEBHOOK_SIGNING_SECRET;
    const nowSec = Math.floor(Date.now() / 1000);

    // Non-charging demo switch keeps isNonChargingDemo=true
    const demoSwitch = await updateSubscriptionOrCheckout(
      owner,
      { planCode: "STARTER", currency: "INR", action: "SWITCH_PLAN" },
      "test",
      db
    );
    expect(demoSwitch.mode).toBe("NON_CHARGING_DEMO");

    // Forged Stripe signature rejected 401
    const stripeBody = JSON.stringify({
      id: "evt_stripe_scale_001",
      type: "invoice.payment_succeeded",
      data: {
        object: {
          id: "in_live_001",
          customer: "cus_001",
          subscription: "sub_001",
          amount_paid: 29900,
          currency: "usd",
          status: "paid",
          metadata: { tenantId: owner.tenantId, planCode: "SCALE" },
        },
      },
    });

    await expect(
      processStripeWebhookPayload(
        { rawBody: stripeBody, signatureHeader: `t=${nowSec},v1=deadbeef`, nowSec },
        db
      )
    ).rejects.toMatchObject({ status: 401 });

    // Valid Stripe signature activates SCALE subscription
    const validStripeSig = signTimestampedWebhook(stripeBody, secret, nowSec);
    const firstStripe = await processStripeWebhookPayload(
      { rawBody: stripeBody, signatureHeader: validStripeSig, nowSec },
      db
    );
    expect(firstStripe.duplicate).toBe(false);
    expect(firstStripe.appliedStatus).toBe("ACTIVE");

    // Duplicate delivery is idempotent
    const replayStripe = await processStripeWebhookPayload(
      { rawBody: stripeBody, signatureHeader: validStripeSig, nowSec },
      db
    );
    expect(replayStripe.duplicate).toBe(true);

    const billing = await getBillingOverview(owner, db);
    expect(billing.plan.code).toBe("SCALE");
    expect(billing.subscription?.isNonChargingDemo).toBe(false);

    // Scale Bearer API Key now succeeds, and fails on Starter rival tenant
    const minted = await createTenantApiKey(
      {
        tenantId: owner.tenantId,
        name: "Test Scale Key",
        scopes: ["serials:read"],
        createdByUserId: owner.userId,
      },
      db
    );

    const authReq = new Request("https://circuitdesk.vercel.app/api/v1/serials", {
      headers: { Authorization: `Bearer ${minted.rawKey}` },
    });
    const verifiedKey = await verifyBearerApiKey(authReq, "serials:read", db);
    expect(verifiedKey.tenantId).toBe(owner.tenantId);

    const rivalOwner = await sessionForEmail(db, "ops@voltgrid.demo");
    const rivalKey = await createTenantApiKey(
      {
        tenantId: rivalOwner.tenantId,
        name: "Starter Key Blocked",
        scopes: ["serials:read"],
        createdByUserId: rivalOwner.userId,
      },
      db
    );
    const rivalReq = new Request("https://circuitdesk.vercel.app/api/v1/serials", {
      headers: { Authorization: `Bearer ${rivalKey.rawKey}` },
    });
    await expect(verifyBearerApiKey(rivalReq, "serials:read", db)).rejects.toMatchObject({
      status: 403,
      code: "PLAN_API_ENTITLEMENT_REQUIRED",
    });

    // Razorpay HMAC hex webhook + idempotency
    const rzpBody = JSON.stringify({
      event: "subscription.activated",
      created_at: nowSec,
      payload: {
        subscription: {
          entity: {
            id: "sub_rzp_991",
            status: "active",
            notes: { tenantId: owner.tenantId, planCode: "GROWTH" },
          },
        },
      },
    });
    const rzpSig = createHmac("sha256", secret).update(rzpBody, "utf8").digest("hex");
    const rzpFirst = await processRazorpayWebhookPayload(
      { rawBody: rzpBody, signatureHeader: rzpSig },
      db
    );
    expect(rzpFirst.duplicate).toBe(false);
    const rzpDup = await processRazorpayWebhookPayload(
      { rawBody: rzpBody, signatureHeader: rzpSig },
      db
    );
    expect(rzpDup.duplicate).toBe(true);
  });

  it("verifies encrypted Shopify connector secrets and executes DPDP export + PII erasure", async () => {
    const db = await getTestDatabase();
    const owner = await sessionForEmail(db, "ops@kinetix-audio.demo");

    const customShopSecret = "shopify_custom_hmac_secret_2026_test";
    await upsertTenantIntegration(
      owner,
      {
        provider: "SHOPIFY",
        displayName: "Kinetix Shopify Store",
        externalDomain: "kinetix.myshopify.com",
        secretValue: customShopSecret,
        config: {},
      },
      "test",
      db
    );

    const shopBody = JSON.stringify({
      id: 99110022,
      name: "#SHP-9911",
      line_items: [{ sku: "KNX-ANC-PRO2", serial_number: "KNX-SHP-SYNC-01" }],
    });
    const shopHmac = createHmac("sha256", customShopSecret)
      .update(shopBody, "utf8")
      .digest("base64");

    const synced = await ingestSignedCommerceOrderWebhook(
      {
        provider: "SHOPIFY",
        tenantSlug: "kinetix-audio",
        externalEventId: "wh-shop-001",
        signatureHeader: shopHmac,
        rawBody: shopBody,
      },
      db
    );
    expect(synced.duplicate).toBe(false);
    expect(synced.syncedSerials).toBe(1);

    // DPDP export & erasure on ananya.sharma@customer.demo
    const exported = await exportDataPrincipalRecord(
      { session: owner, customerEmail: "ananya.sharma@customer.demo" },
      db
    );
    expect(exported.registrations.length).toBeGreaterThanOrEqual(1);
    expect(exported.claims.length).toBeGreaterThanOrEqual(1);

    const erased = await eraseDataPrincipalPii(
      { session: owner, customerEmail: "ananya.sharma@customer.demo" },
      db
    );
    expect(erased.erasedRegistrations).toBeGreaterThanOrEqual(1);
    expect(erased.erasedClaims).toBeGreaterThanOrEqual(1);

    // Certificate token for Ananya is now revoked
    const certAfterErase = await getCertificateBySecureToken(
      { brandSlug: "kinetix", rawToken: "cd_cert_demo_kinetix_active_01" },
      db
    );
    expect(certAfterErase).toBeNull();
  });
});
