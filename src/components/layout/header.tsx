"use client";

import * as React from "react";
import { User as UserIcon, LogOut, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CommandPalette } from "@/components/ui/command-palette";
import { useAuth } from "@/providers/auth-provider";
import { useTenant } from "@/providers/tenant-provider";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

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

interface HeaderProps {
  sidebarWidth?: number;
}

export function Header({ sidebarWidth = 72 }: HeaderProps) {
  const { user, logout } = useAuth();
  const { tenant, refreshTenant, clearViewingTenant } = useTenant();
  const router = useRouter();
  const [isViewingAsTenant, setIsViewingAsTenant] = React.useState(false);
  const [userPlanName, setUserPlanName] = React.useState<string | null>(null);

  // Fetch user's plan name
  React.useEffect(() => {
    const fetchPlanName = async () => {
      if (!user?.planId) {
        setUserPlanName(user?.role === "free" ? "Gratuito" : null);
        return;
      }
      try {
        const planDoc = await getDoc(doc(db, "plans", user.planId));
        if (planDoc.exists()) {
          const planData = planDoc.data();
          setUserPlanName(planData.name || planData.tier);
        }
      } catch (error) {
        console.error("Error fetching plan:", error);
      }
    };
    fetchPlanName();
  }, [user?.planId, user?.role]);

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
    <header
      style={{
        left: sidebarWidth,
        transform: "translateZ(0)",
      }}
      className="fixed top-1 right-1 h-16 bg-background/80 backdrop-blur-md border-b border-border z-40 px-6 flex items-center justify-between transition-[left] duration-300 ease-out will-change-[left] rounded-tl-[2rem] rounded-tr-[2rem]"
    >
      <div className="flex items-center gap-4">
        {/* Super Admin Viewing Banner */}
        {isViewingAsTenant && user?.role === "superadmin" && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleBackToAdmin}
            className="border-amber-500/50 bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 hover:text-amber-700"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar ao Admin
          </Button>
        )}

        <CommandPalette />
      </div>

      <div className="flex items-center gap-4">
        <AnimatedThemeToggler className="text-muted-foreground hover:text-foreground transition-colors w-5 h-5" />
        <div className="h-8 w-px bg-border mx-2" />
        <div className="flex items-center gap-3 pl-2">
          <div className="flex flex-col items-end hidden md:flex">
            <span className="text-sm font-medium">
              {user ? user.name : "Visitante"}
            </span>
            <span className="text-xs text-muted-foreground capitalize">
              {userPlanName ||
                (user?.role === "superadmin"
                  ? "Super Admin"
                  : user?.role || "Guest")}
            </span>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="relative h-10 w-10 rounded-full p-0"
              >
                <div className="h-9 w-9 rounded-full bg-muted border border-border flex items-center justify-center overflow-hidden">
                  <div className="h-9 w-9 rounded-full bg-muted border border-border flex items-center justify-center overflow-hidden">
                    <UserIcon className="w-5 h-5 text-muted-foreground" />
                  </div>
                </div>
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
        </div>
      </div>
    </header>
  );
}
