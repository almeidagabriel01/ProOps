/**
 * Picks the email for the "lost my 2FA method" recovery request triggered from
 * the WhatsApp OTP screen.
 *
 * At that stage the Firebase sign-in already completed (only the __session
 * cookie is withheld), so the signed-in user's email is authoritative. This
 * matters for Google sign-in, where the login form's typed `email` is empty —
 * without the fallback the recovery wrongly errored with "informe o e-mail".
 * Falls back to the typed email for other entry points (e.g. password login).
 */
export function resolveRecoveryEmail(
  currentUserEmail: string | null | undefined,
  formEmail: string,
): string {
  return (currentUserEmail || formEmail || "").trim();
}
