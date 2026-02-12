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
  "/api/", // Let API routes handle their own auth
];

// MASTER-only routes
const MASTER_ONLY_ROUTES = ["/settings/team", "/settings/billing"];

// SUPER_ADMIN-only routes
const SUPER_ADMIN_ROUTES = ["/admin"];

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

function isMasterOnlyRoute(pathname: string): boolean {
  return MASTER_ONLY_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + "/"),
  );
}

function isSuperAdminRoute(pathname: string): boolean {
  return SUPER_ADMIN_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + "/"),
  );
}

// ============================================
// MIDDLEWARE
// ============================================

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

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
  const authToken = request.cookies.get("firebase-auth-token")?.value;

  // If no session, redirect to login
  if (!sessionCookie && !authToken) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Protection for Super Admin routes
  if (isSuperAdminRoute(pathname)) {
    const userRole = request.cookies.get("user-role")?.value;

    // Strict check: must be explicitly "superadmin"
    if (userRole !== "superadmin") {
      // Redirect to dashboard (or generic access denied)
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  // For MASTER-only routes, we need to check the role
  // Since we can't easily verify Firebase tokens in Edge runtime,
  // we rely on a role cookie set by the client
  if (isMasterOnlyRoute(pathname)) {
    const userRole = request.cookies.get("user-role")?.value;

    if (userRole === "MEMBER") {
      return NextResponse.redirect(new URL("/403", request.url));
    }

    // If role is not set, let the client-side handle it
    // This is a fallback - ProtectedRoute will do the full check
  }

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
    "/((?!_next/static|_next/image|favicon.ico|hero/).*)",
  ],
};
