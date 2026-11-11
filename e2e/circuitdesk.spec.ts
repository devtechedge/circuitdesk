import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { did } from "../src/demo/ids";

test.describe("CircuitDesk end-to-end, security, responsive & WCAG 2.2 AA suite", () => {
  test("health endpoint, security headers, unauthenticated guard, invalid tokens & forged webhooks", async ({
    request,
    page,
  }) => {
    const health = await request.get("/api/health");
    expect(health.status()).toBe(200);
    const healthJson = await health.json();
    expect(healthJson.status).toBe("ok");

    const headers = health.headers();
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["content-security-policy"]).toContain("default-src 'self'");

    // Unauthenticated console request redirects to /login
    const unauthApp = await request.get("/app", { maxRedirects: 0 });
    expect([302, 307]).toContain(unauthApp.status());
    expect(unauthApp.headers()["location"]).toContain("/login");

    // Forged Stripe webhook rejected 401
    const forgedWh = await request.post("/api/webhooks/stripe", {
      headers: { "stripe-signature": "t=1700000000,v1=deadbeef" },
      data: JSON.stringify({ id: "evt_bad", type: "invoice.payment_succeeded" }),
    });
    expect(forgedWh.status()).toBe(401);

    // Invalid tracking token renders clean 404 view
    const badTrack = await page.goto("/w/kinetix/track/cd_trk_forged_nonexistent_token");
    expect(badTrack?.status()).toBe(404);
    await expect(page.getByText(/unavailable/i)).toBeVisible();
  });

  test("theme toggle, horizontal overflow (390/768/1440) and WCAG 2.2 AA axe-core on public & portal surfaces", async ({
    page,
  }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { name: /Every product has an afterlife/i })
    ).toBeVisible();

    // Theme toggle flips dark -> light -> dark
    const html = page.locator("html");
    await expect(html).toHaveAttribute("data-theme", "dark");
    await page.getByTestId("theme-toggle").click();
    await expect(html).toHaveAttribute("data-theme", "light");

    const lightAxe = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(
      lightAxe.violations.filter((v) => v.impact === "critical" || v.impact === "serious")
    ).toEqual([]);

    await page.getByTestId("theme-toggle").click();
    await expect(html).toHaveAttribute("data-theme", "dark");

    for (const path of ["/", "/pricing", "/w/kinetix/register"]) {
      await page.goto(path, { waitUntil: "domcontentloaded" });
      for (const width of [390, 768, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        const dims = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          innerWidth: window.innerWidth,
        }));
        expect(dims.scrollWidth, `Overflow on ${path} at ${width}px`).toBeLessThanOrEqual(
          dims.innerWidth
        );
      }

      const axe = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze();
      expect(
        axe.violations.filter((v) => v.impact === "critical" || v.impact === "serious")
      ).toEqual([]);
    }
  });

  test("full SaaS lifecycle: signup -> SKU & policy -> CSV serial import -> QR registration -> claim -> triage -> repair -> tracker -> analytics + cross-tenant denial", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });

    // 1. Signup a brand-new hardware brand workspace
    const uniqueSuffix = Date.now().toString().slice(-6);
    const brandName = `NovaSound ${uniqueSuffix}`;
    await page.goto("/signup");
    await page.getByLabel("Full Name").fill("Riya Sen");
    await page.getByLabel("Work Email").fill(`ops+${uniqueSuffix}@novasound.example`);
    await page.getByLabel("Company Legal Name").fill(`NovaSound Hardware ${uniqueSuffix}`);
    await page.getByLabel("Consumer Brand Name").fill(brandName);
    await page.getByLabel(/Password/i).fill("NovaSound-Strong-2026!");
    await page.getByRole("button", { name: /Create multi-tenant workspace/i }).click();

    await expect(page.getByTestId("onboarding-page")).toBeVisible({ timeout: 20_000 });

    // Cross-tenant IDOR check: new tenant cannot read VoltGrid or Kinetix claim IDs
    const crossTenantRes = await page.request.get(
      `/api/app/claims/${did("claim:CLM-VGD-2026-0001")}`
    );
    expect(crossTenantRes.status()).toBe(404);

    // 2. Create SKU & Warranty Policy
    await page.goto("/app/products");
    await page.getByLabel("SKU Code").fill("NVS-BUDS-X1");
    await page.getByLabel("Product Name").fill("NovaSound Buds X1");
    await page.getByRole("button", { name: "Save Hardware SKU" }).click();
    await expect(page.getByText(/Added SKU NVS-BUDS-X1/i)).toBeVisible();

    await page.getByTestId("tab-new-policy").click();
    await page.getByRole("button", { name: "Save Warranty Policy" }).click();
    await expect(page.getByText(/Saved warranty policy/i)).toBeVisible();

    // Add a Service Centre so PIN routing routes repairs cleanly
    await page.goto("/app/service-network");
    await page.getByLabel("Centre Name").fill("NovaSound Mumbai Bench");
    await page.getByLabel("Bench Code").fill("NVS-BOM-01");
    await page.getByLabel("City").fill("Mumbai");
    await page.getByLabel("State").fill("Maharashtra");
    await page.getByRole("button", { name: "Save Service Centre" }).click();
    await expect(page.getByText("NVS-BOM-01")).toBeVisible();

    // 3. Import Serial via CSV preview + commit
    await page.goto("/app/serials");
    const serialCode = `NVS-X1-2611-${uniqueSuffix}`;
    const csvPayload = [
      "sku,serial_number,imei,batch_code,sales_channel,external_order_id,sold_at",
      `NVS-BUDS-X1,${serialCode},,,D2C_WEB,ORD-NVS-101,2026-11-05`,
    ].join("\n");
    await page.getByLabel(/CSV Payload/i).fill(csvPayload);
    await page.getByTestId("csv-preview-btn").click();
    await expect(page.getByTestId("csv-preview-result")).toContainText("1 Valid Row(s)");
    await page.getByTestId("csv-commit-btn").click();
    await expect(page.getByText(serialCode)).toBeVisible();

    // Grab the new brand portal slug from Overview
    await page.goto("/app");
    const consoleAxe = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(
      consoleAxe.violations.filter((v) => v.impact === "critical" || v.impact === "serious")
    ).toEqual([]);

    const portalLink = page.locator('a[href^="/w/"]').first();
    const portalHref = await portalLink.getAttribute("href");
    expect(portalHref).toBeTruthy();
    const brandSlug = portalHref!.split("/")[2]!;

    // 4. Customer QR Registration -> Printable Certificate
    await page.goto(`/w/${brandSlug}/register?serial=${serialCode}&sku=NVS-BUDS-X1&source=qr`);
    await page.getByLabel("Order / Invoice Reference").fill("ORD-NVS-101");
    await page.getByLabel("Owner Full Name").fill("Karan Malhotra");
    await page.getByLabel("Email Address").fill("karan@customer.example");
    await page.getByLabel("Phone / WhatsApp").fill("+91-98201-55667");
    await page.getByLabel("PIN / Postal Code").fill("500081");
    await page.getByLabel("City").fill("Hyderabad");
    await page.getByTestId("reg-consent-checkbox").check();
    await page.getByRole("button", { name: "Activate Warranty Coverage" }).click();

    await expect(page.getByTestId("registration-success")).toBeVisible();
    await page.getByTestId("open-certificate-link").click();
    await expect(page.getByTestId("warranty-certificate-view")).toBeVisible();

    // 5. Customer Claim Submission
    await page.goto(`/w/${brandSlug}/claim?serial=${serialCode}`);
    await page.getByLabel("Short Symptom Headline").fill("Left driver audio cut-out after 10 mins");
    await page
      .getByLabel(/Detailed Issue/i)
      .fill("Purchased on order ORD-NVS-101; factory reset attempted twice.");
    await page.getByLabel("Contact Name").fill("Karan Malhotra");
    await page.getByLabel("Contact Email").fill("karan@customer.example");
    await page.getByLabel("Contact Phone").fill("+91-98201-55667");
    await page.getByLabel("6-Digit PIN Code").fill("500081");
    await page.getByLabel("City").fill("Hyderabad");
    await page.getByLabel(/Street Address/i).fill("Hitech City Main Rd, Hyderabad 500081");
    await page.getByRole("button", { name: "Submit Warranty Claim" }).click();

    await expect(page.getByTestId("claim-success")).toBeVisible();
    const trackerHref = await page.getByTestId("open-tracker-link").getAttribute("href");
    expect(trackerHref).toContain(`/w/${brandSlug}/track/cd_trk_`);

    // 6. Operator Human Triage -> Approve Repair -> Technician Bench -> Dispatch
    await page.goto("/app/claims");
    await page.locator('a[href^="/app/claims/"]').first().click();

    await page.getByTestId("generate-ai-summary-btn").click();
    await expect(page.getByText(/ORD-NVS-101/i)).toBeVisible();

    await page.getByTestId("submit-adjudication-btn").click();
    await expect(page.getByText(/Approved and routed to repair job/i)).toBeVisible();

    await page.goto("/app/repairs");
    await page.locator('a[href^="/app/repairs/"]').first().click();

    await page.getByLabel("Repair Stage").selectOption("DISPATCHED");
    await page.getByLabel("Return Tracking Number").fill("DLV-HYD-90011");
    await page.getByLabel("1. Power-On").check();
    await page.getByLabel("2. Charge Probe").check();
    await page.getByLabel("3. Load Burn-In").check();
    await page.getByLabel("4. Enclosure Seal").check();
    await page.getByTestId("save-repair-stage-btn").click();
    await expect(page.getByText(/Bench stage updated to DISPATCHED/i)).toBeVisible();

    // 7. Customer Live Tracker shows RESOLVED + tracking number
    await page.goto(trackerHref!);
    await expect(page.getByTestId("claim-tracker-view")).toContainText("RESOLVED");
    await expect(page.getByTestId("claim-tracker-view")).toContainText("DLV-HYD-90011");

    // 8. Analytics & GST export
    await page.goto("/app/analytics");
    await expect(page.getByTestId("analytics-page")).toContainText("Live Tenant Production Data");
    const gstRes = await page.request.get("/api/app/exports/gst?type=oem_replacements");
    expect(gstRes.status()).toBe(200);
    expect(await gstRes.text()).toContain("claim_number,rma_number");
  });
});
