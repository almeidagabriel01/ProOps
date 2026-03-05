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
import { shouldBlockUnverifiedEmail } from "@/lib/auth/email-verification";

// Routes that handle their own auth logic
const SELF_HANDLED_ROUTES = [
  "/login",
  "/register",
  "/forgot-password",
  "/email-verification-pending",
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
  "/email-verification-pending",
  "/subscribe",
  "/pricing",
  "/auth",
];

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading: isAuthLoading, forceSyncSession } = useAuth();
  const {
    permissions,
    isLoading: isPermLoading,
    hasPermission,
  } = usePermissions();
  const {
    isLoading: isTenantLoading,
    isGlobalLoading,
  } = useTenant();
  const router = useRouter();
  const pathname = usePathname();
  const isRecoveringRef = React.useRef(false);

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
          if (shouldBlockUnverifiedEmail(firebaseUser)) {
            // User is authenticated but hasn't verified email.
            // Redirect directly to the pending page instead of recovering.
            const url = new URL(
              "/email-verification-pending",
              window.location.href,
            );
            url.searchParams.set("redirect", pathname);
            router.push(url.toString().replace(window.location.origin, ""));
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
          router.push("/login");
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
  ]);

  if (isSelfHandled) {
    return <>{children}</>;
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
