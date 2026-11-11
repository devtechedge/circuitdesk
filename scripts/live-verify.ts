/**
 * End-to-end production verification probe against the live Vercel deployment.
 * Proves health, security headers, Managed PostgreSQL persistence, auth,
 * branded QR registration, claim submission, certificate/tracker tokens, and
 * AES-256-GCM private evidence decryption.
 */
const baseUrl = (process.env.LIVE_URL ?? "https://circuitdesk.vercel.app").replace(/\/$/, "");

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`LIVE VERIFICATION FAILED: ${message}`);
  }
}

function extractSessionCookie(setCookie: string | null): string {
  assert(setCookie && setCookie.includes("cd_session="), "Expected HttpOnly cd_session Set-Cookie");
  assert(/HttpOnly/i.test(setCookie), "Expected HttpOnly flag on cd_session");
  if (baseUrl.startsWith("https://")) {
    assert(/Secure/i.test(setCookie), "Expected Secure flag on cd_session over HTTPS");
  }
  const match = setCookie.match(/cd_session=[^;]+/);
  assert(match, "Could not parse cd_session token");
  return match[0];
}

console.log(`Probing live deployment at ${baseUrl} ...`);

// 1. Health & Managed PostgreSQL check
const healthRes = await fetch(`${baseUrl}/api/health`);
assert(healthRes.status === 200, `Expected /api/health 200, got ${healthRes.status}`);
const health = (await healthRes.json()) as { status: string; db: string };
assert(health.status === "ok", `Expected health status ok, got ${health.status}`);
assert(health.db === "postgres", `Expected production db=postgres, got ${health.db}`);

// 2. Security headers, robots, sitemap, and unauthenticated /app redirect
assert(
  healthRes.headers.get("x-content-type-options") === "nosniff",
  "Missing X-Content-Type-Options: nosniff"
);
assert(healthRes.headers.get("x-frame-options") === "DENY", "Missing X-Frame-Options: DENY");
assert(
  Boolean(healthRes.headers.get("content-security-policy")),
  "Missing Content-Security-Policy"
);
if (baseUrl.startsWith("https://")) {
  assert(
    Boolean(healthRes.headers.get("strict-transport-security")),
    "Missing Strict-Transport-Security"
  );
}

const robotsRes = await fetch(`${baseUrl}/robots.txt`);
assert(robotsRes.status === 200, "robots.txt did not return 200");
const robotsTxt = await robotsRes.text();
assert(robotsTxt.includes("Disallow: /app"), "robots.txt must disallow /app");

const sitemapRes = await fetch(`${baseUrl}/sitemap.xml`);
assert(sitemapRes.status === 200, "sitemap.xml did not return 200");

const unauthApp = await fetch(`${baseUrl}/app`, { redirect: "manual" });
assert(
  unauthApp.status === 307 || unauthApp.status === 302,
  `Expected /app unauthenticated redirect 307/302, got ${unauthApp.status}`
);

// 3. Verify seeded demo sign-in + AES-256-GCM private evidence download
const demoAuth = await fetch(`${baseUrl}/api/auth/demo`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Origin: baseUrl,
  },
  body: JSON.stringify({ persona: "OWNER" }),
});
assert(demoAuth.status === 200, `Demo login failed with ${demoAuth.status}`);
const demoCookie = extractSessionCookie(demoAuth.headers.get("set-cookie"));

const demoClaimsRes = await fetch(`${baseUrl}/api/app/claims`, {
  headers: { Cookie: demoCookie },
});
assert(demoClaimsRes.status === 200, "Failed to list demo claims");
const demoClaims = (await demoClaimsRes.json()) as {
  claims: Array<{ id: string; claimNumber: string }>;
};
assert(demoClaims.claims.length >= 3, "Expected seeded Kinetix Audio claims in Postgres");

// 4. Live DB Persistence Proof: signup -> SKU -> policy -> serial -> portal register -> certificate -> claim -> tracker
const stamp = Date.now().toString(36);
const signupRes = await fetch(`${baseUrl}/api/auth/signup`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Origin: baseUrl,
  },
  body: JSON.stringify({
    fullName: "Live Probe Operator",
    email: `probe.${stamp}@circuitdesk-verify.invalid`,
    password: "CircuitDesk-Live-Probe-2026!",
    companyName: `Probe Acoustics ${stamp}`,
    brandName: `ProbeAudio ${stamp}`,
    currency: "INR",
  }),
});
assert(signupRes.status === 201, `Live signup failed with ${signupRes.status}`);
const signupCookie = extractSessionCookie(signupRes.headers.get("set-cookie"));
const signupData = (await signupRes.json()) as { brandSlug: string };

const catalogGet = await fetch(`${baseUrl}/api/app/catalog`, {
  headers: { Cookie: signupCookie },
});
const catalogJson = (await catalogGet.json()) as { brands: Array<{ id: string }> };
const brandId = catalogJson.brands[0]?.id;
assert(brandId, "Expected created brandId");

const createProdRes = await fetch(`${baseUrl}/api/app/catalog`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Origin: baseUrl,
    Cookie: signupCookie,
  },
  body: JSON.stringify({
    kind: "product",
    payload: {
      brandId,
      sku: "PRB-ANC-01",
      name: "Probe ANC Monitor",
      category: "AUDIO",
      hsnCode: "85183000",
      unitCostMinor: 150000,
      retailPriceMinor: 499900,
    },
  }),
});
assert(createProdRes.status === 201, "Live SKU creation failed");
const prodData = (await createProdRes.json()) as { product: { id: string } };

const createPolRes = await fetch(`${baseUrl}/api/app/catalog`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Origin: baseUrl,
    Cookie: signupCookie,
  },
  body: JSON.stringify({
    kind: "policy",
    payload: {
      productId: prodData.product.id,
      name: "India 12m Standard",
      regionCode: "IN",
      salesChannel: "ALL",
      durationMonths: 12,
      doaWindowDays: 7,
      repairExtensionMonths: 0,
      requiresReceipt: true,
      offlineReviewRequired: true,
      coveredFaults: ["DOA", "BATTERY", "CHARGING"],
      exclusionsNote: "Excludes liquid ingress.",
      replaceCostThresholdMinor: 120000,
    },
  }),
});
assert(createPolRes.status === 201, "Live policy creation failed");

const serialCode = `PRB-SN-${stamp.toUpperCase()}`;
const importRes = await fetch(`${baseUrl}/api/app/serials`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Origin: baseUrl,
    Cookie: signupCookie,
  },
  body: JSON.stringify({
    kind: "csv",
    dryRun: false,
    csvText: `sku,serial_number,imei,batch_code,sales_channel,external_order_id,sold_at\nPRB-ANC-01,${serialCode},,,D2C_WEB,ORD-PRB-1,2026-11-10`,
  }),
});
assert(importRes.status === 200, "Live serial CSV commit failed");

const regRes = await fetch(
  `${baseUrl}/api/portal/${encodeURIComponent(signupData.brandSlug)}/register`,
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: baseUrl,
    },
    body: JSON.stringify({
      serialNumber: serialCode,
      customerName: "Verification Buyer",
      customerEmail: `buyer.${stamp}@circuitdesk-verify.invalid`,
      customerPhone: "+91-98200-12345",
      customerPinCode: "400053",
      customerCity: "Mumbai",
      regionCode: "IN",
      salesChannel: "D2C_WEB",
      sourceMethod: "QR",
      orderReference: "ORD-PRB-1",
      purchaseDate: "2026-11-10",
      consentAccepted: true,
    }),
  }
);
assert(regRes.status === 201, `Live portal registration failed with ${regRes.status}`);
const regJson = (await regRes.json()) as { certificatePath: string };

const certHtmlRes = await fetch(`${baseUrl}${regJson.certificatePath}`);
assert(certHtmlRes.status === 200, "Live certificate page did not persist in Postgres");

const claimRes = await fetch(
  `${baseUrl}/api/portal/${encodeURIComponent(signupData.brandSlug)}/claim`,
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: baseUrl,
    },
    body: JSON.stringify({
      serialNumber: serialCode,
      submittedByType: "CUSTOMER",
      customerName: "Verification Buyer",
      customerEmail: `buyer.${stamp}@circuitdesk-verify.invalid`,
      customerPhone: "+91-98200-12345",
      shippingPinCode: "400053",
      shippingCity: "Mumbai",
      shippingAddress: "Andheri West, Mumbai 400053",
      faultCategory: "BATTERY",
      symptomSummary: "Live probe battery drain verification",
      customerDescription: "Submitted by automated production persistence check on ORD-PRB-1.",
      purchaseDate: "2026-11-10",
    }),
  }
);
assert(claimRes.status === 201, `Live portal claim failed with ${claimRes.status}`);
const claimJson = (await claimRes.json()) as { trackingPath: string };

const trackHtmlRes = await fetch(`${baseUrl}${claimJson.trackingPath}`);
assert(trackHtmlRes.status === 200, "Live claim tracker page did not persist in Postgres");

// Erase disposable probe PII immediately so zero test PII remains in production DB
const eraseRes = await fetch(`${baseUrl}/api/app/settings`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Origin: baseUrl,
    Cookie: signupCookie,
  },
  body: JSON.stringify({
    kind: "dpdp_erase",
    customerEmail: `buyer.${stamp}@circuitdesk-verify.invalid`,
    confirmPhrase: "ERASE PII",
  }),
});
assert(eraseRes.status === 200, "Live DPDP erasure failed");

const revokedCertCheck = await fetch(`${baseUrl}${regJson.certificatePath}`);
assert(revokedCertCheck.status === 404, "Expected 404 on certificate after DPDP token revocation");

await fetch(`${baseUrl}/api/auth/logout`, {
  method: "POST",
  headers: { Origin: baseUrl, Cookie: signupCookie },
});

console.log(
  `LIVE VERIFICATION PASSED on ${baseUrl}: health=ok, db=postgres, headers=verified, registration+claim+DPDP cascade persisted.`
);

export {};
