"use client";

import * as React from "react";
import { FullPageLoading } from "@/components/ui/full-page-loading";
import { useSessionRefresh } from "./_hooks/useSessionRefresh";

/**
 * Silent session-recovery interstitial.
 *
 * The proxy redirects here (instead of straight to /login) when a protected
 * request arrives with a missing/expired `__session` cookie. If the Firebase
 * refresh token is still valid, this page re-mints the cookie and forwards to
 * the original path — the user never sees the login form. If recovery fails it
 * bounces to /login. It is bounded by attempt count and a hard watchdog, so it
 * can never become an infinite spinner.
 *
 * Classified as an auth-only route (see lib/auth/auth-only-routes.ts) so it is
 * not wrapped by <ProtectedRoute>, and added to PUBLIC_ROUTES in proxy.ts so the
 * proxy lets it through without a cookie.
 */
function SessionRefreshController() {
  useSessionRefresh();
  return <FullPageLoading description="Verificando sua sessão..." />;
}

export default function AuthRefreshPage() {
  // useSearchParams (inside the controller) requires a Suspense boundary.
  return (
    <React.Suspense fallback={<FullPageLoading />}>
      <SessionRefreshController />
    </React.Suspense>
  );
}
