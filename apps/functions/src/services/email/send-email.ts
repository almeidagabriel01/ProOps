import { FieldValue } from "firebase-admin/firestore";
import { db } from "../../init";
import { logger } from "../../lib/logger";
import { getEmailFrom, getResend } from "./resend-client";

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  tenantId?: string;
  type?: string;
}

export interface SendEmailResult {
  ok: boolean;
  messageId?: string;
  error?: string;
}

export async function sendEmail(
  opts: SendEmailOptions,
): Promise<SendEmailResult> {
  const from = getEmailFrom();
  try {
    const resend = getResend();
    const payload: {
      from: string;
      to: string;
      subject: string;
      html: string;
      text?: string;
    } = {
      from,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    };
    if (opts.text) payload.text = opts.text;
    const result = await resend.emails.send(payload);

    const messageId = result.data?.id;

    if (opts.tenantId) {
      db.collection("email_audit")
        .add({
          tenantId: opts.tenantId,
          type: opts.type ?? "unknown",
          to: opts.to,
          subject: opts.subject,
          messageId: messageId ?? null,
          status: "sent",
          sentAt: new Date().toISOString(),
          createdAt: FieldValue.serverTimestamp(),
        })
        .catch((auditErr: unknown) => {
          logger.error("[sendEmail] failed to write email_audit", {
            error: String(auditErr),
          });
        });
    }

    logger.info("[sendEmail] sent", {
      to: opts.to,
      type: opts.type,
      messageId,
      tenantId: opts.tenantId,
    });

    return { ok: true, messageId };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    logger.error("[sendEmail] failed", {
      to: opts.to,
      type: opts.type,
      tenantId: opts.tenantId,
      error: errMsg,
    });
    return { ok: false, error: errMsg };
  }
}
