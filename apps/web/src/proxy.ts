/**
 * Next.js Proxy (Next 16+)
 *
 * Server-side route protection. Renamed from `middleware.ts` because the
 * `middleware` file convention was deprecated in Next 16 in favour of
 * `proxy`. The exported function MUST be named `proxy`; per-request
 * behaviour is otherwise identical to the previous middleware API.
 *
 * Checks authentication via Firebase Auth cookies/tokens.
 *
 * IMPORTANT: This proxy provides the first line of defense.
 * Client-side ProtectedRoute and Cloud Functions provide additional layers.
 *
 * STRATEGY:
 * - Firebase Auth doesn't set cookies automatically in Next.js
 * - We check for the __session cookie (set by client after login)
 * - For full server-side auth, you'd need to verify the token here
 * - This proxy does a lightweight check; Cloud Functions are the authority
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { shouldAcceptLegacyAuthCookie } from "@/lib/legacy-auth-cookie";
import { decideExpiredRedirect } from "@/lib/auth/decide-expired-redirect";

// ============================================
// ROUTE CONFIGURATION
// ============================================

// Routes that bypass the billing gate (accessible even when subscription is blocked)
const BILLING_ALLOWED_ROUTES = ["/subscription-blocked"];

// Public routes that don't require authentication
const PUBLIC_ROUTES = [
  "/",
  "/automacao-residencial",
  "/decoracao",
  "/login",
  "/register",
  "/forgot-password",
  "/privacy",
  "/terms",
  "/data-deletion",
  "/cookies",
  "/subscribe",
  "/checkout-success",
  "/pricing",
  "/contato",
  "/auth/refresh", // Silent session re-mint interstitial — must run without a cookie
  "/api/webhooks", // Webhooks need to be public
  "/share", // Public shared proposal pages
  "/auth/action", // Legacy Firebase Auth action handler (kept for in-flight emails)
  "/reset", // Custom password reset flow (oobCode via clean URL)
  "/verify", // Custom email verification flow (oobCode via clean URL)
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

function isBillingAllowed(pathname: string): boolean {
  return BILLING_ALLOWED_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + "/"),
  );
}

interface BillingStatusResponse {
  allowed: boolean;
  status: string;
  reason?: string;
}

// ============================================
// MIDDLEWARE
// ============================================

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Legacy route redirect: /automation -> /solutions
  if (pathname === "/automation" || pathname.startsWith("/automation/")) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = pathname.replace("/automation", "/solutions");
    const resp = NextResponse.redirect(redirectUrl);
    resp.headers.set("Content-Type", "text/plain");
    return resp;
  }

  // Skip static assets and API routes
  if (shouldSkip(pathname)) {
    return NextResponse.next();
  }

  // Billing-allowed routes (e.g., /subscription-blocked) are accessible to everyone, including
  // unauthenticated users. The layout.tsx server component handles role/subscription redirects
  // for authenticated visitors.
  if (isBillingAllowed(pathname)) {
    const resp = NextResponse.next();
    resp.headers.set("Cache-Control", "no-store, must-revalidate");
    return resp;
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
  const acceptLegacyCookieHint = shouldAcceptLegacyAuthCookie({
    host: request.headers.get("host"),
  });

  // If no session, route through the silent re-mint interstitial instead of
  // bouncing straight to /login. If the Firebase refresh token is still valid,
  // /auth/refresh re-creates the __session cookie and forwards to `next` — the
  // returning user never sees the login form. /auth/refresh is itself terminal
  // (it redirects to /login when it can't recover) and is PUBLIC, so this can't
  // loop.
  if (!sessionCookie && !(acceptLegacyCookieHint && legacyAuthHint)) {
    const refreshUrl = new URL("/auth/refresh", request.url);
    refreshUrl.searchParams.set("next", pathname);
    const resp = NextResponse.redirect(refreshUrl);
    resp.headers.set("Content-Type", "text/plain");
    return resp;
  }

  // Billing gate: verify subscription status via Node.js route (supports firebase-admin).
  // Skipped for BILLING_ALLOWED_ROUTES so blocked users can still reach /subscription-blocked.
  // No client-side cache — the route call is ~50ms and other layers (backend, Firestore Rules)
  // are the primary enforcement; this gate prevents SSR of protected pages before HTML is served.
  if (!isBillingAllowed(pathname)) {
    try {
      const billingUrl = new URL("/api/auth/billing-status", request.url);
      // Forward the requested path so billing-status can enforce the free
      // tier allowlist (free user trying to reach /dashboard etc. is denied
      // here before any ERP page is rendered).
      billingUrl.searchParams.set("path", pathname);
      const billingRes = await fetch(billingUrl.toString(), {
        headers: { cookie: request.headers.get("cookie") ?? "" },
        // Bound the SSR gate so a slow/unreachable billing route can't hang the
        // request. On abort the outer catch fails closed (→ /subscription-blocked),
        // preserving the existing no-bypass guarantee.
        signal: AbortSignal.timeout(5000),
      });
      if (billingRes.ok) {
        const billing = (await billingRes.json()) as BillingStatusResponse;
        if (!billing.allowed) {
          if (
            billing.reason === "session_revoked" ||
            billing.reason === "session_expired"
          ) {
            // Expired → try a silent re-mint (refresh token may still be valid).
            // Revoked → re-mint would fail, so go straight to /login. The login
            // page recovery reads `redirect_reason` (not `reason`), so emit that.
            const target = decideExpiredRedirect({ reason: billing.reason });
            const dest =
              target === "refresh"
                ? (() => {
                    const u = new URL("/auth/refresh", request.url);
                    u.searchParams.set("next", pathname);
                    u.searchParams.set("reason", "session_expired");
                    return u;
                  })()
                : (() => {
                    const u = new URL("/login", request.url);
                    u.searchParams.set("redirect_reason", billing.reason);
                    return u;
                  })();
            const resp = NextResponse.redirect(dest);
            resp.cookies.set({
              name: "__session",
              value: "",
              httpOnly: true,
              secure: request.nextUrl.protocol === "https:",
              sameSite: "lax",
              path: "/",
              maxAge: 0,
            });
            return resp;
          }
          // Free tier trying to reach an ERP route → bounce to the public
          // landing. Not /subscription-blocked because the account isn't
          // blocked, it just doesn't have access to the ERP.
          if (billing.reason === "free_tier_forbidden") {
            const homeUrl = new URL("/", request.url);
            const resp = NextResponse.redirect(homeUrl);
            resp.headers.set("Cache-Control", "no-store");
            return resp;
          }
          const blockedUrl = new URL("/subscription-blocked", request.url);
          if (billing.status) {
            blockedUrl.searchParams.set("reason", billing.status);
          }
          const resp = NextResponse.redirect(blockedUrl);
          resp.headers.set("Cache-Control", "no-store");
          return resp;
        }
      } else {
        // billing-status returned a non-2xx HTTP error — fail closed to prevent bypass.
        const blockedUrl = new URL("/subscription-blocked", request.url);
        blockedUrl.searchParams.set("reason", "blocked");
        const resp = NextResponse.redirect(blockedUrl);
        resp.headers.set("Cache-Control", "no-store");
        return resp;
      }
    } catch {
      // Billing check infrastructure error — fail closed to prevent bypass.
      const blockedUrl = new URL("/subscription-blocked", request.url);
      blockedUrl.searchParams.set("reason", "blocked");
      const resp = NextResponse.redirect(blockedUrl);
      resp.headers.set("Cache-Control", "no-store");
      return resp;
    }
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
     * - icons/ (favicon PNGs), apple-icon.png, opengraph-image.png (icon/OG assets)
     * - public folder assets (hero/, etc.)
     * - robots.txt, sitemap.xml, manifest.webmanifest (must be publicly accessible for crawlers)
     */
    "/((?!_next/static|_next/image|favicon.ico|icons/|apple-icon.png|opengraph-image.png|hero/|logo/|features/|robots.txt|sitemap.xml|manifest.webmanifest).*)",
  ],
};
