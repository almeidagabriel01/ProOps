import type { Metadata } from "next";
import type { ReactNode } from "react";
import { cookies, headers } from "next/headers";
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

  // No session → send to login (anon should never see 403)
  if (!sessionCookie) {
    redirect("/login");
  }

  // If the request originated from within the app (same-origin Referer), ProtectedRoute
  // legitimately pushed the user here after a permission check — render the page as-is.
  // Direct URL access (no Referer or external origin) → redirect to the user's home.
  const headerStore = await headers();
  const referer = headerStore.get("referer") ?? "";
  const host = headerStore.get("host") ?? "";

  let isFromAppNavigation = false;
  if (referer) {
    try {
      isFromAppNavigation = new URL(referer).host === host;
    } catch {
      // Malformed Referer — treat as direct access
    }
  }

  if (isFromAppNavigation) {
    return <>{children}</>;
  }

  // Direct URL access: resolve where this user should actually be and redirect there.
  let shouldRedirectTo: string | null = null;

  try {
    const adminAuth = getAdminAuth();
    const decoded = await adminAuth.verifySessionCookie(sessionCookie, false);

    const userData = await loadServerUserData(decoded.uid);
    if (userData !== null) {
      shouldRedirectTo = resolveServerHome(userData);
    }
  } catch {
    // Verification error — render page rather than crash or loop
  }

  if (shouldRedirectTo !== null) {
    redirect(shouldRedirectTo);
  }

  return <>{children}</>;
}
