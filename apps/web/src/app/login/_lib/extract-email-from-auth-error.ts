import { GoogleAuthProvider, type AuthError } from "firebase/auth";

/**
 * Best-effort extraction of the account e-mail from a Firebase MFA error.
 *
 * Used on the native TOTP screen reached via Google sign-in, where the login
 * form e-mail is empty — we need the e-mail to probe whether the account can
 * receive its 2FA code via WhatsApp. On `auth/multi-factor-auth-required`,
 * Firebase attaches the federated sign-in server response to the error; the
 * exact location varies across SDK builds, so we check every known field before
 * falling back to decoding the Google OAuth credential's ID token (JWT) `email`
 * claim. Returns "" when nothing is available — the WhatsApp option just won't
 * appear (graceful degradation).
 */
export function extractEmailFromAuthError(error: unknown): string {
  const err = error as {
    email?: string;
    customData?: {
      email?: string;
      _tokenResponse?: { email?: string };
      _serverResponse?: { email?: string };
    };
    _tokenResponse?: { email?: string };
  };

  const direct =
    err?.customData?.email ||
    err?.customData?._tokenResponse?.email ||
    err?.customData?._serverResponse?.email ||
    err?._tokenResponse?.email ||
    err?.email;
  if (direct) return direct;

  try {
    const credential = GoogleAuthProvider.credentialFromError(
      error as AuthError,
    );
    const idToken = (credential as { idToken?: string } | null)?.idToken;
    if (idToken) {
      const payloadPart = idToken.split(".")[1];
      if (payloadPart) {
        const payload = JSON.parse(atob(payloadPart)) as { email?: unknown };
        if (typeof payload.email === "string") return payload.email;
      }
    }
  } catch {
    // ignore — fall through to ""
  }

  return "";
}
