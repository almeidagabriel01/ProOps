"use client";

import * as React from "react";
import { useAuth } from "@/providers/auth-provider";
import { useTenant } from "@/providers/tenant-provider";
import { useRouter, usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";

// Routes that free users CAN access (besides home page which is public)
const FREE_USER_ALLOWED_ROUTES = ["/subscribe", "/checkout-success"];

// Routes that handle their own auth logic (don't need protection layer)
const SELF_HANDLED_AUTH_ROUTES = ["/login", "/subscribe", "/checkout-success"];

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading: isAuthLoading } = useAuth();
  const { isLoading: isTenantLoading } = useTenant();
  const router = useRouter();
  const pathname = usePathname();

  // Check if this route handles its own auth
  const isSelfHandledRoute = SELF_HANDLED_AUTH_ROUTES.some(route => pathname.startsWith(route)) || pathname === "/";

  // For self-handled routes, only wait for auth, not tenant
  const isLoading = isSelfHandledRoute ? isAuthLoading : (isAuthLoading || isTenantLoading);

  React.useEffect(() => {
    if (!isAuthLoading && !user) {
      // Don't redirect if on routes that handle their own auth
      if (!isSelfHandledRoute) {
        router.push("/login");
      }
    } else if (user) {
      // Role Based Protection
      const isAdminRoute = pathname.startsWith("/admin");
      const isHomeRoute = pathname === "/";
      const isFreeAllowedRoute = FREE_USER_ALLOWED_ROUTES.some(route => pathname.startsWith(route));

      // Check localStorage directly for consistency with TenantProvider
      const isViewingAsTenant =
        typeof window !== "undefined"
          ? localStorage.getItem("viewingAsTenant")
          : null;

      // Free user protection - can only access home and subscribe pages
      if (user.role === "free") {
        if (!isHomeRoute && !isFreeAllowedRoute && pathname !== "/login") {
          router.push("/");
        }
      } else if (user.role === "superadmin" && !isAdminRoute && !isViewingAsTenant) {
        // Super admin not viewing a tenant - redirect to admin
        router.push("/admin");
      } else if (user.role !== "superadmin" && isAdminRoute) {
        router.push("/dashboard");
      }
    }
  }, [user, isAuthLoading, router, pathname, isSelfHandledRoute]);

  // For self-handled auth routes, render immediately (they handle their own loading/auth)
  if (isSelfHandledRoute) {
    return <>{children}</>;
  }

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

