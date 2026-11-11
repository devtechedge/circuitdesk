import { copyFileSync, mkdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";
import { did } from "../src/demo/ids";

const baseUrl = (process.env.LIVE_URL ?? "https://circuitdesk.vercel.app").replace(/\/$/, "");
const outDir = join(process.cwd(), "docs/screenshots");
mkdirSync(outDir, { recursive: true });

const artifactDir = process.env.ARTIFACT_SCREENSHOT_DIR;
if (artifactDir) {
  mkdirSync(artifactDir, { recursive: true });
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
});
const page = await context.newPage();

// 1. Social preview card (1280x640 dark product hero crop, < 1 MB)
await page.setViewportSize({ width: 1280, height: 640 });
await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded" });
await page.locator("h1").waitFor({ state: "visible" });
await page.screenshot({ path: join(outDir, "social-preview.png"), fullPage: false });

// 2. Obtain real database session via /api/auth/demo and capture console shots at 1440x900
await page.setViewportSize({ width: 1440, height: 900 });
const demoLogin = await page.request.post(`${baseUrl}/api/auth/demo`, {
  headers: { Origin: baseUrl, "Content-Type": "application/json" },
  data: { persona: "OWNER" },
});
if (!demoLogin.ok()) {
  throw new Error(`Demo login failed: ${demoLogin.status()}`);
}
await page.goto(`${baseUrl}/app`, { waitUntil: "domcontentloaded" });
await page.getByTestId("console-overview").waitFor({ state: "visible", timeout: 25_000 });
await page.screenshot({ path: join(outDir, "01-overview.png"), fullPage: false });

// 3. Claims triage detail workspace with policy snapshot, duplicate signal & AI brief
const triageClaimId = did("claim:CLM-KNX-2026-0101");
await page.goto(`${baseUrl}/app/claims/${triageClaimId}`, { waitUntil: "domcontentloaded" });
await page.getByTestId("human-triage-form").waitFor({ state: "visible" });
await page.screenshot({ path: join(outDir, "02-claims-triage.png"), fullPage: false });

// 4. Branded zero-account customer warranty certificate + QR
await page.goto(
  `${baseUrl}/w/kinetix/certificate/cd_cert_demo_kinetix_active_01`,
  { waitUntil: "domcontentloaded" }
);
await page.getByTestId("warranty-certificate-view").waitFor({ state: "visible" });
await page.screenshot({ path: join(outDir, "03-customer-portal.png"), fullPage: false });

// 5. SKU, Supplier Batch & Failure-Cost Analytics + GST Exports
await page.goto(`${baseUrl}/app/analytics`, { waitUntil: "domcontentloaded" });
await page.getByTestId("analytics-page").waitFor({ state: "visible" });
await page.screenshot({ path: join(outDir, "04-batch-analytics.png"), fullPage: false });

await browser.close();

const files = [
  "01-overview.png",
  "02-claims-triage.png",
  "03-customer-portal.png",
  "04-batch-analytics.png",
  "social-preview.png",
];

for (const name of files) {
  const full = join(outDir, name);
  const bytes = statSync(full).size;
  if (bytes >= 1_000_000) {
    throw new Error(`${name} is ${bytes} bytes (>= 1 MB GitHub social preview limit).`);
  }
  if (artifactDir) {
    copyFileSync(full, join(artifactDir, name));
  }
  console.log(`Captured ${name} (${Math.round(bytes / 1024)} KB)`);
}

export {};
