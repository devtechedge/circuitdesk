import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { did } from "@/demo/ids";
import { warrantyClaims } from "@/db/schema";
import { adjudicateClaimByHuman, getTenantClaimDetail } from "@/services/claims";
import { approveRecallCampaign, createRecallDraft } from "@/services/privacy";
import { getTenantRepairDetail } from "@/services/repairs";
import { listBatchesAndSerials, previewOrCommitSerialCsv } from "@/services/serials";
import { readDecryptedEvidence } from "@/storage/private-blobs";
import { getTestDatabase, sessionForEmail } from "./helpers";

describe("multi-tenant isolation, PostgreSQL RLS, IDOR denial & 7-role RBAC", () => {
  it("blocks cross-tenant claim reads, cross-tenant adjudication, and cross-tenant evidence access", async () => {
    const db = await getTestDatabase();
    const kinetixOwner = await sessionForEmail(db, "ops@kinetix-audio.demo");
    const rivalClaimId = did("claim:CLM-VGD-2026-0001");
    const kinetixEvidenceId = did("evidence:receipt-10482");
    const voltgridOwner = await sessionForEmail(db, "ops@voltgrid.demo");

    await expect(getTenantClaimDetail(kinetixOwner, rivalClaimId, db)).rejects.toMatchObject({
      status: 404,
      code: "CLAIM_NOT_FOUND",
    });

    await expect(
      adjudicateClaimByHuman(
        kinetixOwner,
        rivalClaimId,
        { decision: "CLOSE", decisionNotes: "Attempt cross-tenant mutation" },
        "test",
        db
      )
    ).rejects.toMatchObject({ status: 404 });

    // Rival tenant cannot decrypt Kinetix private receipt blob even if they guess the UUID
    await expect(
      readDecryptedEvidence(
        { tenantId: voltgridOwner.tenantId, evidenceId: kinetixEvidenceId },
        db
      )
    ).rejects.toMatchObject({ status: 404 });
  });

  it("enforces PostgreSQL Row-Level Security policies for a NOSUPERUSER database role", async () => {
    const db = await getTestDatabase();
    const kinetixOwner = await sessionForEmail(db, "ops@kinetix-audio.demo");

    await db.transaction(async (tx) => {
      await tx.execute(sql`
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'cd_rls_probe') THEN
            CREATE ROLE cd_rls_probe NOSUPERUSER NOBYPASSRLS;
          END IF;
        END $$;
      `);
      await tx.execute(sql`GRANT USAGE ON SCHEMA public TO cd_rls_probe`);
      await tx.execute(sql`GRANT SELECT ON TABLE warranty_claims TO cd_rls_probe`);
      await tx.execute(sql`SET LOCAL ROLE cd_rls_probe`);
      await tx.execute(
        sql`SELECT set_config('app.current_tenant_id', ${kinetixOwner.tenantId}, true)`
      );

      const visibleClaims = await tx
        .select({ tenantId: warrantyClaims.tenantId })
        .from(warrantyClaims);

      expect(visibleClaims.length).toBeGreaterThan(0);
      expect(visibleClaims.every((c) => c.tenantId === kinetixOwner.tenantId)).toBe(true);
    });
  });

  it("masks serials for Analyst/Read-Only and enforces role & bench boundaries", async () => {
    const db = await getTestDatabase();
    const owner = await sessionForEmail(db, "ops@kinetix-audio.demo");
    const support = await sessionForEmail(db, "support@kinetix-audio.demo");
    const tech = await sessionForEmail(db, "tech@kinetix-audio.demo");
    const analyst = await sessionForEmail(db, "analyst@kinetix-audio.demo");
    const viewer = await sessionForEmail(db, "viewer@kinetix-audio.demo");

    const ownerSerials = await listBatchesAndSerials(owner, undefined, db);
    const analystSerials = await listBatchesAndSerials(analyst, undefined, db);

    expect(ownerSerials.canUnmask).toBe(true);
    expect(ownerSerials.serials[0]?.serialDisplay).not.toContain("****");

    expect(analystSerials.canUnmask).toBe(false);
    expect(analystSerials.serials.every((s) => s.serialDisplay.includes("****"))).toBe(true);

    // Read-Only cannot import serials
    await expect(
      previewOrCommitSerialCsv(
        viewer,
        { csvText: "sku,serial_number\nKNX-ANC-PRO2,KNX-9999", dryRun: true },
        db
      )
    ).rejects.toMatchObject({ status: 403 });

    // Technician cannot adjudicate claims
    const triageClaimId = did("claim:CLM-KNX-2026-0101");
    await expect(
      adjudicateClaimByHuman(
        tech,
        triageClaimId,
        { decision: "REQUEST_INFO", decisionNotes: "Tech trying triage" },
        "test",
        db
      )
    ).rejects.toMatchObject({ status: 403 });

    // Technician CAN read Mumbai bench repair, CANNOT read Bengaluru bench repair
    const mumbaiRepairId = did("repair:JOB-BOM-2026-0041");
    const mumbaiDetail = await getTenantRepairDetail(tech, mumbaiRepairId, db);
    expect(mumbaiDetail.repair.jobNumber).toBe("JOB-BOM-2026-0041");

    const blrCentreId = did("centre:bengaluru-koramangala");
    const approvedToBlr = await adjudicateClaimByHuman(
      support,
      triageClaimId,
      {
        decision: "APPROVE_REPAIR",
        decisionNotes: "Route to BLR bench for technician isolation test",
        preferredServiceCentreId: blrCentreId,
      },
      "test",
      db
    );
    expect(approvedToBlr.repairOrder?.serviceCentreId).toBe(blrCentreId);

    await expect(
      getTenantRepairDetail(tech, approvedToBlr.repairOrder!.id, db)
    ).rejects.toMatchObject({ status: 403, code: "BENCH_ASSIGNMENT_DENIED" });

    // Recall audience requires Owner/Admin approval; Support cannot approve
    const batchId = did("batch:BATCH-KNX-2026-Q3B");
    const draft = await createRecallDraft(
      {
        session: owner,
        batchId,
        title: "Lot Q3B Cell Swap",
        reason: "High impedance",
      },
      db
    );
    expect(draft.status).toBe("DRAFT_AWAITING_APPROVAL");

    await expect(
      approveRecallCampaign({ session: support, campaignId: draft.id }, db)
    ).rejects.toMatchObject({ status: 403 });

    const approvedRecall = await approveRecallCampaign(
      { session: owner, campaignId: draft.id },
      db
    );
    expect(approvedRecall.status).toBe("APPROVED_READY");
  });
});
