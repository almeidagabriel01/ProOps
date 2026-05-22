import { Resend } from "resend";

let resendClient: Resend | null = null;

export function getResend(): Resend {
  if (!resendClient) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) throw new Error("RESEND_API_KEY is not set");
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

export function getEmailFrom(): string {
  return process.env.EMAIL_FROM ?? "ProOps <noreply@proops.com.br>";
}

/**
 * Reply-To used for transactional emails when the caller does not override it.
 * Configurable so that we can shift to a different monitored mailbox without
 * rebuilding. Kept as a real, monitored address — `noreply@` survives the
 * From field, but a working Reply-To improves engagement scoring with Outlook
 * and lets recipients still reach support if they reply by reflex.
 */
export function getDefaultReplyTo(): string {
  return process.env.EMAIL_REPLY_TO ?? "gestao@proops.com.br";
}

/**
 * Mailto used for the List-Unsubscribe header. Opt-in via env: if not set,
 * the header is omitted (recommended for critical transactional mail like
 * password reset / email verification, where the user cannot opt out).
 *
 * When set, it MUST be a real, monitored mailbox — bouncing unsubscribe
 * requests hurts sender reputation more than no header at all.
 */
export function getUnsubscribeMailto(): string | null {
  const value = process.env.EMAIL_UNSUBSCRIBE_MAILTO?.trim();
  return value ? value : null;
}
