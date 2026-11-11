import { and, eq } from "drizzle-orm";
import { z } from "zod";
import type { AuthenticatedSession } from "@/auth/session";
import { getEnv } from "@/env";
import type { Database } from "@/db/client";
import { withTenantDb } from "@/db/tenant";
import {
  type AiClaimSummary,
  claimEvidence,
  FAULT_CATEGORIES,
  type FaultCategory,
  productionBatches,
  products,
  serialUnits,
  usageCounters,
  warrantyClaims,
  warrantyRegistrations,
} from "@/db/schema";
import { AppError } from "@/lib/errors";
import { assertPermission } from "@/security/rbac";
import { recordAuditLog } from "./audit";

const aiOutputSchema = z.object({
  evidenceSummary: z.string().min(10).max(600),
  extractedReceiptRef: z.string().max(80).nullable(),
  suggestedFaultCategory: z.enum(FAULT_CATEGORIES),
  // Architectural guardrail: AI can NEVER output a decline/reject action
  suggestedNextAction: z.enum([
    "REQUEST_RECEIPT",
    "ROUTE_REPAIR_BENCH",
    "REPLACE_DOA",
    "HUMAN_INSPECTION",
  ]),
  draftCustomerReply: z.string().min(10).max(800),
});

function inferDeterministicFault(text: string, fallback: FaultCategory): FaultCategory {
  const lower = text.toLowerCase();
  if (/dead on arrival|out of box|0v|never powered/.test(lower)) return "DOA";
  if (/battery|drain|mah|charge hold|shuts off/.test(lower)) return "BATTERY";
  if (/usb-c|port|charging|charger|adapter|power/.test(lower)) return "CHARGING";
  if (/bluetooth|pair|wifi|disconnect|sync/.test(lower)) return "CONNECTIVITY";
  if (/crack|drop|water|liquid|dent|broken glass/.test(lower)) return "PHYSICAL_DAMAGE";
  if (/missing|cable not in box|ear tip/.test(lower)) return "MISSING_PARTS";
  if (/firmware|bootloop|update|app/.test(lower)) return "SOFTWARE_FIRMWARE";
  return fallback;
}

function buildDeterministicSummary(params: {
  claimNumber: string;
  customerFirstName: string;
  productName: string;
  sku: string;
  faultCategory: FaultCategory;
  symptomSummary: string;
  customerDescription: string;
  withinCoverageWindow: boolean;
  withinDoaWindow: boolean;
  faultCoveredByPolicy: boolean;
  registrationRef: string | null;
  orderRef: string | null;
  batchCode: string | null;
  evidenceFiles: string[];
}): AiClaimSummary {
  const combinedText = `${params.symptomSummary} ${params.customerDescription}`;
  const regexInvoice = combinedText.match(/\b(?:SHP|AMZ|FLK|INV|ORD)-[A-Z0-9-]{3,24}\b/i)?.[0] ?? null;
  const extractedReceiptRef = params.orderRef ?? regexInvoice;
  const suggestedFaultCategory = inferDeterministicFault(combinedText, params.faultCategory);

  let suggestedNextAction: AiClaimSummary["suggestedNextAction"] = "ROUTE_REPAIR_BENCH";
  if (!extractedReceiptRef && params.evidenceFiles.length === 0) {
    suggestedNextAction = "REQUEST_RECEIPT";
  } else if (!params.withinCoverageWindow || !params.faultCoveredByPolicy) {
    suggestedNextAction = "HUMAN_INSPECTION";
  } else if (params.withinDoaWindow && suggestedFaultCategory === "DOA") {
    suggestedNextAction = "REPLACE_DOA";
  }

  const citations: string[] = [
    `Claim ${params.claimNumber} (${params.sku})`,
    params.withinCoverageWindow
      ? "Policy Snapshot: Within active coverage window"
      : "Policy Snapshot: Outside standard window (human verification required)",
  ];
  if (params.registrationRef) citations.push(`Registration: ${params.registrationRef}`);
  if (extractedReceiptRef) citations.push(`Extracted Order/Invoice Ref: ${extractedReceiptRef}`);
  if (params.batchCode) citations.push(`Factory Batch: ${params.batchCode}`);
  for (const file of params.evidenceFiles) {
    citations.push(`Private Evidence Attachment: ${file}`);
  }

  return {
    provider: "deterministic-fallback",
    generatedAt: new Date().toISOString(),
    evidenceSummary: `Reported "${params.symptomSummary}" on ${params.productName} (${params.sku}). ${
      extractedReceiptRef
        ? `Matched purchase reference ${extractedReceiptRef}.`
        : "No structured invoice reference detected in text."
    } Coverage check: ${
      params.withinCoverageWindow ? "in-window" : "out-of-window"
    }; policy fault match: ${params.faultCoveredByPolicy ? "covered" : "requires human inspection"}.`,
    extractedReceiptRef,
    suggestedFaultCategory,
    suggestedNextAction,
    draftCustomerReply:
      suggestedNextAction === "REQUEST_RECEIPT"
        ? `Hello ${params.customerFirstName}, thank you for contacting warranty support regarding ${params.productName} (${params.claimNumber}). Please upload a clear photo or PDF of your purchase invoice so our team can complete coverage verification.`
        : `Hello ${params.customerFirstName}, we have reviewed the details for ${params.productName} (${params.claimNumber}) and queued your unit for human warranty adjudication by our service team.`,
    sourceCitations: citations,
    humanApprovalRequired: true,
  };
}

export async function generateClaimTriageSummary(
  session: AuthenticatedSession,
  claimId: string,
  ipHash?: string,
  dbOverride?: Database
): Promise<AiClaimSummary> {
  assertPermission(session.role, "claims:adjudicate");
  const env = getEnv();

  return withTenantDb(
    session.tenantId,
    async (tx) => {
      const rows = await tx
        .select({
          claim: warrantyClaims,
          product: products,
          unit: serialUnits,
        })
        .from(warrantyClaims)
        .innerJoin(products, eq(warrantyClaims.productId, products.id))
        .innerJoin(serialUnits, eq(warrantyClaims.serialUnitId, serialUnits.id))
        .where(and(eq(warrantyClaims.id, claimId), eq(warrantyClaims.tenantId, session.tenantId)))
        .limit(1);

      const entry = rows[0];
      if (!entry) {
        throw new AppError(404, "CLAIM_NOT_FOUND", "Claim not found.");
      }

      const [reg] = entry.claim.registrationId
        ? await tx
            .select()
            .from(warrantyRegistrations)
            .where(eq(warrantyRegistrations.id, entry.claim.registrationId))
            .limit(1)
        : [undefined];

      const [batch] = entry.unit.batchId
        ? await tx
            .select()
            .from(productionBatches)
            .where(eq(productionBatches.id, entry.unit.batchId))
            .limit(1)
        : [undefined];

      const evidenceRows = await tx
        .select({ fileName: claimEvidence.fileName, kind: claimEvidence.kind })
        .from(claimEvidence)
        .where(
          and(
            eq(claimEvidence.tenantId, session.tenantId),
            eq(claimEvidence.claimId, entry.claim.id)
          )
        );

      const firstName = entry.claim.customerName.split(" ")[0] || "Customer";
      const deterministic = buildDeterministicSummary({
        claimNumber: entry.claim.claimNumber,
        customerFirstName: firstName,
        productName: entry.product.name,
        sku: entry.product.sku,
        faultCategory: entry.claim.faultCategory,
        symptomSummary: entry.claim.symptomSummary,
        customerDescription: entry.claim.customerDescription,
        withinCoverageWindow: entry.claim.policySnapshot.withinCoverageWindow,
        withinDoaWindow: entry.claim.policySnapshot.withinDoaWindow,
        faultCoveredByPolicy: entry.claim.policySnapshot.faultCoveredByPolicy,
        registrationRef: reg?.registrationNumber ?? null,
        orderRef: reg?.orderReference ?? entry.unit.externalOrderId ?? null,
        batchCode: batch?.batchCode ?? null,
        evidenceFiles: evidenceRows.map((e) => `${e.kind}:${e.fileName}`),
      });

      let finalSummary: AiClaimSummary = deterministic;

      if (env.AI_API_KEY?.trim()) {
        try {
          const res = await fetch(`${env.AI_BASE_URL.replace(/\/$/, "")}/chat/completions`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${env.AI_API_KEY.trim()}`,
            },
            body: JSON.stringify({
              model: env.AI_MODEL,
              response_format: { type: "json_object" },
              messages: [
                {
                  role: "system",
                  content:
                    "Summarize electronics warranty claim evidence into strict JSON keys: evidenceSummary, extractedReceiptRef, suggestedFaultCategory, suggestedNextAction (one of REQUEST_RECEIPT, ROUTE_REPAIR_BENCH, REPLACE_DOA, HUMAN_INSPECTION), draftCustomerReply. Never decide coverage denial.",
                },
                {
                  role: "user",
                  content: JSON.stringify({
                    sku: entry.product.sku,
                    productName: entry.product.name,
                    reportedFault: entry.claim.faultCategory,
                    symptom: entry.claim.symptomSummary,
                    description: entry.claim.customerDescription,
                    policySnapshot: entry.claim.policySnapshot,
                    evidenceCount: evidenceRows.length,
                  }),
                },
              ],
            }),
          });

          if (res.ok) {
            const payload = (await res.json()) as {
              choices?: Array<{ message?: { content?: string } }>;
            };
            const content = payload.choices?.[0]?.message?.content;
            if (content) {
              const validated = aiOutputSchema.parse(JSON.parse(content));
              finalSummary = {
                ...validated,
                provider: "openai-compatible",
                generatedAt: new Date().toISOString(),
                sourceCitations: deterministic.sourceCitations,
                humanApprovalRequired: true,
              };
            }
          }
        } catch {
          // Graceful fallback to deterministic evidence extractor
          finalSummary = deterministic;
        }
      }

      // Update ONLY ai_summary; claim status and coverage decision remain strictly human-owned
      await tx
        .update(warrantyClaims)
        .set({ aiSummary: finalSummary })
        .where(eq(warrantyClaims.id, entry.claim.id));

      const now = new Date();
      const periodYm = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
      const [usage] = await tx
        .select()
        .from(usageCounters)
        .where(
          and(eq(usageCounters.tenantId, session.tenantId), eq(usageCounters.periodYm, periodYm))
        )
        .limit(1);

      await tx
        .insert(usageCounters)
        .values({
          tenantId: session.tenantId,
          periodYm,
          registrationsCount: 0,
          claimsCount: 0,
          aiSummariesCount: 1,
        })
        .onConflictDoUpdate({
          target: [usageCounters.tenantId, usageCounters.periodYm],
          set: {
            aiSummariesCount: (usage?.aiSummariesCount ?? 0) + 1,
            updatedAt: now,
          },
        });

      await recordAuditLog(
        {
          tenantId: session.tenantId,
          actorUserId: session.userId,
          actorRole: session.role,
          action: "CLAIM_AI_SUMMARY_GENERATED",
          entityType: "CLAIM",
          entityId: entry.claim.id,
          ipHash,
          summary: `Generated ${finalSummary.provider} triage summary for ${entry.claim.claimNumber} (human approval required).`,
        },
        tx
      );

      return finalSummary;
    },
    dbOverride
  );
}
