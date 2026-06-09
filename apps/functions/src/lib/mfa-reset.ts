import { FieldValue } from "firebase-admin/firestore";
import { auth, db } from "../init";
import { logger } from "./logger";
import { sendEmail } from "../services/email/send-email";
import { renderMfaDisabledEmail } from "../services/email/templates/mfa-disabled";

/**
 * Best-effort security notification fired after MFA factors are removed.
 *
 * A Resend failure must NEVER block the factor removal — locking a user out of
 * recovery because an email provider hiccuped is worse than a missed
 * notification. Hence the try/catch + log: this helper never throws.
 */
async function notifyMfaDisabled(uid: string): Promise<void> {
  try {
    let name: string | undefined;
    let email: string | undefined;

    const userSnap = await db.collection("users").doc(uid).get();
    const userData = userSnap.data() as { name?: string } | undefined;
    name = userData?.name;

    const userRecord = await auth.getUser(uid);
    email = userRecord.email ?? undefined;
    if (!name) name = userRecord.displayName ?? undefined;

    if (email) {
      const { subject, html, text } = renderMfaDisabledEmail({ name });
      await sendEmail({
        to: email,
        subject,
        html,
        text,
        type: "mfa_disabled",
      });
    } else {
      logger.warn("clearUserMfaFactors: no email to notify", { uid });
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn("clearUserMfaFactors: notification email failed", {
      uid,
      error: message,
    });
  }
}

/**
 * Shared MFA factor removal used by both the assisted reset (admin/master) and
 * the self-service recovery-code flow. Removes the native Firebase MFA factors
 * (the only enrolled factor is TOTP — WhatsApp is NOT a native Firebase factor)
 * and fires a best-effort security notification email.
 *
 * By default (`includeWhatsapp: true`) it also clears the custom WhatsApp-MFA
 * flags on the user document, fully disabling MFA. Existing callers (assisted
 * reset) rely on this behaviour.
 *
 * Pass `includeWhatsapp: false` to remove ONLY the native TOTP factor while
 * keeping the WhatsApp MFA flags intact — used when a user recovers from a lost
 * TOTP authenticator but should remain protected by WhatsApp 2FA.
 */
export async function clearUserMfaFactors(
  uid: string,
  opts?: { includeWhatsapp?: boolean },
): Promise<void> {
  const includeWhatsapp = opts?.includeWhatsapp ?? true;

  await auth.updateUser(uid, {
    multiFactor: { enrolledFactors: null },
  });

  if (includeWhatsapp) {
    await db.collection("users").doc(uid).set(
      {
        whatsappMfaEnabled: false,
        whatsappMfaPhone: FieldValue.delete(),
      },
      { merge: true },
    );
  }

  await notifyMfaDisabled(uid);
}
