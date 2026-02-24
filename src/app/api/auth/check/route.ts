import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

const SESSION_COOKIE_NAME = "__session";

/**
 * GET /api/auth/check
 *
 * Lightweight server-side session validation.
 * Verifies the `__session` cookie using Firebase Admin and returns
 * the authentication status + user role so the client can show
 * an appropriate loading state immediately (without waiting for
 * the Firebase client SDK to initialise).
 *
 * Does NOT create or refresh cookies — it is read-only.
 */
export async function GET(req: NextRequest) {
  try {
    const sessionCookie = req.cookies.get(SESSION_COOKIE_NAME)?.value;

    if (!sessionCookie) {
      return NextResponse.json({ authenticated: false }, { status: 200 });
    }

    const adminAuth = getAdminAuth();

    // checkRevoked = true → ensures the session hasn't been revoked
    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);

    // Optionally fetch the full user record for the role custom claim
    let role: string | undefined;
    try {
      const userRecord = await adminAuth.getUser(decoded.uid);
      role = (userRecord.customClaims?.role as string) || undefined;
    } catch {
      // If getUser fails, fall back to decoded claims
      role = (decoded.role as string) || undefined;
    }

    return NextResponse.json(
      { authenticated: true, uid: decoded.uid, role: role || null },
      { status: 200 },
    );
  } catch {
    // Token expired, revoked, or malformed → treat as unauthenticated
    return NextResponse.json({ authenticated: false }, { status: 200 });
  }
}
