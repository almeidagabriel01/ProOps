"use client";

import { usePathname } from "next/navigation";
import { ToastProvider } from "@/components/shared/toast-provider";
import { ErrorBoundary } from "@/components/shared/error-boundary";
import { TenantProvider } from "@/providers/tenant-provider";
import { AuthProvider } from "@/providers/auth-provider";
import { PermissionsProvider } from "@/providers/permissions-provider";
import { PlanProvider } from "@/providers/plan-provider";
import { ThemeProvider } from "@/providers/theme-provider";
import { ProtectedRoute } from "@/components/auth/protected-route";

export function Providers({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const isPublicMarketingPage =
    pathname === "/" ||
    pathname === "/automacao-residencial" ||
    pathname === "/decoracao";

  const isAuthOnlyPage =
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/forgot-password" ||
    pathname === "/privacy" ||
    pathname === "/terms" ||
    pathname.startsWith("/email-verification-pending") ||
    pathname.startsWith("/subscribe") ||
    pathname.startsWith("/checkout-success") ||
    pathname.startsWith("/auth") ||
    pathname === "/403" ||
    pathname.startsWith("/subscription-blocked") ||
    pathname.startsWith("/share/");

  return (
    <ThemeProvider>
      <ErrorBoundary>
        <AuthProvider>
          {isPublicMarketingPage ? (
            <main className="min-h-screen">{children}</main>
          ) : pathname.startsWith("/share/") ? (
            <main className="min-h-screen">{children}</main>
          ) : isAuthOnlyPage ? (
            <main className="min-h-screen flex flex-col">{children}</main>
          ) : (
            <PermissionsProvider>
              <TenantProvider>
                <PlanProvider>
                  <ProtectedRoute>{children}</ProtectedRoute>
                </PlanProvider>
              </TenantProvider>
            </PermissionsProvider>
          )}
        </AuthProvider>
      </ErrorBoundary>
      <ToastProvider />
    </ThemeProvider>
  );
}
