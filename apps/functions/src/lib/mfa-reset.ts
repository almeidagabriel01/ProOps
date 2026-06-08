import { FieldValue } from "firebase-admin/firestore";
import { auth, db } from "../init";
import { logger } from "./logger";
import { sendEmail } from "../services/email/send-email";
import { renderMfaDisabledEmail } from "../services/email/templates/mfa-disabled";

/**
 * Shared MFA factor removal used by both the assisted reset (admin/master) and
 * the self-service email recovery flow. Removes the native Firebase MFA
 * factors, clears the custom WhatsApp-MFA flags on the user document, and fires
 * a best-effort security notification email.
 *
 * The notification email is best-effort (try/catch + log): a Resend failure
 * must NEVER block the factor removal — locking a user out of recovery because
 * an email provider hiccuped is worse than a missed notification.
 */
export async function clearUserMfaFactors(uid: string): Promise<void> {
  await auth.updateUser(uid, {
    multiFactor: { enrolledFactors: null },
  });

  await db.collection("users").doc(uid).set(
    {
      whatsappMfaEnabled: false,
      whatsappMfaPhone: FieldValue.delete(),
    },
    { merge: true },
  );

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
