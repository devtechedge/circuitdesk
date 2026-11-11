import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { DEMO_CONSTANTS, did } from "@/demo/ids";
import { privateBlobs } from "@/db/schema";
import { generateClaimTriageSummary } from "@/services/ai-triage";
import {
  buildTenantGstCsvExport,
  computeTenantAnalytics,
} from "@/services/analytics";
import { createProduct, createWarrantyPolicy } from "@/services/catalog";
import {
  adjudicateClaimByHuman,
  getPublicClaimTracker,
  submitPublicWarrantyClaim,
} from "@/services/claims";
import {
  getCertificateBySecureToken,
  reviewOrRevokeRegistration,
  submitPublicWarrantyRegistration,
} from "@/services/registrations";
import {
  consumeSparePartOnRepair,
  updateRepairBenchStage,
} from "@/services/repairs";
import { previewOrCommitSerialCsv } from "@/services/serials";
import { updateRmaDisposition } from "@/services/rma";
import { readDecryptedEvidence } from "@/storage/private-blobs";
import { getTestDatabase, sessionForEmail } from "./helpers";

// Minimal valid 1x1 PNG header + IDAT + IEND for magic-byte upload verification
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64"
);

describe("end-to-end warranty, claim, encrypted evidence, repair, RMA & GST lifecycle", () => {
  it("connects SKU -> CSV import -> QR registration -> encrypted claim -> triage -> PIN repair -> QA dispatch -> analytics", async () => {
    const db = await getTestDatabase();
    const owner = await sessionForEmail(db, "ops@kinetix-audio.demo");

    // 1. Create SKU & Policy
    const product = await createProduct(
      owner,
      {
        brandId: DEMO_CONSTANTS.KINETIX_BRAND_ID,
        sku: "KNX-DAC-PRO",
        name: "Kinetix Studio USB-C DAC",
        category: "AUDIO",
        hsnCode: "85184000",
        unitCostMinor: 210000,
        retailPriceMinor: 649900,
      },
      "test",
      db
    );

    await createWarrantyPolicy(
      owner,
      {
        productId: product.id,
        name: "12m DAC Bench Policy",
        regionCode: "IN",
        salesChannel: "ALL",
        durationMonths: 12,
        doaWindowDays: 7,
        repairExtensionMonths: 0,
        requiresReceipt: true,
        offlineReviewRequired: true,
        coveredFaults: ["DOA", "CHARGING", "CONNECTIVITY", "BATTERY"],
        exclusionsNote: "Excludes bent USB-C plugs.",
        replaceCostThresholdMinor: 180000,
      },
      "test",
      db
    );

    // 2. Import Serials via CSV
    const csv = [
      "sku,serial_number,imei,batch_code,sales_channel,external_order_id,sold_at",
      "KNX-DAC-PRO,KNX-DAC-2611-0001,,BATCH-KNX-2026-Q3A,D2C_WEB,SHP-DAC-501,2026-11-02",
      "KNX-DAC-PRO,KNX-DAC-2611-0002,,BATCH-KNX-2026-Q3A,OFFLINE_RETAIL,INV-OFF-88,2026-11-03",
    ].join("\n");

    const imported = await previewOrCommitSerialCsv(
      owner,
      { csvText: csv, dryRun: false },
      db
    );
    expect(imported.importedCount).toBe(2);

    // 3. Online QR Registration activates immediately; Offline Retail enters PENDING_REVIEW
    const onlineReg = await submitPublicWarrantyRegistration(
      {
        brandSlug: "kinetix",
        input: {
          serialNumber: "KNX-DAC-2611-0001",
          customerName: "Devika Rao",
          customerEmail: "devika@customer.demo",
          customerPhone: "+91-98209-11223",
          customerPinCode: "400053",
          customerCity: "Mumbai",
          regionCode: "IN",
          salesChannel: "D2C_WEB",
          sourceMethod: "QR",
          orderReference: "SHP-DAC-501",
          purchaseDate: "2026-11-02",
          consentAccepted: true,
        },
      },
      db
    );
    expect(onlineReg.registration.status).toBe("ACTIVE");

    const certBefore = await getCertificateBySecureToken(
      { brandSlug: "kinetix", rawToken: onlineReg.rawCertificateToken },
      db
    );
    expect(certBefore?.certificate.serialMasked).toBe("KNX-****0001");

    const offlineReg = await submitPublicWarrantyRegistration(
      {
        brandSlug: "kinetix",
        input: {
          serialNumber: "KNX-DAC-2611-0002",
          customerName: "Arjun Kulkarni",
          customerEmail: "arjun@customer.demo",
          customerPhone: "+91-98111-22334",
          customerPinCode: "411038",
          customerCity: "Pune",
          regionCode: "IN",
          salesChannel: "OFFLINE_RETAIL",
          sourceMethod: "DEALER_RECEIPT",
          dealerName: "AudioMart Pune",
          orderReference: "INV-OFF-88",
          purchaseDate: "2026-11-03",
          consentAccepted: true,
        },
      },
      db
    );
    expect(offlineReg.registration.status).toBe("PENDING_REVIEW");

    const approvedOffline = await reviewOrRevokeRegistration(
      owner,
      { registrationId: offlineReg.registration.id, action: "APPROVE" },
      db
    );
    expect(approvedOffline.status).toBe("ACTIVE");

    await reviewOrRevokeRegistration(
      owner,
      { registrationId: offlineReg.registration.id, action: "REVOKE_TOKEN" },
      db
    );
    const revokedCert = await getCertificateBySecureToken(
      { brandSlug: "kinetix", rawToken: offlineReg.rawCertificateToken },
      db
    );
    expect(revokedCert).toBeNull();

    // 4. Customer submits Claim with PNG attachment; verify ciphertext in DB does NOT contain PNG header
    const claimResult = await submitPublicWarrantyClaim(
      {
        brandSlug: "kinetix",
        input: {
          serialNumber: "KNX-DAC-2611-0001",
          submittedByType: "CUSTOMER",
          customerName: "Devika Rao",
          customerEmail: "devika@customer.demo",
          customerPhone: "+91-98209-11223",
          shippingPinCode: "400053",
          shippingCity: "Mumbai",
          shippingAddress: "Link Road, Andheri West, Mumbai 400053",
          faultCategory: "CHARGING",
          symptomSummary: "USB-C host power drops intermittently",
          customerDescription:
            "Order SHP-DAC-501 loses USB-C enumeration when lightly flexed.",
          purchaseDate: "2026-11-02",
        },
        evidenceFile: {
          fileName: "receipt.png",
          mimeType: "image/png",
          bytes: TINY_PNG,
          kind: "RECEIPT",
        },
      },
      db
    );
    expect(claimResult.claim.status).toBe("IN_TRIAGE");

    const storedBlobs = await db
      .select()
      .from(privateBlobs)
      .where(eq(privateBlobs.tenantId, owner.tenantId));
    const pngBlob = storedBlobs.find((b) => b.mimeType === "image/png");
    expect(pngBlob).toBeDefined();
    expect(pngBlob!.encryptedEnvelope).not.toContain("iVBORw0KGgo");

    // 5. Optional AI Triage Summary cites evidence and never auto-declines
    const aiBrief = await generateClaimTriageSummary(
      owner,
      claimResult.claim.id,
      "test",
      db
    );
    expect(aiBrief.humanApprovalRequired).toBe(true);
    expect(aiBrief.extractedReceiptRef).toBe("SHP-DAC-501");

    // 6. Human approves repair -> PIN 400053 routes to Mumbai bench BOM-HUB-01
    const triaged = await adjudicateClaimByHuman(
      owner,
      claimResult.claim.id,
      {
        decision: "APPROVE_REPAIR",
        decisionNotes: "Route to Mumbai bench for USB-C daughterboard replacement.",
      },
      "test",
      db
    );
    expect(triaged.repairOrder).not.toBeNull();
    expect(triaged.repairOrder?.routingReason).toContain("400");

    // 7. Bench spare-part stock consumption & over-consumption guard
    const lowStockPartId = did("part:BOM:PRT-USBC-CTRL"); // seeded with 4 units on hand
    const consumed = await consumeSparePartOnRepair(
      owner,
      triaged.repairOrder!.id,
      { sparePartId: lowStockPartId, quantity: 1 },
      "test",
      db
    );
    expect(consumed.remainingStock).toBe(3);

    await expect(
      consumeSparePartOnRepair(
        owner,
        triaged.repairOrder!.id,
        { sparePartId: lowStockPartId, quantity: 10 },
        "test",
        db
      )
    ).rejects.toMatchObject({ status: 409, code: "INSUFFICIENT_PART_STOCK" });

    // 8. QA gate blocks dispatch when incomplete, then allows dispatch when all 4 pass
    await expect(
      updateRepairBenchStage(
        owner,
        triaged.repairOrder!.id,
        {
          stage: "DISPATCHED",
          inspectionNotes: "Replaced daughterboard",
          diagnosisCode: "USBC_PORT_RESOLDER",
          qaChecklist: {
            powerOn: true,
            chargeTest: true,
            burnIn: false,
            enclosureSeal: true,
          },
          labourCostMinor: 20000,
          freightCostMinor: 10000,
        },
        "test",
        db
      )
    ).rejects.toMatchObject({ status: 422, code: "QA_CHECKLIST_INCOMPLETE" });

    const dispatched = await updateRepairBenchStage(
      owner,
      triaged.repairOrder!.id,
      {
        stage: "DISPATCHED",
        inspectionNotes: "Replaced daughterboard and passed 2h burn-in",
        diagnosisCode: "USBC_PORT_RESOLDER",
        qaChecklist: {
          powerOn: true,
          chargeTest: true,
          burnIn: true,
          enclosureSeal: true,
        },
        labourCostMinor: 20000,
        freightCostMinor: 10000,
        returnCarrier: "Blue Dart",
        returnTrackingNumber: "BD-MUM-778899",
      },
      "test",
      db
    );
    expect(dispatched.stage).toBe("DISPATCHED");

    const tracker = await getPublicClaimTracker(
      { brandSlug: "kinetix", rawToken: claimResult.rawTrackingToken },
      db
    );
    expect(tracker?.claim.status).toBe("RESOLVED");
    expect(tracker?.repair?.returnTrackingNumber).toBe("BD-MUM-778899");

    // 9. E-Waste manifest required when scrapping RMA hardware
    await expect(
      updateRmaDisposition(
        owner,
        {
          rmaId: triaged.rmaOrder!.id,
          disposition: "SCRAP_EWASTE",
          supplierRecoveryMinor: 0,
          status: "CLOSED",
        },
        "test",
        db
      )
    ).rejects.toMatchObject({ status: 422, code: "EWASTE_MANIFEST_REQUIRED" });

    // 10. Analytics & CBIC GST exports
    const analytics = await computeTenantAnalytics(owner, { window: "90d" }, db);
    expect(analytics.headline.claimsCount).toBeGreaterThanOrEqual(4);
    const gstOem = await buildTenantGstCsvExport(owner, "oem_replacements", db);
    expect(gstOem.csvContent).toContain("CBIC Circular 195/07/2023-GST");

    // Verify seeded encrypted receipt decrypts cleanly
    const seededDecrypted = await readDecryptedEvidence(
      { tenantId: owner.tenantId, evidenceId: did("evidence:receipt-10482") },
      db
    );
    expect(seededDecrypted.bytes.toString("utf8")).toContain("SHP-IN-10482");
  });
});
