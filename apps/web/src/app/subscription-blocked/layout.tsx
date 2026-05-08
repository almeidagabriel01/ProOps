import type { Metadata } from "next";
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAdminAuth, getAdminFirestore } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

const ACTIVE_STATUSES = new Set(["active", "trialing"]);

export default async function Layout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("__session")?.value;

  if (sessionCookie) {
    try {
      const adminAuth = getAdminAuth();
      // checkRevoked: false — revoked sessions should see this page, not be dropped to login.
      const decoded = await adminAuth.verifySessionCookie(sessionCookie, false);
      const tenantId = String(decoded.tenantId || "").trim();

      if (tenantId) {
        // Read Firestore directly — JWT claims may be stale after a billing status change.
        // Using claims here can cause an infinite redirect loop when claims say "active"
        // but Firestore already says "canceled".
        const db = getAdminFirestore();
        const tenantSnap = await db.collection("tenants").doc(tenantId).get();
        const subscriptionStatus = String(
          (tenantSnap.data() as Record<string, unknown> | undefined)
            ?.subscriptionStatus || "",
        )
          .trim()
          .toLowerCase();

        if (ACTIVE_STATUSES.has(subscriptionStatus)) {
          redirect("/");
        }
      }
      // Blocked status or unknown tenant → render the blocked page
    } catch {
      // auth/session-cookie-revoked or any verification error:
      // Revoked sessions ARE expected here (post-cancel flow). Render the page.
    }
  }
  // No session cookie → render the page with generic blocked content

  return <>{children}</>;
}
