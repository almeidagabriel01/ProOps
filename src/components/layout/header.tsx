"use client";

import * as React from "react";
import {
  Search,
  Bell,
  User as UserIcon,
  LogOut,
  ArrowLeft,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/providers/auth-provider";
import { useTenant } from "@/providers/tenant-provider";
import { MockDB } from "@/lib/mock-db";
import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function Header() {
  const { user, logout } = useAuth();
  const { tenant, refreshTenant, clearViewingTenant } = useTenant();
  const router = useRouter();
  const [isViewingAsTenant, setIsViewingAsTenant] = React.useState(false);

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
    MockDB.clearViewingAsTenant(); // Optionally keep if still needed for mock fallbacks
    router.push("/admin");
  };

  return (
    <header className="fixed top-0 right-0 left-64 h-16 bg-background/80 backdrop-blur-md border-b border-border z-40 px-6 flex items-center justify-between">
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

        <div className="relative w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar..."
            className="pl-9 h-9 bg-muted/50 border-transparent focus:bg-background focus:border-input transition-all"
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          className="relative text-muted-foreground hover:text-foreground rounded-full"
        >
          <Bell className="w-5 h-5" />
          <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-primary rounded-full animate-pulse" />
        </Button>
        <div className="h-8 w-[1px] bg-border mx-2" />
        <div className="flex items-center gap-3 pl-2">
          <div className="flex flex-col items-end hidden md:flex">
            <span className="text-sm font-medium">
              {user ? user.name : "Visitante"}
            </span>
            <span className="text-xs text-muted-foreground capitalize">
              {user ? user.role : "Guest"}
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
