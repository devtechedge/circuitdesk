import { desc, eq } from "drizzle-orm";
import type { AuthenticatedSession } from "@/auth/session";
import { getEnv } from "@/env";
import { getDb, type Database, type DbExecutor } from "@/db/client";
import { withTenantDb } from "@/db/tenant";
import { notificationLogs } from "@/db/schema";
import { maskEmail, maskPhone } from "@/security/serial-mask";

export async function dispatchEmailNotification(
  params: {
    tenantId: string;
    claimId?: string | null;
    toEmail: string;
    templateName: string;
    subject: string;
    textBody: string;
  },
  executor?: DbExecutor
): Promise<{ status: "DEV_SINK" | "SENT_UNCONFIRMED" | "FAILED"; providerMessageId: string | null }> {
  const db = executor ?? (await getDb());
  const env = getEnv();
  const recipientMasked = maskEmail(params.toEmail);

  if (!env.RESEND_API_KEY?.trim()) {
    await db.insert(notificationLogs).values({
      tenantId: params.tenantId,
      claimId: params.claimId ?? null,
      channel: "EMAIL",
      recipientMasked,
      templateName: params.templateName,
      subject: params.subject,
      deliveryStatus: "DEV_SINK",
      providerMessageId: null,
    });
    return { status: "DEV_SINK", providerMessageId: null };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.RESEND_API_KEY.trim()}`,
      },
      body: JSON.stringify({
        from: env.EMAIL_FROM,
        to: [params.toEmail],
        subject: params.subject,
        text: params.textBody,
      }),
    });

    if (!res.ok) {
      await db.insert(notificationLogs).values({
        tenantId: params.tenantId,
        claimId: params.claimId ?? null,
        channel: "EMAIL",
        recipientMasked,
        templateName: params.templateName,
        subject: params.subject,
        deliveryStatus: "FAILED",
      });
      return { status: "FAILED", providerMessageId: null };
    }

    const body = (await res.json()) as { id?: string };
    const providerMessageId = body.id ?? null;
    await db.insert(notificationLogs).values({
      tenantId: params.tenantId,
      claimId: params.claimId ?? null,
      channel: "EMAIL",
      recipientMasked,
      templateName: params.templateName,
      subject: params.subject,
      deliveryStatus: "SENT_UNCONFIRMED",
      providerMessageId,
    });
    return { status: "SENT_UNCONFIRMED", providerMessageId };
  } catch {
    await db.insert(notificationLogs).values({
      tenantId: params.tenantId,
      claimId: params.claimId ?? null,
      channel: "EMAIL",
      recipientMasked,
      templateName: params.templateName,
      subject: params.subject,
      deliveryStatus: "FAILED",
    });
    return { status: "FAILED", providerMessageId: null };
  }
}

/**
 * Dispatches a Meta WhatsApp Business Cloud API template message.
 * Delivery is NEVER marked DELIVERED_CONFIRMED on HTTP 200 send; it remains
 * SENT_UNCONFIRMED until Meta delivers a signed delivery webhook receipt.
 */
export async function dispatchWhatsAppTemplate(
  params: {
    tenantId: string;
    claimId?: string | null;
    toPhoneE164: string;
    templateName: string;
    summaryLine: string;
    bodyVariables: string[];
  },
  executor?: DbExecutor
): Promise<{ status: "DEV_SINK" | "SENT_UNCONFIRMED" | "FAILED"; providerMessageId: string | null }> {
  const db = executor ?? (await getDb());
  const env = getEnv();
  const recipientMasked = maskPhone(params.toPhoneE164);

  if (!env.WHATSAPP_ACCESS_TOKEN?.trim() || !env.WHATSAPP_PHONE_NUMBER_ID?.trim()) {
    await db.insert(notificationLogs).values({
      tenantId: params.tenantId,
      claimId: params.claimId ?? null,
      channel: "WHATSAPP",
      recipientMasked,
      templateName: params.templateName,
      subject: params.summaryLine,
      deliveryStatus: "DEV_SINK",
      providerMessageId: null,
    });
    return { status: "DEV_SINK", providerMessageId: null };
  }

  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${encodeURIComponent(
        env.WHATSAPP_PHONE_NUMBER_ID.trim()
      )}/messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN.trim()}`,
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: params.toPhoneE164.replace(/\D/g, ""),
          type: "template",
          template: {
            name: params.templateName,
            language: { code: "en" },
            components: [
              {
                type: "body",
                parameters: params.bodyVariables.map((v) => ({ type: "text", text: v })),
              },
            ],
          },
        }),
      }
    );

    if (!res.ok) {
      await db.insert(notificationLogs).values({
        tenantId: params.tenantId,
        claimId: params.claimId ?? null,
        channel: "WHATSAPP",
        recipientMasked,
        templateName: params.templateName,
        subject: params.summaryLine,
        deliveryStatus: "FAILED",
      });
      return { status: "FAILED", providerMessageId: null };
    }

    const body = (await res.json()) as { messages?: Array<{ id?: string }> };
    const wamid = body.messages?.[0]?.id ?? null;

    await db.insert(notificationLogs).values({
      tenantId: params.tenantId,
      claimId: params.claimId ?? null,
      channel: "WHATSAPP",
      recipientMasked,
      templateName: params.templateName,
      subject: params.summaryLine,
      deliveryStatus: "SENT_UNCONFIRMED",
      providerMessageId: wamid,
    });
    return { status: "SENT_UNCONFIRMED", providerMessageId: wamid };
  } catch {
    return { status: "FAILED", providerMessageId: null };
  }
}

export async function confirmWhatsAppDeliveryReceipt(
  providerMessageId: string,
  dbOverride?: Database
): Promise<boolean> {
  const db = dbOverride ?? (await getDb());
  const updated = await db
    .update(notificationLogs)
    .set({ deliveryStatus: "DELIVERED_CONFIRMED" })
    .where(eq(notificationLogs.providerMessageId, providerMessageId))
    .returning({ id: notificationLogs.id });

  return updated.length > 0;
}

export async function listNotificationLogs(
  session: AuthenticatedSession,
  dbOverride?: Database
) {
  return withTenantDb(
    session.tenantId,
    async (tx) =>
      tx
        .select()
        .from(notificationLogs)
        .where(eq(notificationLogs.tenantId, session.tenantId))
        .orderBy(desc(notificationLogs.createdAt))
        .limit(100),
    dbOverride
  );
}
