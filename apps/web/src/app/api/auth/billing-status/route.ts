import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminFirestore } from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BLOCKED_STATUSES = new Set([
  "canceled",
  "cancelled",
  "unpaid",
  "inactive",
  "payment_failed",
]);

export async function GET(req: NextRequest) {
  const sessionCookie = req.cookies.get("__session")?.value;
  if (!sessionCookie) {
    return NextResponse.json({
      allowed: false,
      status: "unauthenticated",
      reason: "no_session",
    });
  }

  try {
    const adminAuth = getAdminAuth();
    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);

    let subscriptionStatus = String(decoded.subscriptionStatus || "");

    if (!subscriptionStatus && decoded.tenantId) {
      const db = getAdminFirestore();
      const tenantDoc = await db
        .collection("tenants")
        .doc(String(decoded.tenantId))
        .get();
      if (tenantDoc.exists) {
        subscriptionStatus = String(
          tenantDoc.data()?.subscription?.status || "",
        );
      }
    }

    const allowed = !BLOCKED_STATUSES.has(subscriptionStatus);
    return NextResponse.json({ allowed, status: subscriptionStatus });
  } catch (error: unknown) {
    const code = (error as { code?: string })?.code;

    if (code === "auth/session-cookie-revoked") {
      return NextResponse.json({
        allowed: false,
        status: "revoked",
        reason: "session_revoked",
      });
    }

    if (
      code === "auth/session-cookie-expired" ||
      code === "auth/argument-error"
    ) {
      return NextResponse.json({
        allowed: false,
        status: "expired",
        reason: "session_expired",
      });
    }

    // Fail open on infra errors — other layers (backend middleware, Firestore Rules) catch this
    console.error("[billing-status] unexpected error", error);
    return NextResponse.json({ allowed: true, status: "unknown" });
  }
}
