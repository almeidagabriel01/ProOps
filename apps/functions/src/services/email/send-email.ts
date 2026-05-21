import { FieldValue } from "firebase-admin/firestore";
import { db } from "../../init";
import { logger } from "../../lib/logger";
import { getEmailFrom, getResend } from "./resend-client";

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  /** Optional reply-to address. Defaults to the From address. */
  replyTo?: string;
  /** Extra raw headers passed through to Resend (e.g. List-Unsubscribe). */
  headers?: Record<string, string>;
  /** Resend tags for searchability in the dashboard. */
  tags?: { name: string; value: string }[];
  tenantId?: string;
  type?: string;
}

export interface SendEmailResult {
  ok: boolean;
  messageId?: string;
  error?: string;
}

const DEFAULT_REPLY_TO = "gestao@proops.com.br";

function generateEntityRefId(type: string | undefined): string {
  const safeType = (type || "transactional").replace(/[^a-z0-9_-]/gi, "_");
  return `${safeType}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function sendEmail(
  opts: SendEmailOptions,
): Promise<SendEmailResult> {
  const from = getEmailFrom();
  const replyTo = opts.replyTo || DEFAULT_REPLY_TO;
  const entityRefId = generateEntityRefId(opts.type);

  const baseHeaders: Record<string, string> = {
    "X-Entity-Ref-ID": entityRefId,
    "Auto-Submitted": "auto-generated",
    "X-Auto-Response-Suppress": "All",
  };
  const headers: Record<string, string> = { ...baseHeaders, ...opts.headers };

  try {
    const resend = getResend();
    const payload: {
      from: string;
      to: string;
      subject: string;
      html: string;
      text?: string;
      replyTo?: string;
      headers?: Record<string, string>;
      tags?: { name: string; value: string }[];
    } = {
      from,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      replyTo,
      headers,
    };
    if (opts.text) payload.text = opts.text;
    if (opts.tags && opts.tags.length > 0) payload.tags = opts.tags;
    else if (opts.type) {
      payload.tags = [{ name: "type", value: opts.type.replace(/[^a-z0-9_-]/gi, "_").slice(0, 50) }];
    }

    const result = await resend.emails.send(payload);

    const messageId = result.data?.id;

    db.collection("email_audit")
      .add({
        tenantId: opts.tenantId ?? null,
        type: opts.type ?? "unknown",
        to: opts.to,
        subject: opts.subject,
        messageId: messageId ?? null,
        entityRefId,
        status: "sent",
        sentAt: new Date().toISOString(),
        createdAt: FieldValue.serverTimestamp(),
      })
      .catch((auditErr: unknown) => {
        logger.error("[sendEmail] failed to write email_audit", {
          error: String(auditErr),
        });
      });

    logger.info("[sendEmail] sent", {
      to: opts.to,
      type: opts.type,
      messageId,
      tenantId: opts.tenantId,
      entityRefId,
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

    db.collection("email_audit")
      .add({
        tenantId: opts.tenantId ?? null,
        type: opts.type ?? "unknown",
        to: opts.to,
        subject: opts.subject,
        messageId: null,
        entityRefId,
        status: "failed",
        error: errMsg.slice(0, 500),
        sentAt: new Date().toISOString(),
        createdAt: FieldValue.serverTimestamp(),
      })
      .catch(() => {});

    return { ok: false, error: errMsg };
  }
}
