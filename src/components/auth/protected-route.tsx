"use client";

import * as React from "react";
import { useAuth } from "@/providers/auth-provider";
import { useTenant } from "@/providers/tenant-provider";
import { useRouter, usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading: isAuthLoading } = useAuth();
  const { isLoading: isTenantLoading } = useTenant();
  const router = useRouter();
  const pathname = usePathname();

  // Combined loading state - wait for both auth AND tenant to be ready
  const isLoading = isAuthLoading || isTenantLoading;

  React.useEffect(() => {
    if (!isAuthLoading && !user) {
      if (pathname !== "/login") {
        router.push("/login");
      }
    } else if (user) {
      // Role Based Protection
      const isAdminRoute = pathname.startsWith("/admin");
      // Check localStorage directly for consistency with TenantProvider
      const isViewingAsTenant =
        typeof window !== "undefined"
          ? localStorage.getItem("viewingAsTenant")
          : null;

      if (user.role === "superadmin" && !isAdminRoute && !isViewingAsTenant) {
        // Super admin not viewing a tenant - redirect to admin
        router.push("/admin");
      } else if (user.role !== "superadmin" && isAdminRoute) {
        router.push("/dashboard");
      }
    }
  }, [user, isAuthLoading, router, pathname]);

  // Loading Screen - wait for BOTH auth and tenant to load
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

  // If on login page, render without protection
  if (pathname === "/login") {
    return <>{children}</>;
  }

  // If no user after loading, show nothing (redirect is happening)
  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-neutral-950">
        <Loader2 className="h-10 w-10 animate-spin text-violet-500" />
      </div>
    );
  }

  // Authenticated AND tenant loaded
  return <>{children}</>;
}
