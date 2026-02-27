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
import { DashboardSkeleton } from "@/app/dashboard/_components/dashboard-skeleton";
import { ProfileSkeleton } from "@/app/profile/_components/profile-skeleton";
import { FinancialSkeleton } from "@/app/financial/_components/financial-skeleton";
import { TeamSkeleton } from "@/app/team/_components/team-skeleton";
import { AdminSkeleton } from "@/app/admin/_components/admin-skeleton";
import { AdminOverviewSkeleton } from "@/app/admin/overview/_components/admin-overview-skeleton";
import { ProductsSkeleton } from "@/app/products/_components/products-skeleton";
import { ServicesSkeleton } from "@/app/services/_components/services-skeleton";
import { ProposalsSkeleton } from "@/app/proposals/_components/proposals-skeleton";
import { ContactsSkeleton } from "@/app/contacts/_components/contacts-skeleton";
import { AddonsSkeleton } from "@/app/profile/addons/_components/addons-skeleton";
import { AutomationSkeleton } from "@/components/features/automation/automation-skeleton";
import { WalletsSkeleton } from "@/app/wallets/_components/wallets-skeleton";
import { SpreadsheetsSkeleton } from "@/app/spreadsheets/_components/spreadsheets-skeleton";
import { SpreadsheetEditorSkeleton } from "@/app/spreadsheets/[id]/_components/spreadsheet-editor-skeleton";
import { AppSkeleton } from "@/components/layout/app-skeleton";

// Routes that handle their own auth logic
const SELF_HANDLED_ROUTES = [
  "/login",
  "/register",
  "/forgot-password",
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
  "/subscribe",
  "/pricing",
  "/auth",
];

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading: isAuthLoading } = useAuth();
  const {
    permissions,
    isLoading: isPermLoading,
    hasPermission,
  } = usePermissions();
  const router = useRouter();
  const pathname = usePathname();

  const isSelfHandled = SELF_HANDLED_ROUTES.some(
    (r) => pathname === r || pathname.startsWith(r + "/"),
  );
  const isPublic = PUBLIC_ROUTES.some(
    (r) => pathname === r || pathname.startsWith(r + "/"),
  );
  const pageConfig = getPageConfig(pathname);

  const isLoading = isAuthLoading || (user && isPermLoading);

  React.useEffect(() => {
    if (isSelfHandled) return;
    if (isAuthLoading) return;

    if (!user) {
      if (!isPublic && pageRequiresAuth(pathname)) {
        router.push("/login");
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
  ]);

  if (isSelfHandled) {
    return <>{children}</>;
  }

  if (isPublic && !user && !isAuthLoading) {
    return <>{children}</>;
  }

  if (isLoading) {
    const renderWithShell = (content: React.ReactNode) => (
      <AppSkeleton>{content}</AppSkeleton>
    );

    if (pathname?.startsWith("/spreadsheets/")) {
      return renderWithShell(<SpreadsheetEditorSkeleton />);
    }

    if (pathname === "/spreadsheets") {
      return renderWithShell(<SpreadsheetsSkeleton />);
    }

    let skeletonType = "dashboard";

    if (pathname?.startsWith("/profile/addons")) {
      skeletonType = "addons";
    } else if (pathname?.startsWith("/profile")) {
      skeletonType = "profile";
    } else if (pathname === "/wallets") {
      skeletonType = "wallets";
    } else if (pathname?.startsWith("/financial")) {
      skeletonType = "financial";
    } else if (pathname?.startsWith("/products")) {
      skeletonType = "products";
    } else if (pathname?.startsWith("/services")) {
      skeletonType = "services";
    } else if (pathname?.startsWith("/proposals")) {
      skeletonType = "proposals";
    } else if (pathname?.startsWith("/contacts")) {
      skeletonType = "clients";
    } else if (pathname?.startsWith("/team")) {
      skeletonType = "team";
    } else if (pathname?.startsWith("/admin/overview")) {
      skeletonType = "adminOverview";
    } else if (pathname?.startsWith("/admin")) {
      skeletonType = "admin";
    } else if (
      pathname?.startsWith("/solutions") ||
      pathname?.startsWith("/automation")
    ) {
      skeletonType = "automation";
    } else if (pathname === "/" || pathname?.startsWith("/dashboard")) {
      skeletonType = "dashboard";
    }

    switch (skeletonType) {
      case "dashboard":
        return renderWithShell(<DashboardSkeleton />);
      case "profile":
        return renderWithShell(<ProfileSkeleton />);
      case "addons":
        return renderWithShell(<AddonsSkeleton />);
      case "financial":
        return renderWithShell(<FinancialSkeleton />);
      case "wallets":
        return renderWithShell(<WalletsSkeleton />);
      case "team":
        return renderWithShell(<TeamSkeleton />);
      case "admin":
        return renderWithShell(<AdminSkeleton />);
      case "adminOverview":
        return renderWithShell(<AdminOverviewSkeleton />);
      case "products":
        return renderWithShell(<ProductsSkeleton />);
      case "services":
        return renderWithShell(<ServicesSkeleton />);
      case "proposals":
        return renderWithShell(<ProposalsSkeleton />);
      case "clients":
        return renderWithShell(<ContactsSkeleton />);
      case "automation":
        return renderWithShell(<AutomationSkeleton />);
      default:
        return renderWithShell(<DashboardSkeleton />);
    }
  }

  if (!user) {
    if (pathname?.startsWith("/spreadsheets/")) {
      return <SpreadsheetEditorSkeleton />;
    }

    if (pathname === "/spreadsheets") {
      return <SpreadsheetsSkeleton />;
    }

    return null;
  }

  return <>{children}</>;
}
