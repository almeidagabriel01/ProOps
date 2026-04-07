/**
 * Node.js helper that calls the Firebase Auth emulator REST API directly.
 * Used in AUTH-04 tests to verify custom claims without a browser context.
 */

export interface SignInResponse {
  idToken: string;
  refreshToken: string;
  localId: string;
  email: string;
}

export interface TokenClaims {
  uid: string;
  email: string;
  tenantId?: string;
  role?: string;
  masterId?: string;
  isSuperAdmin?: boolean;
  [key: string]: unknown;
}

const AUTH_EMULATOR_URL =
  "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-key";

/**
 * Signs in via the Auth emulator REST API and returns the raw sign-in response.
 */
export async function signInWithEmailPassword(
  email: string,
  password: string,
): Promise<SignInResponse> {
  const response = await fetch(AUTH_EMULATOR_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Auth emulator sign-in failed (${response.status}): ${body}`);
  }

  return (await response.json()) as SignInResponse;
}

/**
 * Decodes the payload section (middle part) of a JWT without verifying the signature.
 * Handles base64url encoding differences from standard base64.
 */
export function decodeJwtPayload(idToken: string): Record<string, unknown> {
  const parts = idToken.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid JWT format — expected 3 dot-separated parts");
  }

  // base64url → base64: replace URL-safe chars, then pad to a multiple of 4
  const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  const json = Buffer.from(padded, "base64").toString("utf-8");

  return JSON.parse(json) as Record<string, unknown>;
}

/**
 * Signs in and decodes the resulting ID token, returning normalized custom claims.
 * Firebase tokens use the 'user_id' field (not 'sub') for the UID.
 */
export async function getIdTokenClaims(
  email: string,
  password: string,
): Promise<TokenClaims> {
  const { idToken } = await signInWithEmailPassword(email, password);
  const payload = decodeJwtPayload(idToken);

  return {
    uid: (payload["user_id"] as string) ?? (payload["sub"] as string),
    email: payload["email"] as string,
    tenantId: payload["tenantId"] as string | undefined,
    role: payload["role"] as string | undefined,
    masterId: payload["masterId"] as string | undefined,
    isSuperAdmin: payload["isSuperAdmin"] as boolean | undefined,
    ...payload,
  };
}
