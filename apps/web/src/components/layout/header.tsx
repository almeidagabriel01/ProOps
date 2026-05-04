"use client";

import * as React from "react";
import { LogOut, User as UserIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { CommandPalette } from "@/components/ui/command-palette";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/providers/auth-provider";
import { usePermissions } from "@/providers/permissions-provider";
import { useTenant } from "@/providers/tenant-provider";
import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { useHeaderPresentation } from "@/hooks/useHeaderPresentation";

interface HeaderProps {
  sidebarWidth?: number;
}

function getUserColor(name: string) {
  const colors = [
    "#ef4444",
    "#f97316",
    "#f59e0b",
    "#84cc16",
    "#22c55e",
    "#10b981",
    "#14b8a6",
    "#06b6d4",
    "#0ea5e9",
    "#3b82f6",
    "#6366f1",
    "#8b5cf6",
    "#a855f7",
    "#d946ef",
    "#ec4899",
    "#f43f5e",
  ];

  let hash = 0;
  for (let index = 0; index < name.length; index += 1) {
    hash = name.charCodeAt(index) + ((hash << 5) - hash);
  }

  return colors[Math.abs(hash) % colors.length];
}

function getInitials(name: string) {
  const names = name.trim().split(" ").filter(Boolean);
  if (names.length === 0) return "U";
  if (names.length === 1) return names[0].charAt(0).toUpperCase();
  return `${names[0].charAt(0)}${names[names.length - 1].charAt(0)}`.toUpperCase();
}

function HeaderSkeleton() {
  return (
    <header
      className="relative z-50 bg-background/80 backdrop-blur-md border-b border-border px-6 flex items-center justify-between rounded-t-[2rem] transition-all duration-300"
      style={{ height: "64px", minHeight: "64px" }}
    >
      <div className="flex items-center gap-4">
        <Skeleton className="h-9 w-56 rounded-xl" />
      </div>
      <div className="flex items-center gap-4">
        <Skeleton className="h-8 w-8 rounded-full" />
        <div className="h-8 w-px bg-border" />
        <div className="flex items-center gap-3">
          <div className="hidden md:flex flex-col items-end gap-1">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-20" />
          </div>
          <Skeleton className="h-9 w-9 rounded-full" />
        </div>
      </div>
    </header>
  );
}

export function Header({}: HeaderProps) {
  const { user, logout, isLoading: isAuthLoading } = useAuth();
  const { isLoading: isPermLoading } = usePermissions();
  const {
    tenant,
    clearViewingTenant,
    isLoading: isTenantLoading,
    isGlobalLoading,
  } = useTenant();
  const {
    companyName,
    planLabel,
    logoUrl,
    avatarSeed,
    isViewingAsTenant,
    isPlanLabelLoading,
  } =
    useHeaderPresentation();
  const router = useRouter();

  const isHeaderBlocked =
    isAuthLoading || isPermLoading || isTenantLoading || isGlobalLoading;

  const handleBackToAdmin = () => {
    clearViewingTenant();
    React.startTransition(() => {
      router.push("/admin");
    });
  };

  if (isHeaderBlocked) {
    return <HeaderSkeleton />;
  }

  return (
    <header
      className="relative z-50 bg-background/80 backdrop-blur-md border-b border-border px-6 flex items-center justify-between rounded-t-[2rem] transition-all duration-300 animate-in fade-in"
      style={{ height: "64px", minHeight: "64px" }}
    >
      <div className="flex items-center gap-4">
        <CommandPalette />
      </div>

      {isViewingAsTenant && user?.role === "superadmin" && (
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-3 px-4 py-1.5 bg-background/50 backdrop-blur-sm border border-border/60 rounded-full shadow-sm animate-in fade-in slide-in-from-top-1 duration-300">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-zinc-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-zinc-500" />
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
        <div className="h-8 w-px bg-border" />
        <div className="flex items-center gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="relative h-fit py-2 pr-2 pl-6 rounded-full flex items-center justify-end gap-3 hover:bg-muted/50 transition-colors"
              >
                <div className="hidden md:flex flex-col items-end">
                  <span className="text-sm font-medium">{companyName}</span>
                  {isPlanLabelLoading ? (
                    <Skeleton className="mt-1 h-3 w-20 rounded-full" />
                  ) : (
                    <span className="text-xs text-muted-foreground capitalize">
                      {planLabel}
                    </span>
                  )}
                </div>
                <Avatar className="h-9 w-9 border border-border" key={tenant?.id || user?.id}>
                  {logoUrl ? (
                    <AvatarImage
                      src={logoUrl}
                      alt={companyName || "Company Logo"}
                      className="object-cover"
                    />
                  ) : (
                    <AvatarFallback
                      className="text-xs font-medium text-white"
                      style={{ backgroundColor: getUserColor(avatarSeed) }}
                    >
                      {getInitials(avatarSeed)}
                    </AvatarFallback>
                  )}
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56 z-50" align="end" forceMount>
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
