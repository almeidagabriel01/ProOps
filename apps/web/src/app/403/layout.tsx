import type { Metadata } from "next";
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAdminAuth } from "@/lib/firebase-admin";
import { loadServerUserData, resolveServerHome } from "@/lib/auth/resolve-user-home-server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function Layout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("__session")?.value;

  // No session → send to login
  if (!sessionCookie) {
    redirect("/login");
  }

  let shouldRedirectTo: string | null = null;

  try {
    const adminAuth = getAdminAuth();
    // checkRevoked: false — accept potentially revoked cookies; other guards handle revocation
    const decoded = await adminAuth.verifySessionCookie(sessionCookie, false);

    const userData = await loadServerUserData(decoded.uid);
    if (userData !== null) {
      const home = resolveServerHome(userData);
      // resolveServerHome never returns /403 — always redirect authenticated users to their home
      if (home !== "/403") {
        shouldRedirectTo = home;
      }
    }
  } catch {
    // Verification error (e.g., malformed cookie) — render page rather than crash
  }

  if (shouldRedirectTo !== null) {
    redirect(shouldRedirectTo);
  }

  return <>{children}</>;
}
