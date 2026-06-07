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
import { isAuthOnlyRoute } from "@/lib/auth/auth-only-routes";

export function Providers({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const isPublicMarketingPage =
    pathname === "/" ||
    pathname === "/automacao-residencial" ||
    pathname === "/decoracao" ||
    pathname === "/contato";

  const isAuthOnlyPage = isAuthOnlyRoute(pathname);

  return (
    <ThemeProvider>
      <ErrorBoundary>
        <AuthProvider>
          {isPublicMarketingPage ? (
            <PermissionsProvider>
              <TenantProvider>
                <PlanProvider>
                  <main className="min-h-screen">{children}</main>
                </PlanProvider>
              </TenantProvider>
            </PermissionsProvider>
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
