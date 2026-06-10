/**
 * Pure decision logic for the client-side handling of the `/api/auth/session`
 * 200 response body. Keeping it here (instead of inline in the auth provider)
 * makes the WhatsApp-MFA gate independently testable and lets both
 * `syncServerSession` and `finalizeLogin` interpret the response identically.
 *
 * The route returns HTTP 200 in two shapes:
 * - cookie emitted (normal login, super-admin, native-2FA-satisfied) → no
 *   `mfaRequired` flag, or `mfaRequired` without `method: "whatsapp"`.
 * - cookie WITHHELD pending a WhatsApp OTP → `{ mfaRequired: true,
 *   method: "whatsapp", maskedPhone }`.
 *
 * Only the WhatsApp shape must be treated as "not yet synced". Crucially the
 * super-admin gate also returns `{ mfaRequired: true }` but WITHOUT
 * `method: "whatsapp"` — that path keeps syncing as before.
 */

/** Shape of the `/api/auth/session` 200 body we care about. */
export interface SessionResponseBody {
  mfaRequired?: boolean;
  method?: string;
  maskedPhone?: string;
}

/**
 * - `synced`               — cookie was emitted; mark the session synced.
 * - `whatsapp-otp-pending` — cookie withheld pending a WhatsApp OTP; do NOT
 *                            mark synced and do NOT re-POST (the challenge
 *                            endpoint is not idempotent).
 */
export type SessionInterpretation = "synced" | "whatsapp-otp-pending";

export function interpretSessionResponse(
  body: SessionResponseBody | null | undefined,
): SessionInterpretation {
  if (body?.mfaRequired === true && body.method === "whatsapp") {
    return "whatsapp-otp-pending";
  }
  return "synced";
}
