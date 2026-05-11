import type { Metadata } from "next";
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAdminAuth, getAdminFirestore } from "@/lib/firebase-admin";
import { isSubscriptionBlocked } from "@/lib/auth/subscription-blocked-statuses";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function Layout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("__session")?.value;

  if (sessionCookie) {
    try {
      const adminAuth = getAdminAuth();
      // checkRevoked: false — revoked sessions ARE expected here (post-cancel flow).
      const decoded = await adminAuth.verifySessionCookie(sessionCookie, false);

      // Superadmin → admin panel (check claim directly — not billing-sensitive)
      if (decoded.isSuperAdmin === true || String(decoded.role || "").toLowerCase() === "superadmin") {
        redirect("/admin");
      }

      // Free role → landing (free users have no subscription to be blocked on)
      if (String(decoded.role || "").toLowerCase() === "free") {
        redirect("/");
      }

      const tenantId = String(decoded.tenantId || "").trim();

      if (tenantId) {
        // Read Firestore directly — JWT claims may be stale after a billing status change.
        const db = getAdminFirestore();
        const tenantSnap = await db.collection("tenants").doc(tenantId).get();
        const tenantData = tenantSnap.data() as Record<string, unknown> | undefined;

        const subscriptionStatus = String(tenantData?.subscriptionStatus || "").trim().toLowerCase();
        const pastDueSince =
          typeof tenantData?.pastDueSince === "string" && tenantData.pastDueSince
            ? (tenantData.pastDueSince as string)
            : null;

        if (!isSubscriptionBlocked(subscriptionStatus, pastDueSince)) {
          redirect("/");
        }
      } else {
        // No tenantId → not a paying user, redirect to landing
        redirect("/");
      }

      // Blocked status confirmed → render the blocked page
    } catch {
      // auth/session-cookie-revoked or any verification error:
      // Revoked sessions ARE expected here (post-cancel flow). Render the page.
    }
  }
  // No session cookie → render the page with generic blocked content

  return <>{children}</>;
}
