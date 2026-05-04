"use client";

/**
 * Enhanced Protected Route
 *
 * Client-side route protection with permission checks.
 * Works alongside middleware for double-layer security.
 *
 * IMPORTANT: This is a fallback. The middleware.ts provides
 * server-side protection. This handles client navigation.
 */

import * as React from "react";
import { useAuth } from "@/providers/auth-provider";
import { usePermissions } from "@/providers/permissions-provider";
import { useTenant } from "@/providers/tenant-provider";
import { useRouter, usePathname } from "next/navigation";
import { auth } from "@/lib/firebase";
import {
  getPageConfig,
  pageRequiresAuth,
  pageIsMasterOnly,
} from "@/lib/page-config";
import { ProtectedAppShell } from "@/components/layout/protected-app-shell";
import { RouteContentSkeleton } from "@/components/layout/route-content-skeleton";
import { EmailVerificationPending } from "@/components/auth/email-verification-pending";

// Routes that handle their own auth logic
const SELF_HANDLED_ROUTES = [
  "/login",
  "/register",
  "/forgot-password",
  "/privacy",
  "/terms",
  "/subscribe",
  "/checkout-success",
  "/",
];

// Routes that allow unauthenticated access
const PUBLIC_ROUTES = [
  "/",
  "/login",
  "/register",
  "/forgot-password",
  "/privacy",
  "/terms",
  "/subscribe",
  "/pricing",
  "/auth",
];

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading: isAuthLoading, forceSyncSession, getIsLoggingOut } = useAuth();
  const {
    permissions,
    isLoading: isPermLoading,
    hasPermission,
  } = usePermissions();
  const { isLoading: isTenantLoading, isGlobalLoading } = useTenant();
  const router = useRouter();
  const pathname = usePathname();
  const isRecoveringRef = React.useRef(false);
  const [showVerificationPending, setShowVerificationPending] =
    React.useState(false);

  const isSelfHandled = SELF_HANDLED_ROUTES.some(
    (r) => pathname === r || pathname.startsWith(r + "/"),
  );
  const isPublic = PUBLIC_ROUTES.some(
    (r) => pathname === r || pathname.startsWith(r + "/"),
  );
  const pageConfig = getPageConfig(pathname);

  const isLoading =
    isAuthLoading ||
    (!!user && (isPermLoading || isTenantLoading || isGlobalLoading));

  React.useEffect(() => {
    if (isSelfHandled) return;
    if (isAuthLoading) return;

    if (!user) {
      if (!isPublic && pageRequiresAuth(pathname)) {
        // Check if Firebase client-side auth is still alive.
        // If so, the session cookie expired but the user is still
        // authenticated — attempt session recovery instead of redirecting.
        const firebaseUser = auth.currentUser;
        if (firebaseUser && !isRecoveringRef.current) {
          const skipEmailVerification =
            process.env.NEXT_PUBLIC_SKIP_EMAIL_VERIFICATION === "true";

          if (!firebaseUser.emailVerified && !skipEmailVerification) {
            // User is authenticated but hasn't verified email.
            // Show inline verification component instead of redirecting.
            setShowVerificationPending(true);
            return;
          }

          isRecoveringRef.current = true;
          forceSyncSession()
            .then((synced) => {
              if (synced) {
                // Session cookie is now valid — reload to let the
                // middleware pass the request through normally.
                window.location.reload();
              } else {
                // Recovery failed — user's auth state is truly broken.
                router.push("/login");
              }
            })
            .catch(() => {
              router.push("/login");
            })
            .finally(() => {
              isRecoveringRef.current = false;
            });
        } else if (!firebaseUser) {
          if (!getIsLoggingOut()) {
            router.push(
              `/login?redirect=${encodeURIComponent(pathname)}&redirect_reason=session_expired`,
            );
          }
        }
      }
      return;
    }

    if (isPermLoading) return;
    if (!permissions) return;

    if (pageIsMasterOnly(pathname) && permissions.role !== "MASTER") {
      router.push("/403");
      return;
    }

    if (pageConfig?.requiredPermission) {
      const pageId = pageConfig.pageId;
      const requiredAction = pageConfig.requiredPermission;

      if (!hasPermission(pageId, requiredAction)) {
        router.push("/403");
      }
    }
  }, [
    user,
    isAuthLoading,
    permissions,
    isPermLoading,
    pathname,
    router,
    isSelfHandled,
    isPublic,
    pageConfig,
    hasPermission,
    forceSyncSession,
    getIsLoggingOut,
  ]);

  if (isSelfHandled) {
    return <>{children}</>;
  }

  if (showVerificationPending) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4 relative transition-colors duration-300">
        <EmailVerificationPending
          onVerified={() => {
            window.location.reload();
          }}
          onCancel={() => {
            router.push("/login");
          }}
        />
      </div>
    );
  }

  if (isPublic && !user && !isAuthLoading) {
    return <>{children}</>;
  }

  if (isLoading) {
    return (
      <ProtectedAppShell>
        <RouteContentSkeleton pathname={pathname} />
      </ProtectedAppShell>
    );
  }

  if (!user) {
    return null;
  }

  return <ProtectedAppShell>{children}</ProtectedAppShell>;
}
