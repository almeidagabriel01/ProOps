import { auth } from "../../init";

/**
 * Verify a Firebase ID token sent in a client error report and derive the
 * reporter's identity from the cryptographically verified claims. Best-effort:
 * returns null for any non-string / invalid / unverifiable token. NEVER throws,
 * and NEVER logs the token (or any fragment of it).
 */
export async function verifyReportIdentity(
  idToken: unknown,
): Promise<{ uid: string; tenantId: string | null } | null> {
  if (typeof idToken !== "string" || idToken.length === 0) return null;
  try {
    const decoded = await auth.verifyIdToken(idToken);
    const tenantId = (decoded as { tenantId?: unknown }).tenantId;
    return { uid: decoded.uid, tenantId: typeof tenantId === "string" ? tenantId : null };
  } catch {
    return null;
  }
}
