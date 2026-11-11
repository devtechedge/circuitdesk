import { createCipheriv, createHash, scryptSync } from "node:crypto";
import { eq } from "drizzle-orm";
import { getEnv } from "@/env";
import type { Database } from "@/db/client";
import {
  auditLogs,
  automationRules,
  billingInvoices,
  brands,
  claimEvents,
  claimEvidence,
  integrationConnections,
  memberships,
  notificationLogs,
  privateBlobs,
  productionBatches,
  products,
  repairOrders,
  repairPartUsages,
  rmaOrders,
  serialUnits,
  serviceCentres,
  spareParts,
  subscriptions,
  tenants,
  usageCounters,
  users,
  warrantyClaims,
  warrantyPolicies,
  warrantyRegistrations,
} from "@/db/schema";
import { DEMO_CONSTANTS, did, sha256Hex } from "./ids";

const cachedScryptHashes = new Map<string, string>();

function deterministicScryptHash(password: string, saltSeed: string): string {
  const cacheKey = `${saltSeed}:${password}`;
  const hit = cachedScryptHashes.get(cacheKey);
  if (hit) return hit;
  const salt = sha256Hex(`salt:${saltSeed}`).slice(0, 32);
  const derived = scryptSync(password, salt, 64).toString("hex");
  const encoded = `scrypt$${salt}$${derived}`;
  cachedScryptHashes.set(cacheKey, encoded);
  return encoded;
}

function maskSerialSeed(serial: string): string {
  if (serial.length <= 8) return `${serial.slice(0, 2)}****${serial.slice(-2)}`;
  return `${serial.slice(0, 4)}****${serial.slice(-4)}`;
}

function encryptSeedBytes(plain: Buffer): string {
  const rawKey = getEnv().ENCRYPTION_KEY;
  const key =
    rawKey.length === 64 && /^[0-9a-fA-F]+$/.test(rawKey)
      ? Buffer.from(rawKey, "hex")
      : createHash("sha256").update(rawKey).digest();
  const iv = createHash("sha256").update("circuitdesk-demo-iv-v1").digest().subarray(0, 12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64url")}:${tag.toString("base64url")}:${encrypted.toString("base64url")}`;
}

export async function seedSyntheticDemo(db: Database): Promise<void> {
  const existing = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.id, DEMO_CONSTANTS.KINETIX_TENANT_ID))
    .limit(1);
  if (existing.length > 0) {
    return;
  }

  const now = new Date("2026-11-10T09:00:00.000Z");
  const thirtyDaysAgo = new Date("2026-10-11T09:00:00.000Z");
  const ninetyDaysAgo = new Date("2026-08-12T09:00:00.000Z");
  const oneYearAhead = new Date("2027-10-11T09:00:00.000Z");
  const periodEnd = new Date("2026-12-01T00:00:00.000Z");
  const periodStart = new Date("2026-11-01T00:00:00.000Z");

  // 1. Primary synthetic demo tenant + isolated rival tenant (for cross-tenant IDOR proof)
  await db.insert(tenants).values([
    {
      id: DEMO_CONSTANTS.KINETIX_TENANT_ID,
      slug: "kinetix-audio",
      name: "Kinetix Audio & Wearables Pvt. Ltd. (Synthetic Demo)",
      primaryCountry: "IN",
      defaultCurrency: "INR",
      gstin: "27AABCK9401L1Z8",
      supportEmail: "warranty@kinetix-audio.demo",
      isDemo: true,
      recallApprovalRequired: true,
      retentionDays: 1095,
      onboardingCompletedSteps: ["brand", "product_policy", "serials", "portal", "team"],
      createdAt: ninetyDaysAgo,
    },
    {
      id: DEMO_CONSTANTS.VOLTGRID_TENANT_ID,
      slug: "voltgrid-home",
      name: "VoltGrid Home Appliances LLP (Synthetic Isolated Tenant)",
      primaryCountry: "IN",
      defaultCurrency: "INR",
      gstin: "29AABCV7712M1Z2",
      supportEmail: "care@voltgrid.demo",
      isDemo: true,
      recallApprovalRequired: true,
      retentionDays: 1095,
      onboardingCompletedSteps: ["brand", "product_policy"],
      createdAt: ninetyDaysAgo,
    },
  ]);

  // 2. Demo users across RBAC roles
  const ownerId = did("user:ops@kinetix-audio.demo");
  const supportId = did("user:support@kinetix-audio.demo");
  const techId = did("user:tech@kinetix-audio.demo");
  const analystId = did("user:analyst@kinetix-audio.demo");
  const viewerId = did("user:viewer@kinetix-audio.demo");
  const rivalOwnerId = did("user:ops@voltgrid.demo");

  await db.insert(users).values([
    {
      id: ownerId,
      email: "ops@kinetix-audio.demo",
      fullName: "Aarav Mehta",
      passwordHash: deterministicScryptHash(DEMO_CONSTANTS.PASSWORD, "ops@kinetix-audio.demo"),
      isDemo: true,
      createdAt: ninetyDaysAgo,
    },
    {
      id: supportId,
      email: "support@kinetix-audio.demo",
      fullName: "Priya Nair",
      passwordHash: deterministicScryptHash(DEMO_CONSTANTS.PASSWORD, "support@kinetix-audio.demo"),
      isDemo: true,
      createdAt: ninetyDaysAgo,
    },
    {
      id: techId,
      email: "tech@kinetix-audio.demo",
      fullName: "Rohan Deshmukh",
      passwordHash: deterministicScryptHash(DEMO_CONSTANTS.PASSWORD, "tech@kinetix-audio.demo"),
      isDemo: true,
      createdAt: ninetyDaysAgo,
    },
    {
      id: analystId,
      email: "analyst@kinetix-audio.demo",
      fullName: "Meera Iyer",
      passwordHash: deterministicScryptHash(DEMO_CONSTANTS.PASSWORD, "analyst@kinetix-audio.demo"),
      isDemo: true,
      createdAt: ninetyDaysAgo,
    },
    {
      id: viewerId,
      email: "viewer@kinetix-audio.demo",
      fullName: "Vikram Rao",
      passwordHash: deterministicScryptHash(DEMO_CONSTANTS.PASSWORD, "viewer@kinetix-audio.demo"),
      isDemo: true,
      createdAt: ninetyDaysAgo,
    },
    {
      id: rivalOwnerId,
      email: "ops@voltgrid.demo",
      fullName: "Neha Kulkarni",
      passwordHash: deterministicScryptHash(DEMO_CONSTANTS.PASSWORD, "ops@voltgrid.demo"),
      isDemo: true,
      createdAt: ninetyDaysAgo,
    },
  ]);

  // 3. Service centres (created before memberships so technician can be assigned)
  const centreMumbai = did("centre:mumbai-andheri");
  const centreBengaluru = did("centre:bengaluru-koramangala");
  const centreDelhi = did("centre:delhi-okhla");
  const centreChennai = did("centre:chennai-guindy");

  await db.insert(serviceCentres).values([
    {
      id: centreMumbai,
      tenantId: DEMO_CONSTANTS.KINETIX_TENANT_ID,
      name: "Mumbai Andheri Central Bench",
      code: "BOM-HUB-01",
      city: "Mumbai",
      state: "Maharashtra",
      pinPrefixes: ["400", "401", "411", "421"],
      supportedCategories: ["AUDIO", "WEARABLE", "CHARGING_ACCESSORY", "SMART_APPLIANCE"],
      centreType: "OWNED_BENCH",
      gstin: "27AABCK9401L1Z8",
      contactPhone: "+91-22-4890-1100",
      maxActiveRepairs: 50,
      activeRepairsCount: 1,
      active: true,
    },
    {
      id: centreBengaluru,
      tenantId: DEMO_CONSTANTS.KINETIX_TENANT_ID,
      name: "ElectroFix Authorised Care - Koramangala",
      code: "BLR-ASC-02",
      city: "Bengaluru",
      state: "Karnataka",
      pinPrefixes: ["560", "562", "570"],
      supportedCategories: ["AUDIO", "WEARABLE", "CHARGING_ACCESSORY"],
      centreType: "AUTHORISED_PARTNER",
      gstin: "29AAFCE3310K1Z4",
      contactPhone: "+91-80-4120-8820",
      maxActiveRepairs: 35,
      activeRepairsCount: 0,
      active: true,
    },
    {
      id: centreDelhi,
      tenantId: DEMO_CONSTANTS.KINETIX_TENANT_ID,
      name: "NorthStar MicroTech ASC - Okhla Phase II",
      code: "DEL-ASC-03",
      city: "New Delhi",
      state: "Delhi",
      pinPrefixes: ["110", "122", "201"],
      supportedCategories: ["AUDIO", "WEARABLE", "SMART_APPLIANCE"],
      centreType: "AUTHORISED_PARTNER",
      gstin: "07AAACN8841P1Z9",
      contactPhone: "+91-11-4055-3900",
      maxActiveRepairs: 40,
      activeRepairsCount: 0,
      active: true,
    },
    {
      id: centreChennai,
      tenantId: DEMO_CONSTANTS.KINETIX_TENANT_ID,
      name: "SouthWave Device Bench - Guindy",
      code: "MAA-ASC-04",
      city: "Chennai",
      state: "Tamil Nadu",
      pinPrefixes: ["600", "603", "641"],
      supportedCategories: ["CHARGING_ACCESSORY", "SMART_APPLIANCE", "AUDIO"],
      centreType: "AUTHORISED_PARTNER",
      gstin: "33AADCS9920B1Z6",
      contactPhone: "+91-44-4211-7700",
      maxActiveRepairs: 30,
      activeRepairsCount: 0,
      active: true,
    },
  ]);

  await db.insert(memberships).values([
    {
      id: did("mem:owner"),
      tenantId: DEMO_CONSTANTS.KINETIX_TENANT_ID,
      userId: ownerId,
      role: "OWNER",
    },
    {
      id: did("mem:support"),
      tenantId: DEMO_CONSTANTS.KINETIX_TENANT_ID,
      userId: supportId,
      role: "SUPPORT",
    },
    {
      id: did("mem:tech"),
      tenantId: DEMO_CONSTANTS.KINETIX_TENANT_ID,
      userId: techId,
      role: "TECHNICIAN",
      serviceCentreId: centreMumbai,
    },
    {
      id: did("mem:analyst"),
      tenantId: DEMO_CONSTANTS.KINETIX_TENANT_ID,
      userId: analystId,
      role: "ANALYST",
    },
    {
      id: did("mem:viewer"),
      tenantId: DEMO_CONSTANTS.KINETIX_TENANT_ID,
      userId: viewerId,
      role: "READ_ONLY",
    },
    {
      id: did("mem:rival-owner"),
      tenantId: DEMO_CONSTANTS.VOLTGRID_TENANT_ID,
      userId: rivalOwnerId,
      role: "OWNER",
    },
  ]);

  // 4. Brands & Products
  await db.insert(brands).values([
    {
      id: DEMO_CONSTANTS.KINETIX_BRAND_ID,
      tenantId: DEMO_CONSTANTS.KINETIX_TENANT_ID,
      slug: DEMO_CONSTANTS.KINETIX_BRAND_SLUG,
      name: "Kinetix Audio",
      supportEmail: "warranty@kinetix-audio.demo",
      supportWhatsapp: "+919820000111",
      accentHex: "#fb923c",
      portalHeadline: "Kinetix Official Warranty Registration, Repairs & Certificate Desk",
      hideCircuitdeskBadge: false,
    },
    {
      id: DEMO_CONSTANTS.VOLTGRID_BRAND_ID,
      tenantId: DEMO_CONSTANTS.VOLTGRID_TENANT_ID,
      slug: DEMO_CONSTANTS.VOLTGRID_BRAND_SLUG,
      name: "VoltGrid Appliances",
      supportEmail: "care@voltgrid.demo",
      accentHex: "#60a5fa",
      portalHeadline: "VoltGrid Warranty Portal",
      hideCircuitdeskBadge: false,
    },
  ]);

  const prodEarbuds = did("prod:KNX-ANC-PRO2");
  const prodWatch = did("prod:KNX-WATCH-S1");
  const prodCharger = did("prod:KNX-GAN-100W");
  const prodKettle = did("prod:KNX-BREW-MINI");
  const prodRival = did("prod:VGD-AIR-400");

  await db.insert(products).values([
    {
      id: prodEarbuds,
      tenantId: DEMO_CONSTANTS.KINETIX_TENANT_ID,
      brandId: DEMO_CONSTANTS.KINETIX_BRAND_ID,
      sku: "KNX-ANC-PRO2",
      name: "Kinetix Pulse ANC Pro 2 Wireless Earbuds",
      category: "AUDIO",
      hsnCode: "85183000",
      unitCostMinor: 185000,
      retailPriceMinor: 599900,
      currency: "INR",
    },
    {
      id: prodWatch,
      tenantId: DEMO_CONSTANTS.KINETIX_TENANT_ID,
      brandId: DEMO_CONSTANTS.KINETIX_BRAND_ID,
      sku: "KNX-WATCH-S1",
      name: "Kinetix Stride S1 AMOLED Smartwatch",
      category: "WEARABLE",
      hsnCode: "85176290",
      unitCostMinor: 240000,
      retailPriceMinor: 749900,
      currency: "INR",
    },
    {
      id: prodCharger,
      tenantId: DEMO_CONSTANTS.KINETIX_TENANT_ID,
      brandId: DEMO_CONSTANTS.KINETIX_BRAND_ID,
      sku: "KNX-GAN-100W",
      name: "Kinetix Volt 100W 4-Port GaN Desktop Charger",
      category: "CHARGING_ACCESSORY",
      hsnCode: "85044030",
      unitCostMinor: 112000,
      retailPriceMinor: 349900,
      currency: "INR",
    },
    {
      id: prodKettle,
      tenantId: DEMO_CONSTANTS.KINETIX_TENANT_ID,
      brandId: DEMO_CONSTANTS.KINETIX_BRAND_ID,
      sku: "KNX-BREW-MINI",
      name: "Kinetix PourSmart Temperature-Control Kettle",
      category: "SMART_APPLIANCE",
      hsnCode: "85167100",
      unitCostMinor: 295000,
      retailPriceMinor: 899900,
      currency: "INR",
    },
    {
      id: prodRival,
      tenantId: DEMO_CONSTANTS.VOLTGRID_TENANT_ID,
      brandId: DEMO_CONSTANTS.VOLTGRID_BRAND_ID,
      sku: "VGD-AIR-400",
      name: "VoltGrid HEPA Air Purifier 400",
      category: "SMART_APPLIANCE",
      hsnCode: "84213920",
      unitCostMinor: 420000,
      retailPriceMinor: 1199900,
      currency: "INR",
    },
  ]);

  // 5. Warranty Policies
  const polEarbuds = did("policy:earbuds-in");
  const polWatch = did("policy:watch-in");
  const polCharger = did("policy:charger-in");
  const polKettle = did("policy:kettle-in");
  const polRival = did("policy:voltgrid-in");

  await db.insert(warrantyPolicies).values([
    {
      id: polEarbuds,
      tenantId: DEMO_CONSTANTS.KINETIX_TENANT_ID,
      productId: prodEarbuds,
      name: "India 12-Month Standard + 7-Day DOA Replacement",
      regionCode: "IN",
      salesChannel: "ALL",
      durationMonths: 12,
      doaWindowDays: 7,
      repairExtensionMonths: 0,
      requiresReceipt: true,
      offlineReviewRequired: true,
      coveredFaults: ["DOA", "BATTERY", "CHARGING", "CONNECTIVITY", "SOFTWARE_FIRMWARE"],
      exclusionsNote: "Excludes ear-tip wear, liquid damage beyond IPX4, and crushed charging cases.",
      replaceCostThresholdMinor: 150000,
    },
    {
      id: polWatch,
      tenantId: DEMO_CONSTANTS.KINETIX_TENANT_ID,
      productId: prodWatch,
      name: "India 12-Month Wearable Bench Repair Policy",
      regionCode: "IN",
      salesChannel: "ALL",
      durationMonths: 12,
      doaWindowDays: 10,
      repairExtensionMonths: 0,
      requiresReceipt: true,
      offlineReviewRequired: true,
      coveredFaults: ["DOA", "BATTERY", "CHARGING", "CONNECTIVITY", "SOFTWARE_FIRMWARE"],
      exclusionsNote: "Excludes cracked cover glass, strap tears, and saltwater immersion.",
      replaceCostThresholdMinor: 200000,
    },
    {
      id: polCharger,
      tenantId: DEMO_CONSTANTS.KINETIX_TENANT_ID,
      productId: prodCharger,
      name: "India 24-Month GaN Power Replacement Warranty",
      regionCode: "IN",
      salesChannel: "ALL",
      durationMonths: 24,
      doaWindowDays: 14,
      repairExtensionMonths: 0,
      requiresReceipt: true,
      offlineReviewRequired: true,
      coveredFaults: ["DOA", "CHARGING"],
      exclusionsNote: "Excludes surge damage from ungrounded industrial generators and bent AC pins.",
      replaceCostThresholdMinor: 90000,
    },
    {
      id: polKettle,
      tenantId: DEMO_CONSTANTS.KINETIX_TENANT_ID,
      productId: prodKettle,
      name: "India 18-Month Appliance Bench & Element Warranty",
      regionCode: "IN",
      salesChannel: "ALL",
      durationMonths: 18,
      doaWindowDays: 7,
      repairExtensionMonths: 3,
      requiresReceipt: true,
      offlineReviewRequired: true,
      coveredFaults: ["DOA", "CHARGING", "SOFTWARE_FIRMWARE"],
      exclusionsNote: "Excludes limescale build-up without descaling and dry-boil abuse.",
      replaceCostThresholdMinor: 250000,
    },
    {
      id: polRival,
      tenantId: DEMO_CONSTANTS.VOLTGRID_TENANT_ID,
      productId: prodRival,
      name: "VoltGrid 12-Month Motor Warranty",
      regionCode: "IN",
      salesChannel: "ALL",
      durationMonths: 12,
      doaWindowDays: 7,
      repairExtensionMonths: 0,
      requiresReceipt: true,
      offlineReviewRequired: true,
      coveredFaults: ["DOA", "CHARGING"],
      exclusionsNote: "Excludes HEPA filter consumables.",
      replaceCostThresholdMinor: 300000,
    },
  ]);

  // 6. Production Batches (including rogue cell batch BATCH-KNX-2026-Q3B)
  const batchEarbudsGood = did("batch:BATCH-KNX-2026-Q3A");
  const batchEarbudsFaulty = did("batch:BATCH-KNX-2026-Q3B");
  const batchWatch = did("batch:BATCH-KNX-2026-W1");
  const batchCharger = did("batch:BATCH-KNX-2026-G4");

  await db.insert(productionBatches).values([
    {
      id: batchEarbudsGood,
      tenantId: DEMO_CONSTANTS.KINETIX_TENANT_ID,
      productId: prodEarbuds,
      batchCode: "BATCH-KNX-2026-Q3A",
      lotNumber: "LOT-SZ-8810",
      supplierName: "Shenzhen Acoustic Micro Ltd.",
      factoryCode: "SZ-PLANT-02",
      manufacturedAt: new Date("2026-07-15T00:00:00.000Z"),
      unitCount: 1200,
      notes: "Nominal QC pass rate 99.6%.",
      isDemo: true,
    },
    {
      id: batchEarbudsFaulty,
      tenantId: DEMO_CONSTANTS.KINETIX_TENANT_ID,
      productId: prodEarbuds,
      batchCode: "BATCH-KNX-2026-Q3B",
      lotNumber: "LOT-SZ-8849",
      supplierName: "Dongguan CellTech Pack Co.",
      factoryCode: "DG-CELL-04",
      manufacturedAt: new Date("2026-08-04T00:00:00.000Z"),
      unitCount: 800,
      notes: "Elevated right-earbud Li-Po voltage sag after 20 charge cycles.",
      isDemo: true,
    },
    {
      id: batchWatch,
      tenantId: DEMO_CONSTANTS.KINETIX_TENANT_ID,
      productId: prodWatch,
      batchCode: "BATCH-KNX-2026-W1",
      lotNumber: "LOT-NOI-310",
      supplierName: "Noida Precision EMS Pvt. Ltd.",
      factoryCode: "IN-NOI-01",
      manufacturedAt: new Date("2026-08-20T00:00:00.000Z"),
      unitCount: 950,
      notes: "Domestic SMT assembly run.",
      isDemo: true,
    },
    {
      id: batchCharger,
      tenantId: DEMO_CONSTANTS.KINETIX_TENANT_ID,
      productId: prodCharger,
      batchCode: "BATCH-KNX-2026-G4",
      lotNumber: "LOT-PUN-118",
      supplierName: "Pune Power Systems LLP",
      factoryCode: "IN-PUN-03",
      manufacturedAt: new Date("2026-09-02T00:00:00.000Z"),
      unitCount: 1500,
      notes: "BIS CRS certified GaN run.",
      isDemo: true,
    },
  ]);

  // 7. Spare parts inventory across centres
  const partCellMumbai = did("part:BOM:PRT-LIPO-45MAH");
  const partPcbMumbai = did("part:BOM:PRT-USBC-CTRL");
  const partCrownMumbai = did("part:BOM:PRT-WATCH-CROWN");
  const partGanBlr = did("part:BLR:PRT-GAN-STAGE");

  await db.insert(spareParts).values([
    {
      id: partCellMumbai,
      tenantId: DEMO_CONSTANTS.KINETIX_TENANT_ID,
      productId: prodEarbuds,
      serviceCentreId: centreMumbai,
      partSku: "PRT-LIPO-45MAH",
      name: "Pulse Pro 2 45mAh Matched Coin Cell Pair",
      hsnCode: "85076000",
      unitCostMinor: 32000,
      quantityOnHand: 28,
      reorderThreshold: 10,
      supplierName: "Shenzhen Acoustic Micro Ltd.",
    },
    {
      id: partPcbMumbai,
      tenantId: DEMO_CONSTANTS.KINETIX_TENANT_ID,
      productId: prodEarbuds,
      serviceCentreId: centreMumbai,
      partSku: "PRT-USBC-CTRL",
      name: "Charging Case USB-C Power Daughterboard",
      hsnCode: "85189000",
      unitCostMinor: 28000,
      quantityOnHand: 4,
      reorderThreshold: 8,
      supplierName: "Noida Precision EMS Pvt. Ltd.",
    },
    {
      id: partCrownMumbai,
      tenantId: DEMO_CONSTANTS.KINETIX_TENANT_ID,
      productId: prodWatch,
      serviceCentreId: centreMumbai,
      partSku: "PRT-WATCH-CROWN",
      name: "Stride S1 Rotary Encoder Crown + O-Ring Kit",
      hsnCode: "91149090",
      unitCostMinor: 41000,
      quantityOnHand: 19,
      reorderThreshold: 6,
      supplierName: "Noida Precision EMS Pvt. Ltd.",
    },
    {
      id: partGanBlr,
      tenantId: DEMO_CONSTANTS.KINETIX_TENANT_ID,
      productId: prodCharger,
      serviceCentreId: centreBengaluru,
      partSku: "PRT-GAN-STAGE",
      name: "100W GaN Primary Switching Module",
      hsnCode: "85049090",
      unitCostMinor: 54000,
      quantityOnHand: 14,
      reorderThreshold: 5,
      supplierName: "Pune Power Systems LLP",
    },
  ]);

  // 8. Serial Units
  const s1 = did("serial:KNX-P2-2608-8901");
  const s2 = did("serial:KNX-P2-2608-8902");
  const s3 = did("serial:KNX-W1-2608-4401");
  const s4 = did("serial:KNX-G4-2609-1105");
  const s5Replacement = did("serial:KNX-G4-2609-1199");
  const s6Unclaimed = did(`serial:${DEMO_CONSTANTS.UNCLAIMED_SERIAL}`);
  const s7OfflineUnclaimed = did(`serial:${DEMO_CONSTANTS.OFFLINE_UNCLAIMED_SERIAL}`);
  const s8Stock = did("serial:KNX-P2-2609-0099");
  const sRival = did("serial:VGD-AP-2609-7001");

  await db.insert(serialUnits).values([
    {
      id: s1,
      tenantId: DEMO_CONSTANTS.KINETIX_TENANT_ID,
      brandId: DEMO_CONSTANTS.KINETIX_BRAND_ID,
      productId: prodEarbuds,
      batchId: batchEarbudsFaulty,
      serialNumber: "KNX-P2-2608-8901",
      serialMasked: maskSerialSeed("KNX-P2-2608-8901"),
      salesChannel: "D2C_WEB",
      externalOrderId: "SHP-IN-10482",
      soldAt: thirtyDaysAgo,
      status: "CLAIMED",
      isDemo: true,
    },
    {
      id: s2,
      tenantId: DEMO_CONSTANTS.KINETIX_TENANT_ID,
      brandId: DEMO_CONSTANTS.KINETIX_BRAND_ID,
      productId: prodEarbuds,
      batchId: batchEarbudsFaulty,
      serialNumber: "KNX-P2-2608-8902",
      serialMasked: maskSerialSeed("KNX-P2-2608-8902"),
      salesChannel: "MARKETPLACE",
      externalOrderId: "AMZ-404-882910",
      soldAt: thirtyDaysAgo,
      status: "CLAIMED",
      isDemo: true,
    },
    {
      id: s3,
      tenantId: DEMO_CONSTANTS.KINETIX_TENANT_ID,
      brandId: DEMO_CONSTANTS.KINETIX_BRAND_ID,
      productId: prodWatch,
      batchId: batchWatch,
      serialNumber: "KNX-W1-2608-4401",
      imei: "359881094401228",
      serialMasked: maskSerialSeed("KNX-W1-2608-4401"),
      salesChannel: "OFFLINE_RETAIL",
      soldAt: new Date("2026-10-28T00:00:00.000Z"),
      status: "REGISTERED",
      isDemo: true,
    },
    {
      id: s4,
      tenantId: DEMO_CONSTANTS.KINETIX_TENANT_ID,
      brandId: DEMO_CONSTANTS.KINETIX_BRAND_ID,
      productId: prodCharger,
      batchId: batchCharger,
      serialNumber: "KNX-G4-2609-1105",
      serialMasked: maskSerialSeed("KNX-G4-2609-1105"),
      salesChannel: "D2C_WEB",
      externalOrderId: "SHP-IN-10819",
      soldAt: new Date("2026-11-05T00:00:00.000Z"),
      status: "REPLACED",
      isDemo: true,
    },
    {
      id: s5Replacement,
      tenantId: DEMO_CONSTANTS.KINETIX_TENANT_ID,
      brandId: DEMO_CONSTANTS.KINETIX_BRAND_ID,
      productId: prodCharger,
      batchId: batchCharger,
      serialNumber: "KNX-G4-2609-1199",
      serialMasked: maskSerialSeed("KNX-G4-2609-1199"),
      salesChannel: "D2C_WEB",
      status: "IN_STOCK",
      isDemo: true,
    },
    {
      id: s6Unclaimed,
      tenantId: DEMO_CONSTANTS.KINETIX_TENANT_ID,
      brandId: DEMO_CONSTANTS.KINETIX_BRAND_ID,
      productId: prodEarbuds,
      batchId: batchEarbudsGood,
      serialNumber: DEMO_CONSTANTS.UNCLAIMED_SERIAL,
      serialMasked: maskSerialSeed(DEMO_CONSTANTS.UNCLAIMED_SERIAL),
      salesChannel: "D2C_WEB",
      externalOrderId: "SHP-IN-11044",
      soldAt: new Date("2026-11-08T00:00:00.000Z"),
      status: "SOLD",
      isDemo: true,
    },
    {
      id: s7OfflineUnclaimed,
      tenantId: DEMO_CONSTANTS.KINETIX_TENANT_ID,
      brandId: DEMO_CONSTANTS.KINETIX_BRAND_ID,
      productId: prodWatch,
      batchId: batchWatch,
      serialNumber: DEMO_CONSTANTS.OFFLINE_UNCLAIMED_SERIAL,
      imei: "359881094409914",
      serialMasked: maskSerialSeed(DEMO_CONSTANTS.OFFLINE_UNCLAIMED_SERIAL),
      salesChannel: "OFFLINE_RETAIL",
      soldAt: new Date("2026-11-07T00:00:00.000Z"),
      status: "SOLD",
      isDemo: true,
    },
    {
      id: s8Stock,
      tenantId: DEMO_CONSTANTS.KINETIX_TENANT_ID,
      brandId: DEMO_CONSTANTS.KINETIX_BRAND_ID,
      productId: prodEarbuds,
      batchId: batchEarbudsGood,
      serialNumber: "KNX-P2-2609-0099",
      serialMasked: maskSerialSeed("KNX-P2-2609-0099"),
      salesChannel: "D2C_WEB",
      status: "IN_STOCK",
      isDemo: true,
    },
    {
      id: sRival,
      tenantId: DEMO_CONSTANTS.VOLTGRID_TENANT_ID,
      brandId: DEMO_CONSTANTS.VOLTGRID_BRAND_ID,
      productId: prodRival,
      serialNumber: "VGD-AP-2609-7001",
      serialMasked: maskSerialSeed("VGD-AP-2609-7001"),
      salesChannel: "D2C_WEB",
      soldAt: thirtyDaysAgo,
      status: "REGISTERED",
      isDemo: true,
    },
  ]);

  // 9. Warranty Registrations
  const reg1 = did("reg:REG-KNX-2026-0001");
  const reg2 = did("reg:REG-KNX-2026-0002");
  const reg3Offline = did("reg:REG-KNX-2026-0003");
  const reg4Doa = did("reg:REG-KNX-2026-0004");

  await db.insert(warrantyRegistrations).values([
    {
      id: reg1,
      tenantId: DEMO_CONSTANTS.KINETIX_TENANT_ID,
      brandId: DEMO_CONSTANTS.KINETIX_BRAND_ID,
      productId: prodEarbuds,
      serialUnitId: s1,
      policyId: polEarbuds,
      registrationNumber: "REG-KNX-2026-0001",
      customerName: "Ananya Sharma",
      customerEmail: "ananya.sharma@customer.demo",
      customerPhone: "+91-98201-44210",
      customerPinCode: "400053",
      customerCity: "Mumbai",
      regionCode: "IN",
      salesChannel: "D2C_WEB",
      sourceMethod: "QR",
      orderReference: "SHP-IN-10482",
      purchaseDate: thirtyDaysAgo,
      coverageStartDate: thirtyDaysAgo,
      coverageEndDate: oneYearAhead,
      status: "ACTIVE",
      consentAcceptedAt: thirtyDaysAgo,
      consentVersion: "dpdp-2026.1",
      certificateTokenHash: sha256Hex(DEMO_CONSTANTS.ACTIVE_CERT_TOKEN),
      certificateTokenPreview: "cd_cert_demo...ve_01",
      demoPublicToken: DEMO_CONSTANTS.ACTIVE_CERT_TOKEN,
      isDemo: true,
    },
    {
      id: reg2,
      tenantId: DEMO_CONSTANTS.KINETIX_TENANT_ID,
      brandId: DEMO_CONSTANTS.KINETIX_BRAND_ID,
      productId: prodEarbuds,
      serialUnitId: s2,
      policyId: polEarbuds,
      registrationNumber: "REG-KNX-2026-0002",
      customerName: "Karthik Subramanian",
      customerEmail: "karthik.s@customer.demo",
      customerPhone: "+91-98450-33109",
      customerPinCode: "560034",
      customerCity: "Bengaluru",
      regionCode: "IN",
      salesChannel: "MARKETPLACE",
      sourceMethod: "ORDER_LOOKUP",
      orderReference: "AMZ-404-882910",
      purchaseDate: thirtyDaysAgo,
      coverageStartDate: thirtyDaysAgo,
      coverageEndDate: oneYearAhead,
      status: "ACTIVE",
      consentAcceptedAt: thirtyDaysAgo,
      consentVersion: "dpdp-2026.1",
      certificateTokenHash: sha256Hex("cd_cert_demo_kinetix_active_02"),
      certificateTokenPreview: "cd_cert_demo...ve_02",
      demoPublicToken: "cd_cert_demo_kinetix_active_02",
      isDemo: true,
    },
    {
      id: reg3Offline,
      tenantId: DEMO_CONSTANTS.KINETIX_TENANT_ID,
      brandId: DEMO_CONSTANTS.KINETIX_BRAND_ID,
      productId: prodWatch,
      serialUnitId: s3,
      policyId: polWatch,
      registrationNumber: "REG-KNX-2026-0003",
      customerName: "Siddharth Joshi",
      customerEmail: "siddharth.j@customer.demo",
      customerPhone: "+91-98112-77890",
      customerPinCode: "411038",
      customerCity: "Pune",
      regionCode: "IN",
      salesChannel: "OFFLINE_RETAIL",
      sourceMethod: "DEALER_RECEIPT",
      dealerName: "SoundWave Electronics Retail, Kothrud",
      orderReference: "INV-SW-9921",
      purchaseDate: new Date("2026-10-28T00:00:00.000Z"),
      coverageStartDate: new Date("2026-10-28T00:00:00.000Z"),
      coverageEndDate: new Date("2027-10-28T00:00:00.000Z"),
      status: "PENDING_REVIEW",
      reviewNotes: "Offline retail GST invoice requires operator verification before certificate activation.",
      consentAcceptedAt: new Date("2026-10-29T08:00:00.000Z"),
      consentVersion: "dpdp-2026.1",
      certificateTokenHash: sha256Hex("cd_cert_demo_kinetix_pending_03"),
      certificateTokenPreview: "cd_cert_demo...ng_03",
      demoPublicToken: "cd_cert_demo_kinetix_pending_03",
      isDemo: true,
    },
    {
      id: reg4Doa,
      tenantId: DEMO_CONSTANTS.KINETIX_TENANT_ID,
      brandId: DEMO_CONSTANTS.KINETIX_BRAND_ID,
      productId: prodCharger,
      serialUnitId: s4,
      policyId: polCharger,
      registrationNumber: "REG-KNX-2026-0004",
      customerName: "Ritika Malhotra",
      customerEmail: "ritika.m@customer.demo",
      customerPhone: "+91-98104-66201",
      customerPinCode: "110020",
      customerCity: "New Delhi",
      regionCode: "IN",
      salesChannel: "D2C_WEB",
      sourceMethod: "QR",
      orderReference: "SHP-IN-10819",
      purchaseDate: new Date("2026-11-05T00:00:00.000Z"),
      coverageStartDate: new Date("2026-11-05T00:00:00.000Z"),
      coverageEndDate: new Date("2028-11-05T00:00:00.000Z"),
      status: "ACTIVE",
      consentAcceptedAt: new Date("2026-11-05T10:00:00.000Z"),
      consentVersion: "dpdp-2026.1",
      certificateTokenHash: sha256Hex("cd_cert_demo_kinetix_active_04"),
      certificateTokenPreview: "cd_cert_demo...ve_04",
      demoPublicToken: "cd_cert_demo_kinetix_active_04",
      isDemo: true,
    },
  ]);

  // 10. Private encrypted synthetic receipt SVG + Claims
  const receiptSvg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="520" height="300" viewBox="0 0 520 300">
      <rect width="520" height="300" fill="#0f172a"/>
      <rect x="16" y="16" width="488" height="268" rx="8" fill="#1e293b" stroke="#475569"/>
      <text x="36" y="54" fill="#fb923c" font-family="monospace" font-size="15" font-weight="bold">SYNTHETIC DEMO TAX INVOICE - KINETIX AUDIO</text>
      <text x="36" y="88" fill="#e2e8f0" font-family="monospace" font-size="13">Invoice Ref: SHP-IN-10482 | Date: 2026-10-11</text>
      <text x="36" y="116" fill="#e2e8f0" font-family="monospace" font-size="13">SKU: KNX-ANC-PRO2 | Serial: KNX-P2-2608-8901</text>
      <text x="36" y="144" fill="#e2e8f0" font-family="monospace" font-size="13">HSN: 85183000 | Total Paid: INR 5,999.00 (incl. 18% GST)</text>
      <text x="36" y="186" fill="#93c5fd" font-family="monospace" font-size="12">Diagnostic Note: Right earbud drops from 100% to 8% in 18 mins.</text>
      <text x="36" y="246" fill="#94a3b8" font-family="monospace" font-size="11">Illustrative synthetic evidence stored encrypted at rest (AES-256-GCM).</text>
    </svg>`,
    "utf8"
  );
  const blobKey = `tenant/${DEMO_CONSTANTS.KINETIX_TENANT_ID}/demo-receipt-10482.svg`;
  await db.insert(privateBlobs).values({
    storageKey: blobKey,
    tenantId: DEMO_CONSTANTS.KINETIX_TENANT_ID,
    mimeType: "image/svg+xml",
    byteSize: receiptSvg.byteLength,
    sha256Hex: sha256Hex(receiptSvg),
    encryptedEnvelope: encryptSeedBytes(receiptSvg),
  });

  const claimTriage = did("claim:CLM-KNX-2026-0101");
  const claimRepair = did("claim:CLM-KNX-2026-0102");
  const claimReplaced = did("claim:CLM-KNX-2026-0103");
  const claimRival = did("claim:CLM-VGD-2026-0001");

  await db.insert(warrantyClaims).values([
    {
      id: claimTriage,
      tenantId: DEMO_CONSTANTS.KINETIX_TENANT_ID,
      brandId: DEMO_CONSTANTS.KINETIX_BRAND_ID,
      productId: prodEarbuds,
      serialUnitId: s1,
      registrationId: reg1,
      policyId: polEarbuds,
      claimNumber: "CLM-KNX-2026-0101",
      submittedByType: "CUSTOMER",
      customerName: "Ananya Sharma",
      customerEmail: "ananya.sharma@customer.demo",
      customerPhone: "+91-98201-44210",
      shippingPinCode: "400053",
      shippingCity: "Mumbai",
      shippingAddress: "402 SeaBreeze CHS, Veera Desai Road, Andheri West, Mumbai 400053",
      faultCategory: "BATTERY",
      symptomSummary: "Right earbud drains from 100% to shutdown in under 20 minutes",
      customerDescription:
        "Purchased on D2C store order SHP-IN-10482. Charging case LEDs work normally, contacts cleaned, firmware updated to v2.4, but right earbud shuts off after 18 minutes on ANC.",
      purchaseDate: thirtyDaysAgo,
      status: "IN_TRIAGE",
      priority: "HIGH",
      resolutionType: "NONE",
      policySnapshot: {
        policyId: polEarbuds,
        policyName: "India 12-Month Standard + 7-Day DOA Replacement",
        durationMonths: 12,
        doaWindowDays: 7,
        repairExtensionMonths: 0,
        coveredFaults: ["DOA", "BATTERY", "CHARGING", "CONNECTIVITY", "SOFTWARE_FIRMWARE"],
        withinCoverageWindow: true,
        withinDoaWindow: false,
        faultCoveredByPolicy: true,
      },
      duplicateSignals: [
        {
          code: "PRIOR_SERIAL_CLAIM",
          severity: "INFO",
          detail: "Unit belongs to factory lot BATCH-KNX-2026-Q3B (2 battery claims logged in last 30 days).",
        },
      ],
      aiSummary: {
        provider: "deterministic-fallback",
        generatedAt: now.toISOString(),
        evidenceSummary:
          "Verified D2C order SHP-IN-10482 within 12-month coverage (day 30 of 365). Reported symptom matches Li-Po cell voltage sag on batch BATCH-KNX-2026-Q3B.",
        extractedReceiptRef: "SHP-IN-10482",
        suggestedFaultCategory: "BATTERY",
        suggestedNextAction: "ROUTE_REPAIR_BENCH",
        draftCustomerReply:
          "Hello Ananya, we verified your Pulse ANC Pro 2 warranty registration (SHP-IN-10482). Our Mumbai Andheri service bench will inspect and replace the matched coin-cell pair under warranty.",
        sourceCitations: [
          "Registration REG-KNX-2026-0001 (ACTIVE)",
          "Order Reference SHP-IN-10482",
          "Batch Lineage BATCH-KNX-2026-Q3B",
        ],
        humanApprovalRequired: true,
      },
      slaFirstResponseDueAt: new Date("2026-11-11T09:00:00.000Z"),
      slaResolutionDueAt: new Date("2026-11-17T09:00:00.000Z"),
      trackingTokenHash: sha256Hex("cd_trk_demo_kinetix_triage_01"),
      trackingTokenPreview: "cd_trk_demo_...ge_01",
      demoPublicToken: "cd_trk_demo_kinetix_triage_01",
      isDemo: true,
      createdAt: now,
    },
    {
      id: claimRepair,
      tenantId: DEMO_CONSTANTS.KINETIX_TENANT_ID,
      brandId: DEMO_CONSTANTS.KINETIX_BRAND_ID,
      productId: prodEarbuds,
      serialUnitId: s2,
      registrationId: reg2,
      policyId: polEarbuds,
      claimNumber: "CLM-KNX-2026-0102",
      submittedByType: "CUSTOMER",
      customerName: "Karthik Subramanian",
      customerEmail: "karthik.s@customer.demo",
      customerPhone: "+91-98450-33109",
      shippingPinCode: "400076",
      shippingCity: "Mumbai",
      shippingAddress: "B-904 Hiranandani Gardens, Powai, Mumbai 400076",
      faultCategory: "BATTERY",
      symptomSummary: "Intermittent battery drop and case charge cut-off",
      customerDescription:
        "Unit from Amazon order AMZ-404-882910 fails to hold charge past 35%.",
      purchaseDate: thirtyDaysAgo,
      status: "IN_REPAIR",
      priority: "NORMAL",
      resolutionType: "REPAIR",
      decidedByUserId: supportId,
      decidedAt: new Date("2026-11-08T11:30:00.000Z"),
      decisionNotes: "Approved for covered coin-cell replacement at Mumbai Andheri bench.",
      policySnapshot: {
        policyId: polEarbuds,
        policyName: "India 12-Month Standard + 7-Day DOA Replacement",
        durationMonths: 12,
        doaWindowDays: 7,
        repairExtensionMonths: 0,
        coveredFaults: ["DOA", "BATTERY", "CHARGING", "CONNECTIVITY", "SOFTWARE_FIRMWARE"],
        withinCoverageWindow: true,
        withinDoaWindow: false,
        faultCoveredByPolicy: true,
      },
      duplicateSignals: [],
      slaFirstResponseDueAt: new Date("2026-11-08T18:00:00.000Z"),
      slaResolutionDueAt: new Date("2026-11-15T18:00:00.000Z"),
      firstRespondedAt: new Date("2026-11-08T11:30:00.000Z"),
      trackingTokenHash: sha256Hex(DEMO_CONSTANTS.ACTIVE_TRACK_TOKEN),
      trackingTokenPreview: "cd_trk_demo_...ir_01",
      demoPublicToken: DEMO_CONSTANTS.ACTIVE_TRACK_TOKEN,
      isDemo: true,
      createdAt: new Date("2026-11-08T08:00:00.000Z"),
    },
    {
      id: claimReplaced,
      tenantId: DEMO_CONSTANTS.KINETIX_TENANT_ID,
      brandId: DEMO_CONSTANTS.KINETIX_BRAND_ID,
      productId: prodCharger,
      serialUnitId: s4,
      registrationId: reg4Doa,
      policyId: polCharger,
      claimNumber: "CLM-KNX-2026-0103",
      submittedByType: "CUSTOMER",
      customerName: "Ritika Malhotra",
      customerEmail: "ritika.m@customer.demo",
      customerPhone: "+91-98104-66201",
      shippingPinCode: "110020",
      shippingCity: "New Delhi",
      shippingAddress: "C-44 Hauz Khas Enclave, New Delhi 110020",
      faultCategory: "DOA",
      symptomSummary: "USB-C PD Port 1 dead on arrival out of sealed box",
      customerDescription:
        "Reported within 48 hours of delivery. Ports 2-4 negotiate 65W, Port 1 outputs 0V.",
      purchaseDate: new Date("2026-11-05T00:00:00.000Z"),
      status: "RESOLVED",
      priority: "URGENT",
      resolutionType: "REPLACE",
      decidedByUserId: ownerId,
      decidedAt: new Date("2026-11-06T14:00:00.000Z"),
      decisionNotes: "Verified within 14-day DOA window; zero-GST warranty replacement issued.",
      replacementUnitCostMinor: 112000,
      policySnapshot: {
        policyId: polCharger,
        policyName: "India 24-Month GaN Power Replacement Warranty",
        durationMonths: 24,
        doaWindowDays: 14,
        repairExtensionMonths: 0,
        coveredFaults: ["DOA", "CHARGING"],
        withinCoverageWindow: true,
        withinDoaWindow: true,
        faultCoveredByPolicy: true,
      },
      duplicateSignals: [],
      slaFirstResponseDueAt: new Date("2026-11-07T09:00:00.000Z"),
      slaResolutionDueAt: new Date("2026-11-10T09:00:00.000Z"),
      firstRespondedAt: new Date("2026-11-06T14:00:00.000Z"),
      resolvedAt: new Date("2026-11-07T16:30:00.000Z"),
      trackingTokenHash: sha256Hex("cd_trk_demo_kinetix_doa_03"),
      trackingTokenPreview: "cd_trk_demo_...oa_03",
      demoPublicToken: "cd_trk_demo_kinetix_doa_03",
      isDemo: true,
      createdAt: new Date("2026-11-06T09:00:00.000Z"),
    },
    {
      id: claimRival,
      tenantId: DEMO_CONSTANTS.VOLTGRID_TENANT_ID,
      brandId: DEMO_CONSTANTS.VOLTGRID_BRAND_ID,
      productId: prodRival,
      serialUnitId: sRival,
      policyId: polRival,
      claimNumber: "CLM-VGD-2026-0001",
      submittedByType: "CUSTOMER",
      customerName: "Private VoltGrid Owner",
      customerEmail: "owner@voltgrid-customer.demo",
      customerPhone: "+91-99001-11223",
      shippingPinCode: "560001",
      shippingCity: "Bengaluru",
      shippingAddress: "MG Road, Bengaluru 560001",
      faultCategory: "CHARGING",
      symptomSummary: "Isolated rival tenant claim",
      customerDescription: "Must never be visible to Kinetix Audio operators.",
      purchaseDate: thirtyDaysAgo,
      status: "SUBMITTED",
      priority: "NORMAL",
      resolutionType: "NONE",
      policySnapshot: {
        policyId: polRival,
        policyName: "VoltGrid 12-Month Motor Warranty",
        durationMonths: 12,
        doaWindowDays: 7,
        repairExtensionMonths: 0,
        coveredFaults: ["DOA", "CHARGING"],
        withinCoverageWindow: true,
        withinDoaWindow: false,
        faultCoveredByPolicy: true,
      },
      duplicateSignals: [],
      slaFirstResponseDueAt: new Date("2026-11-12T09:00:00.000Z"),
      slaResolutionDueAt: new Date("2026-11-18T09:00:00.000Z"),
      trackingTokenHash: sha256Hex("cd_trk_demo_voltgrid_01"),
      trackingTokenPreview: "cd_trk_demo_...id_01",
      isDemo: true,
      createdAt: now,
    },
  ]);

  await db.insert(claimEvidence).values({
    id: did("evidence:receipt-10482"),
    tenantId: DEMO_CONSTANTS.KINETIX_TENANT_ID,
    claimId: claimTriage,
    registrationId: reg1,
    kind: "RECEIPT",
    fileName: "kinetix-tax-invoice-10482.svg",
    mimeType: "image/svg+xml",
    byteSize: receiptSvg.byteLength,
    sha256Hex: sha256Hex(receiptSvg),
    storageKey: blobKey,
    uploadedBy: "ananya.sharma@customer.demo",
  });

  await db.insert(claimEvents).values([
    {
      id: did("evt:1"),
      tenantId: DEMO_CONSTANTS.KINETIX_TENANT_ID,
      claimId: claimTriage,
      actorType: "CUSTOMER",
      eventType: "CLAIM_SUBMITTED",
      message: "Customer submitted battery drain claim with invoice SHP-IN-10482.",
      visibility: "PUBLIC",
    },
    {
      id: did("evt:2"),
      tenantId: DEMO_CONSTANTS.KINETIX_TENANT_ID,
      claimId: claimRepair,
      actorType: "USER",
      actorUserId: supportId,
      eventType: "APPROVED_REPAIR",
      message: "Approved under 12-month warranty and routed to Mumbai Andheri Central Bench (PIN 400).",
      visibility: "PUBLIC",
    },
    {
      id: did("evt:3"),
      tenantId: DEMO_CONSTANTS.KINETIX_TENANT_ID,
      claimId: claimReplaced,
      actorType: "USER",
      actorUserId: ownerId,
      eventType: "APPROVED_REPLACE",
      message: "Approved DOA replacement under CBIC Circular 195/07/2023-GST zero-GST warranty challan.",
      visibility: "PUBLIC",
    },
  ]);

  // 11. Repair order + Part usage + RMA order
  const repair1 = did("repair:JOB-BOM-2026-0041");
  await db.insert(repairOrders).values({
    id: repair1,
    tenantId: DEMO_CONSTANTS.KINETIX_TENANT_ID,
    claimId: claimRepair,
    serviceCentreId: centreMumbai,
    assignedTechnicianId: techId,
    jobNumber: "JOB-BOM-2026-0041",
    routingReason: "Matched PIN prefix 400 + AUDIO skill + lowest active load (Mumbai Andheri Central Bench)",
    stage: "REPAIRING",
    inspectionNotes: "Bench load test confirmed right coin cell internal impedance > 480 mOhm.",
    diagnosisCode: "CELL_IMPEDANCE_HIGH",
    qaPassed: false,
    qaChecklist: { powerOn: true, chargeTest: true, burnIn: false, enclosureSeal: false },
    labourCostMinor: 25000,
    partsCostMinor: 32000,
    freightCostMinor: 14000,
    ascTaxableInvoiceMinor: 0,
    ascGstMinor: 0,
    slaDueAt: new Date("2026-11-15T18:00:00.000Z"),
    isDemo: true,
  });

  await db.insert(repairPartUsages).values({
    id: did("partuse:1"),
    tenantId: DEMO_CONSTANTS.KINETIX_TENANT_ID,
    repairOrderId: repair1,
    sparePartId: partCellMumbai,
    quantity: 1,
    unitCostMinor: 32000,
  });

  await db.insert(rmaOrders).values({
    id: did("rma:RMA-KNX-2026-0019"),
    tenantId: DEMO_CONSTANTS.KINETIX_TENANT_ID,
    claimId: claimReplaced,
    rmaNumber: "RMA-KNX-2026-0019",
    direction: "RETURN_TO_VENDOR",
    carrierMode: "MANUAL",
    carrierName: "Blue Dart Surface Manual Challan",
    trackingNumber: "BD-DEL-9920184",
    inboundCondition: "Sealed box accessory complete; Port 1 MOSFET open-circuit",
    inspectionResult: "Confirmed factory SMT solder void on USB-C Port 1 controller",
    disposition: "RETURN_TO_VENDOR",
    replacementSerialId: s5Replacement,
    supplierRecoveryMinor: 112000,
    status: "CLOSED",
    isDemo: true,
  });

  // 12. Billing, Usage, Integrations, Automations, Notifications & Audit
  await db.insert(subscriptions).values([
    {
      id: did("sub:kinetix"),
      tenantId: DEMO_CONSTANTS.KINETIX_TENANT_ID,
      planCode: "GROWTH",
      billingCurrency: "INR",
      provider: "DEMO",
      status: "TRIALING",
      monthlyAmountMinor: 999900,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      isNonChargingDemo: true,
    },
    {
      id: did("sub:voltgrid"),
      tenantId: DEMO_CONSTANTS.VOLTGRID_TENANT_ID,
      planCode: "STARTER",
      billingCurrency: "INR",
      provider: "DEMO",
      status: "TRIALING",
      monthlyAmountMinor: 399900,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      isNonChargingDemo: true,
    },
  ]);

  await db.insert(usageCounters).values({
    id: did("usage:kinetix:2026-11"),
    tenantId: DEMO_CONSTANTS.KINETIX_TENANT_ID,
    periodYm: "2026-11",
    registrationsCount: 4,
    claimsCount: 3,
    aiSummariesCount: 1,
  });

  await db.insert(billingInvoices).values({
    id: did("inv:demo-001"),
    tenantId: DEMO_CONSTANTS.KINETIX_TENANT_ID,
    provider: "DEMO",
    externalInvoiceId: "DEMO-INV-2026-11",
    amountMinor: 0,
    taxMinor: 0,
    currency: "INR",
    status: "DRAFT",
    isDemoSimulated: true,
    issuedAt: periodStart,
  });

  await db.insert(integrationConnections).values([
    {
      id: did("int:shopify"),
      tenantId: DEMO_CONSTANTS.KINETIX_TENANT_ID,
      provider: "SHOPIFY",
      status: "PENDING_APP_REVIEW",
      displayName: "Shopify Storefront Webhook & Order CSV Sync",
      externalDomain: "kinetix-audio-in.myshopify.com",
      config: {
        appStoreListing: "pending_publication",
        customWebhookActive: true,
        supportedTopics: ["orders/create", "orders/fulfilled"],
      },
      lastSyncedAt: now,
    },
    {
      id: did("int:woocommerce"),
      tenantId: DEMO_CONSTANTS.KINETIX_TENANT_ID,
      provider: "WOOCOMMERCE",
      status: "DISCONNECTED",
      displayName: "WooCommerce REST v3 & HMAC Order Webhook",
      config: { version: "wc/v3" },
    },
    {
      id: did("int:marketplace-csv"),
      tenantId: DEMO_CONSTANTS.KINETIX_TENANT_ID,
      provider: "MARKETPLACE_CSV",
      status: "CONNECTED",
      displayName: "Amazon India & Flipkart Merchant Order CSV Importer",
      config: { scrapingUsed: false, ingestionMethod: "merchant_exported_csv_only" },
      lastSyncedAt: now,
    },
    {
      id: did("int:email"),
      tenantId: DEMO_CONSTANTS.KINETIX_TENANT_ID,
      provider: "EMAIL",
      status: "DEV_SINK",
      displayName: "Transactional Email (Audited Dev Sink unless RESEND_API_KEY set)",
      config: { from: "warranty@kinetix-audio.demo" },
    },
    {
      id: did("int:whatsapp"),
      tenantId: DEMO_CONSTANTS.KINETIX_TENANT_ID,
      provider: "WHATSAPP",
      status: "DEV_SINK",
      displayName: "Meta WhatsApp Business Cloud API Template Slot",
      config: { templateName: "warranty_status_update_v1", requiresMetaConfirmation: true },
    },
  ]);

  await db.insert(automationRules).values([
    {
      id: did("rule:doa-priority"),
      tenantId: DEMO_CONSTANTS.KINETIX_TENANT_ID,
      name: "Flag DOA claims within 7 days of purchase as URGENT priority",
      triggerEvent: "CLAIM_SUBMITTED",
      conditionJson: { faultCategory: "DOA", withinDoaWindow: true },
      actionType: "TAG_PRIORITY",
      actionConfig: { priority: "URGENT" },
      enabled: true,
    },
    {
      id: did("rule:dispatch-notify"),
      tenantId: DEMO_CONSTANTS.KINETIX_TENANT_ID,
      name: "Send customer tracking update when bench marks repair DISPATCHED",
      triggerEvent: "REPAIR_DISPATCHED",
      conditionJson: {},
      actionType: "NOTIFY_CHANNEL",
      actionConfig: { channel: "EMAIL", template: "repair_dispatched_v1" },
      enabled: true,
    },
  ]);

  await db.insert(notificationLogs).values([
    {
      id: did("notif:1"),
      tenantId: DEMO_CONSTANTS.KINETIX_TENANT_ID,
      claimId: claimTriage,
      channel: "EMAIL",
      recipientMasked: "an***@customer.demo",
      templateName: "claim_received_ack",
      subject: "[Kinetix Warranty] Claim CLM-KNX-2026-0101 received",
      deliveryStatus: "DEV_SINK",
    },
    {
      id: did("notif:2"),
      tenantId: DEMO_CONSTANTS.KINETIX_TENANT_ID,
      claimId: claimRepair,
      channel: "WHATSAPP",
      recipientMasked: "+91-98450-***09",
      templateName: "warranty_status_update_v1",
      subject: "Repair bench JOB-BOM-2026-0041 in progress",
      deliveryStatus: "DEV_SINK",
    },
  ]);

  await db.insert(auditLogs).values([
    {
      id: did("audit:1"),
      tenantId: DEMO_CONSTANTS.KINETIX_TENANT_ID,
      actorUserId: ownerId,
      actorRole: "OWNER",
      action: "SEED_INITIALIZED",
      entityType: "TENANT",
      entityId: DEMO_CONSTANTS.KINETIX_TENANT_ID,
      ipHash: "seed",
      summary: "Initialized synthetic demonstration workspace for Kinetix Audio.",
      metadata: { synthetic: true },
      createdAt: ninetyDaysAgo,
    },
    {
      id: did("audit:2"),
      tenantId: DEMO_CONSTANTS.KINETIX_TENANT_ID,
      actorUserId: supportId,
      actorRole: "SUPPORT",
      action: "CLAIM_APPROVED_REPAIR",
      entityType: "CLAIM",
      entityId: claimRepair,
      ipHash: "seed",
      summary: "Approved claim CLM-KNX-2026-0102 for bench repair at BOM-HUB-01.",
      metadata: { jobNumber: "JOB-BOM-2026-0041" },
      createdAt: new Date("2026-11-08T11:30:00.000Z"),
    },
  ]);
}
