/**
 * Auth-only / public route classification.
 *
 * Single source of truth for which paths must NOT be wrapped by
 * <ProtectedRoute>. These are pages reachable without a verified, fully
 * provisioned session: auth flows, legal pages, billing entry points, and the
 * e-mail verification handler (`/verify`).
 *
 * Kept as a pure function (no React, no Next hooks) so it can be unit-tested
 * and reused. Consumed by `app/providers.tsx`.
 */
export function isAuthOnlyRoute(pathname: string): boolean {
  return (
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/forgot-password" ||
    pathname === "/privacy" ||
    pathname === "/terms" ||
    pathname === "/data-deletion" ||
    pathname === "/cookies" ||
    pathname.startsWith("/email-verification-pending") ||
    pathname.startsWith("/subscribe") ||
    pathname.startsWith("/checkout-success") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/verify") ||
    pathname === "/403" ||
    pathname.startsWith("/subscription-blocked") ||
    pathname.startsWith("/share/")
  );
}
