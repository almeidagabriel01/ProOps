/**
 * Next.js Middleware
 *
 * Server-side route protection.
 * Checks authentication via Firebase Auth cookies/tokens.
 *
 * IMPORTANT: This middleware provides the first line of defense.
 * Client-side ProtectedRoute and Cloud Functions provide additional layers.
 *
 * STRATEGY:
 * - Firebase Auth doesn't set cookies automatically in Next.js
 * - We check for the __session cookie (set by client after login)
 * - For full server-side auth, you'd need to verify the token here
 * - This middleware does a lightweight check; Cloud Functions are the authority
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// ============================================
// ROUTE CONFIGURATION
// ============================================

// Public routes that don't require authentication
const PUBLIC_ROUTES = [
  "/",
  "/login",
  "/register",
  "/forgot-password",
  "/subscribe",
  "/checkout-success",
  "/pricing",
  "/api/webhooks", // Webhooks need to be public
  "/share", // Public shared proposal pages
  "/auth/action", // Password reset and other auth actions
];

// Static assets and API routes to skip
const SKIP_PATTERNS = [
  "/_next",
  "/favicon.ico",
  "/public",
  "/hero",
  "/logo",
  "/api/", // Let API routes handle their own auth
];

// ============================================
// HELPER FUNCTIONS
// ============================================

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + "/"),
  );
}

function shouldSkip(pathname: string): boolean {
  return SKIP_PATTERNS.some((pattern) => pathname.startsWith(pattern));
}

// ============================================
// MIDDLEWARE
// ============================================

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Legacy route redirect: /automation -> /solutions
  if (pathname === "/automation" || pathname.startsWith("/automation/")) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = pathname.replace("/automation", "/solutions");
    return NextResponse.redirect(redirectUrl);
  }

  // Legacy route redirect: /settings/team -> /team
  if (pathname === "/settings/team" || pathname.startsWith("/settings/team/")) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = pathname.replace("/settings/team", "/team");
    return NextResponse.redirect(redirectUrl);
  }

  // Skip static assets and API routes
  if (shouldSkip(pathname)) {
    return NextResponse.next();
  }

  // Allow public routes
  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  // Check for auth session
  // Firebase Auth doesn't automatically set cookies in Next.js
  // The client needs to set a session cookie after login
  const sessionCookie = request.cookies.get("__session")?.value;
  const legacyAuthHint = request.cookies.get("firebase-auth-token")?.value;
  const defaultLegacyFallback =
    String(process.env.NODE_ENV || "")
      .trim()
      .toLowerCase() === "production"
      ? "false"
      : "true";
  const acceptLegacyCookieHint =
    String(process.env.AUTH_ACCEPT_LEGACY_COOKIE_HINT || defaultLegacyFallback)
      .trim()
      .toLowerCase() !== "false";

  // If no session, redirect to login
  if (!sessionCookie && !(acceptLegacyCookieHint && legacyAuthHint)) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    loginUrl.searchParams.set("redirect_reason", "session_expired");
    return NextResponse.redirect(loginUrl);
  }

  // This middleware only checks session presence.
  // Authorization is enforced server-side using verified/revocation-checked tokens.
  // Legacy JS-readable cookie remains login hint only during phase A rollout.

  return NextResponse.next();
}

// ============================================
// MATCHER CONFIGURATION
// ============================================

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder assets (hero/, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|hero/|logo/).*)",
  ],
};
