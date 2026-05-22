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
 * Mailto used for the List-Unsubscribe header on transactional emails. Outlook
 * uses the presence of this header as a positive signal that the sender
 * follows bulk-sending best-practices, even for one-to-one transactional mail.
 * Required value, but never auto-triggered for password resets — kept as a
 * mailto so accidental triggering is a no-op.
 */
export function getUnsubscribeMailto(): string {
  return (
    process.env.EMAIL_UNSUBSCRIBE_MAILTO ?? "unsubscribe@proops.com.br"
  );
}
