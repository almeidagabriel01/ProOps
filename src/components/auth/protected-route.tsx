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
import { useRouter, usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";
import { getPageConfig, pageRequiresAuth, pageIsMasterOnly } from "@/lib/page-config";

// Routes that handle their own auth logic
const SELF_HANDLED_ROUTES = ["/login", "/subscribe", "/checkout-success", "/"];

// Routes that allow unauthenticated access
const PUBLIC_ROUTES = ["/", "/login", "/subscribe", "/pricing"];

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading: isAuthLoading } = useAuth();
  const { permissions, isLoading: isPermLoading, hasPermission } = usePermissions();
  const router = useRouter();
  const pathname = usePathname();

  // Check route type
  const isSelfHandled = SELF_HANDLED_ROUTES.some(r => pathname === r || pathname.startsWith(r + "/"));
  const isPublic = PUBLIC_ROUTES.some(r => pathname === r || pathname.startsWith(r + "/"));
  const pageConfig = getPageConfig(pathname);

  // Combine loading states
  const isLoading = isAuthLoading || (user && isPermLoading);

  React.useEffect(() => {
    // Skip checks for self-handled routes
    if (isSelfHandled) return;

    // Skip checks while loading
    if (isAuthLoading) return;

    // Not authenticated
    if (!user) {
      if (!isPublic && pageRequiresAuth(pathname)) {
        router.push("/login");
      }
      return;
    }

    // Wait for permissions to load
    if (isPermLoading) return;
    if (!permissions) return;

    // MASTER-only page check
    if (pageIsMasterOnly(pathname) && permissions.role !== 'MASTER') {
      router.push("/403");
      return;
    }

    // Page permission check
    if (pageConfig?.requiredPermission) {
      const pageId = pageConfig.pageId;
      const requiredAction = pageConfig.requiredPermission;

      if (!hasPermission(pageId, requiredAction)) {
        router.push("/403");
        return;
      }
    }

  }, [user, isAuthLoading, permissions, isPermLoading, pathname, router, isSelfHandled, isPublic, pageConfig, hasPermission]);

  // Self-handled routes render immediately
  if (isSelfHandled) {
    return <>{children}</>;
  }

  // Public routes with no user
  if (isPublic && !user && !isAuthLoading) {
    return <>{children}</>;
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-neutral-950">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-violet-500" />
          <p className="text-neutral-400 text-sm animate-pulse">
            Carregando...
          </p>
        </div>
      </div>
    );
  }

  // No user after loading (redirect happening)
  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-neutral-950">
        <Loader2 className="h-10 w-10 animate-spin text-violet-500" />
      </div>
    );
  }

  // Authenticated with permissions loaded
  return <>{children}</>;
}
