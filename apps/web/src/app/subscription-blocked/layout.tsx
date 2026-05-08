import type { Metadata } from "next";
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAdminAuth } from "@/lib/firebase-admin";

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
      const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
      const subscriptionStatus = String(decoded.subscriptionStatus || "");

      if (ACTIVE_STATUSES.has(subscriptionStatus)) {
        redirect("/");
      }
      // Blocked status or empty claim → render the blocked page
    } catch {
      // auth/session-cookie-revoked: Fase 1 revoked tokens on cancel — the user IS blocked.
      // Render the page so they see what happened instead of landing on a bare /login.
    }
  }
  // No session cookie → render the page with generic blocked content

  return <>{children}</>;
}
