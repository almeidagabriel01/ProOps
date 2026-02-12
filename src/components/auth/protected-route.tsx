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
import {
  getPageConfig,
  pageRequiresAuth,
  pageIsMasterOnly,
} from "@/lib/page-config";
import { AppSkeleton } from "@/components/layout/app-skeleton";
import { DashboardSkeleton } from "@/app/dashboard/_components/dashboard-skeleton";
import { TableSkeleton } from "@/components/ui/table-skeleton";
import { ProfileSkeleton } from "@/app/profile/_components/profile-skeleton";
import { FinancialSkeleton } from "@/app/financial/_components/financial-skeleton";
import { TeamSkeleton } from "@/app/settings/team/_components/team-skeleton";
import { AdminSkeleton } from "@/app/admin/_components/admin-skeleton";
import { AdminOverviewSkeleton } from "@/app/admin/overview/_components/admin-overview-skeleton";
import { ProductsSkeleton } from "@/app/products/_components/products-skeleton";
import { ProposalsSkeleton } from "@/app/proposals/_components/proposals-skeleton";
import { ContactsSkeleton } from "@/app/contacts/_components/contacts-skeleton";
import { AddonsSkeleton } from "@/app/profile/addons/_components/addons-skeleton";
import { AutomationSkeleton } from "@/components/features/automation/automation-skeleton";

// Routes that handle their own auth logic
const SELF_HANDLED_ROUTES = ["/login", "/subscribe", "/checkout-success", "/"];

// Routes that allow unauthenticated access
const PUBLIC_ROUTES = ["/", "/login", "/subscribe", "/pricing", "/auth"];

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading: isAuthLoading } = useAuth();
  const {
    permissions,
    isLoading: isPermLoading,
    hasPermission,
  } = usePermissions();
  const router = useRouter();
  const pathname = usePathname();

  // Check route type
  const isSelfHandled = SELF_HANDLED_ROUTES.some(
    (r) => pathname === r || pathname.startsWith(r + "/"),
  );
  const isPublic = PUBLIC_ROUTES.some(
    (r) => pathname === r || pathname.startsWith(r + "/"),
  );
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
    if (pageIsMasterOnly(pathname) && permissions.role !== "MASTER") {
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
  ]);

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
    // Try to determine best skeleton from pathname first, then cache
    let skeletonType = "dashboard";

    if (pathname?.startsWith("/profile/addons")) {
      skeletonType = "addons";
    } else if (pathname?.startsWith("/profile")) {
      skeletonType = "profile";
    } else if (pathname?.startsWith("/financial")) {
      skeletonType = "financial";
    } else if (pathname?.startsWith("/products")) {
      skeletonType = "products";
    } else if (pathname?.startsWith("/proposals")) {
      skeletonType = "proposals";
    } else if (pathname?.startsWith("/contacts")) {
      skeletonType = "clients";
    } else if (pathname?.startsWith("/settings/team")) {
      skeletonType = "team";
    } else if (pathname?.startsWith("/admin/overview")) {
      skeletonType = "adminOverview";
    } else if (pathname?.startsWith("/admin")) {
      skeletonType = "admin";
    } else if (pathname?.startsWith("/automation")) {
      skeletonType = "automation";
    } else if (pathname === "/" && typeof window !== "undefined") {
      // Only use cache guessing for root redirect
      try {
        const cached = localStorage.getItem("erp_user_cache");
        if (cached) {
          const data = JSON.parse(cached);
          const { permissions, isAdmin } = data;

          if (isAdmin || permissions?.dashboard?.canView) {
            skeletonType = "dashboard";
          } else {
            const pages = [
              "proposals",
              "clients",
              "products",
              "financial",
              "profile",
            ];
            const firstAllowed = pages.find(
              (page) =>
                permissions[page]?.canView === true || page === "profile",
            );
            switch (firstAllowed) {
              case "financial":
                skeletonType = "financial";
                break;
              case "profile":
                skeletonType = "profile";
                break;
              case "products":
                skeletonType = "products";
                break;
              case "clients":
                skeletonType = "clients";
                break;
              case "proposals":
                skeletonType = "proposals";
                break;
              default:
                skeletonType = "list";
                break;
            }
          }
        }
      } catch {}
    } else if (pathname?.startsWith("/dashboard")) {
      skeletonType = "dashboard";
    }

    const renderSkeleton = () => {
      switch (skeletonType) {
        case "dashboard":
          return <DashboardSkeleton />;
        case "profile":
          return <ProfileSkeleton />;
        case "addons":
          return <AddonsSkeleton />;
        case "financial":
          return <FinancialSkeleton />;
        case "team":
          return <TeamSkeleton />;
        case "admin":
          return <AdminSkeleton />;
        case "adminOverview":
          return <AdminOverviewSkeleton />;
        case "products":
          return <ProductsSkeleton />;
        case "proposals":
          return <ProposalsSkeleton />;
        case "clients":
          return <ContactsSkeleton />;
        case "automation":
          return <AutomationSkeleton />;
        case "list":
        default:
          return (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="h-8 w-48 bg-muted animate-pulse mb-2" />
                  <div className="h-4 w-64 bg-muted animate-pulse" />
                </div>
                <div className="h-10 w-32 bg-muted animate-pulse" />
              </div>
              <TableSkeleton rowCount={8} columnCount={5} />
            </div>
          );
      }
    };

    return <AppSkeleton>{renderSkeleton()}</AppSkeleton>;
  }

  // No user after loading (redirect happening)
  if (!user) {
    // Transient state before redirect happens
    let skeletonType = "dashboard";
    // ... (same cache reading logic could be extracted but duplicating for safety in this ephemeral block)
    if (typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem("erp_user_cache");
        if (cached) {
          const data = JSON.parse(cached);
          if (!data.isAdmin && !data.permissions?.dashboard?.canView) {
            skeletonType = "list"; // default to list if no dashboard
          }
        }
      } catch {}
    }

    return (
      <AppSkeleton>
        {skeletonType === "dashboard" ? (
          <DashboardSkeleton />
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="h-8 w-48 bg-muted animate-pulse mb-2" />
                <div className="h-4 w-64 bg-muted animate-pulse" />
              </div>
              <div className="h-10 w-32 bg-muted animate-pulse" />
            </div>
            <TableSkeleton rowCount={8} columnCount={5} />
          </div>
        )}
      </AppSkeleton>
    );
  }

  // Authenticated with permissions loaded
  return <>{children}</>;
}
