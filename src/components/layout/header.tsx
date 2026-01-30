"use client";

import * as React from "react";
import { User as UserIcon, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CommandPalette } from "@/components/ui/command-palette";
import { useAuth } from "@/providers/auth-provider";
import { useTenant } from "@/providers/tenant-provider";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";

// Helper to generate consistent colors based on string
function getUserColor(name: string) {
  const colors = [
    "#ef4444", // red-500
    "#f97316", // orange-500
    "#f59e0b", // amber-500
    "#84cc16", // lime-500
    "#22c55e", // green-500
    "#10b981", // emerald-500
    "#14b8a6", // teal-500
    "#06b6d4", // cyan-500
    "#0ea5e9", // sky-500
    "#3b82f6", // blue-500
    "#6366f1", // indigo-500
    "#8b5cf6", // violet-500
    "#a855f7", // purple-500
    "#d946ef", // fuchsia-500
    "#ec4899", // pink-500
    "#f43f5e", // rose-500
  ];

  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }

  return colors[Math.abs(hash) % colors.length];
}

function getInitials(name: string) {
  const names = name.trim().split(" ");
  if (names.length === 0) return "U";
  if (names.length === 1) return names[0].charAt(0).toUpperCase();
  return (names[0].charAt(0) + names[names.length - 1].charAt(0)).toUpperCase();
}

import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler";
import { NotificationBell } from "@/components/notifications/notification-bell";

interface HeaderProps {
  sidebarWidth?: number;
}

export function Header({ sidebarWidth = 72 }: HeaderProps) {
  const { user, logout, isLoading: isAuthLoading } = useAuth();
  const {
    tenant,
    tenantOwner,
    clearViewingTenant,
    isLoading: isTenantLoading,
  } = useTenant();
  const router = useRouter();
  const [isViewingAsTenant, setIsViewingAsTenant] = React.useState(false);
  const [userPlanName, setUserPlanName] = React.useState<string | null>(null);

  /* 
     Show skeleton if:
     1. Auth is loading
     2. Tenant is loading
     3. User exists but plan name hasn't been determined yet (prevents "Starter" flash)
  */
  const isLoading =
    isAuthLoading || isTenantLoading || (!!user && userPlanName === null);

  // ... inside Header component ...

  // Fetch user's plan name
  React.useEffect(() => {
    setUserPlanName(null); // Reset when dependencies change

    const fetchPlanName = async () => {
      // Determine which user's plan to fetch
      const targetUser = isViewingAsTenant && tenant?.id ? tenantOwner : user;

      // If we are loading or strictly don't have a user yet, do nothing (or remain null)
      if (!targetUser) return;

      if (!targetUser?.planId) {
        if (targetUser?.role === "superadmin") {
          setUserPlanName("Super Admin");
        } else if (targetUser?.role === "free") {
          setUserPlanName("Gratuito");
        } else {
          setUserPlanName("Sem Plano");
        }
        return;
      }
      try {
        // 1. Try fetching by ID
        const planDoc = await getDoc(doc(db, "plans", targetUser.planId));
        if (planDoc.exists()) {
          const planData = planDoc.data();
          setUserPlanName(planData.name || planData.tier);
          return;
        }

        // 2. Fallback: Try fetching by tier (if planId is a tier name like 'starter')
        const q = query(
          collection(db, "plans"),
          where("tier", "==", targetUser.planId),
        );
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          const planData = querySnapshot.docs[0].data();
          setUserPlanName(planData.name || planData.tier);
          return;
        }

        // 3. Static fallback
        const PLAN_NAMES: Record<string, string> = {
          free: "Gratuito",
          starter: "Starter",
          pro: "Profissional",
          enterprise: "Enterprise",
        };
        if (PLAN_NAMES[targetUser.planId]) {
          setUserPlanName(PLAN_NAMES[targetUser.planId]);
        }
      } catch (error) {
        console.error("Error fetching plan:", error);
      }
    };
    fetchPlanName();
  }, [
    user,
    user?.planId,
    user?.role,
    isViewingAsTenant,
    tenantOwner,
    tenantOwner?.planId,
    tenant?.id,
  ]);

  React.useEffect(() => {
    // Check localStorage directly
    const viewingAsId =
      typeof window !== "undefined"
        ? localStorage.getItem("viewingAsTenant")
        : null;
    setIsViewingAsTenant(!!viewingAsId);
  }, [tenant]);

  const handleBackToAdmin = () => {
    clearViewingTenant();
    // Use localStorage directly if needed, or rely on clearViewingTenant
    if (typeof window !== "undefined") {
      localStorage.removeItem("viewingAsTenant");
    }
    router.push("/admin");
  };

  return (
    <header className="bg-background/80 backdrop-blur-md border-b border-border px-6 flex items-center justify-between rounded-tl-[2rem]" style={{ height: '64px', minHeight: '64px' }}>
      <div className="flex items-center gap-4">
        <CommandPalette />
      </div>

      {/* Super Admin Viewing Banner - Centered & Minimalist */}
      {isViewingAsTenant && user?.role === "superadmin" && (
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-3 px-4 py-1.5 bg-background/50 backdrop-blur-sm border border-border/60 rounded-full shadow-sm animate-in fade-in slide-in-from-top-1 duration-300">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-zinc-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-zinc-500"></span>
            </span>
            <span className="text-xs font-medium text-foreground/80 whitespace-nowrap">
              Modo Super Admin
            </span>
          </div>

          <div className="w-px h-3 bg-border mx-0.5" />

          <Button
            variant="ghost"
            size="sm"
            onClick={handleBackToAdmin}
            className="h-auto p-0 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-transparent transition-colors"
          >
            Voltar ao painel
            <LogOut className="w-3 h-3 ml-1.5" />
          </Button>
        </div>
      )}

      <div className="flex items-center gap-4">
        <AnimatedThemeToggler className="text-muted-foreground hover:text-foreground transition-colors w-5 h-5" />
        <NotificationBell />
        <div className="h-8 w-px bg-border mx-2" />
        <div className="flex items-center gap-3 pl-2">
          {isLoading ? (
            <div className="flex items-center gap-3">
              <div className="flex flex-col items-end hidden md:flex gap-1">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-16" />
              </div>
              <Skeleton className="h-10 w-10 rounded-full" />
            </div>
          ) : (
            <>
              <div className="flex flex-col items-end hidden md:flex">
                <span className="text-sm font-medium">
                  {isViewingAsTenant && tenantOwner
                    ? tenantOwner.name
                    : user
                      ? user.name
                      : "Visitante"}
                </span>
                <span className="text-xs text-muted-foreground capitalize">
                  {userPlanName ||
                    (user?.role === "superadmin" && !isViewingAsTenant
                      ? "Super Admin"
                      : isViewingAsTenant && tenantOwner
                        ? tenantOwner.role || "Membro"
                        : user?.role || "Guest")}
                </span>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="relative h-10 w-10 rounded-full p-0"
                  >
                    <Avatar
                      className="h-9 w-9 border border-border"
                      key={user?.id}
                    >
                      {user?.photoURL ? (
                        <AvatarImage
                          src={user.photoURL}
                          alt={user?.name || "User"}
                        />
                      ) : (
                        <AvatarFallback
                          className="text-white font-medium"
                          style={{
                            backgroundColor:
                              tenant?.primaryColor ||
                              getUserColor(
                                isViewingAsTenant && tenantOwner
                                  ? tenantOwner.name
                                  : user?.name || "User",
                              ),
                          }}
                        >
                          {getInitials(
                            isViewingAsTenant && tenantOwner
                              ? tenantOwner.name
                              : user?.name || "User",
                          )}
                        </AvatarFallback>
                      )}
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">
                        {user ? user.name : "Visitante"}
                      </p>
                      <p className="text-xs leading-none text-muted-foreground">
                        {user ? user.email : ""}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => router.push("/profile")}
                    className="cursor-pointer"
                  >
                    <UserIcon className="mr-2 h-4 w-4" />
                    <span>Meu Perfil</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={logout}
                    className="text-red-600 focus:text-red-600 cursor-pointer"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Sair</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
