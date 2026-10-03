"use client";

import * as React from "react";
import {
  Compass,
  Download,
  LifeBuoy,
  LogOut,
  MessageCircle,
  Settings,
  User as UserIcon,
} from "lucide-react";
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
import { usePlanLimits } from "@/hooks/usePlanLimits";
import {
  BOT_WHATSAPP_DIGITS,
  SUPPORT_WHATSAPP_DIGITS,
  buildWhatsAppHref,
} from "@/lib/whatsapp-contacts";
import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { useHeaderPresentation } from "@/hooks/useHeaderPresentation";
import { getUserColor, getInitials } from "@/lib/avatar-utils";
import { ImpersonationBar } from "@/components/layout/impersonation-bar";
import { useOptionalOnboarding } from "@/components/onboarding/onboarding-provider";
import { HelpPanel } from "@/components/layout/help-panel";
import { InstallAppDialog } from "@/components/layout/install-app-dialog";
import { useInstallPrompt } from "@/lib/pwa/install-prompt";
import { HEADER_ICON_BUTTON_CLASS } from "@/components/layout/header-icon-button";

const SUPPORT_HREF = buildWhatsAppHref(
  SUPPORT_WHATSAPP_DIGITS,
  "Olá! Preciso de ajuda com a ProOps.",
);

// Aponta para o BOT (assistente), não para o suporte.
const WHATSAPP_HREF = buildWhatsAppHref(BOT_WHATSAPP_DIGITS);

interface HeaderProps {
  sidebarWidth?: number;
}

function HeaderSkeleton() {
  return (
    <header
      className="relative z-50 h-14 min-h-14 md:h-16 md:min-h-16 bg-background/80 backdrop-blur-md border-b border-border px-4 md:px-6 flex items-center justify-between rounded-t-[2rem] transition-all duration-300"
    >
      <div className="flex items-center gap-4">
        <Skeleton className="h-9 w-40 sm:w-56 rounded-xl" />
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
  const onboarding = useOptionalOnboarding();
  // O super admin não tem tutorial: o painel dele é outro, e no "Acessar
  // Painel" o estado gravado seria o da conta dele, não o da empresa vista.
  const canOpenTutorial =
    !!onboarding &&
    onboarding.steps.length > 0 &&
    String(user?.role || "").toLowerCase() !== "superadmin";
  const { isLoading: isPermLoading } = usePermissions();
  const { option: installOption, promptInstall } = useInstallPrompt();
  const [installHelpOpen, setInstallHelpOpen] = React.useState(false);
  const {
    tenant,
    clearViewingTenant,
    isLoading: isTenantLoading,
    isGlobalLoading,
    impersonationWriteEnabled,
    setImpersonationWriteEnabled,
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
  const { hasWhatsApp } = usePlanLimits();

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
      className="relative z-50 h-14 min-h-14 md:h-16 md:min-h-16 bg-background/80 backdrop-blur-md border-b border-border px-4 md:px-6 flex items-center justify-between rounded-t-[2rem] transition-all duration-300 animate-in fade-in"
    >
      <div className="flex min-w-0 items-center gap-4">
        <CommandPalette />
        {isViewingAsTenant && user?.role === "superadmin" && (
          <ImpersonationBar
            companyName={companyName || tenant?.name || "Empresa"}
            planLabel={isPlanLabelLoading ? null : planLabel}
            writeEnabled={impersonationWriteEnabled}
            onToggleWrite={setImpersonationWriteEnabled}
            onExit={handleBackToAdmin}
          />
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2 md:gap-4">
        {/* Os três na mesma caixa do sino (40px, ícone de 20px centralizado) e
            sem gap entre eles: com caixas diferentes, o espaço visível entre
            os ícones ficava desigual. O [&>div]:mt-0 anula o mt-1 do wrapper
            do DropdownMenu do sino, que o deixava 4px abaixo dos outros. */}
        <div className="flex items-center [&>div]:mt-0">
          <HelpPanel canOpenTutorial={canOpenTutorial} />
          <AnimatedThemeToggler className={HEADER_ICON_BUTTON_CLASS} />
          <NotificationBell />
        </div>
        <div className="hidden h-8 w-px bg-border sm:block" />
        <div className="flex items-center gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                data-testid="user-menu-trigger"
                className="relative h-fit py-2 pr-2 pl-2 md:pl-6 rounded-full flex items-center justify-end gap-3 hover:bg-muted/50 transition-colors"
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
              <DropdownMenuItem
                onClick={() => router.push("/settings")}
                className="cursor-pointer"
              >
                <Settings className="mr-2 h-4 w-4" />
                <span>Configurações</span>
              </DropdownMenuItem>
              {canOpenTutorial && (
                <DropdownMenuItem
                  onClick={() => void onboarding.openTutorial()}
                  className="cursor-pointer"
                >
                  <Compass className="mr-2 h-4 w-4" />
                  <span>Tutorial da plataforma</span>
                </DropdownMenuItem>
              )}
              {/* Some quando já está instalado ou o navegador não instala. */}
              {installOption && (
                <DropdownMenuItem
                  onClick={() =>
                    installOption === "native"
                      ? void promptInstall()
                      : setInstallHelpOpen(true)
                  }
                  className="cursor-pointer"
                >
                  <Download className="mr-2 h-4 w-4" />
                  <span>Instalar a ProOps</span>
                </DropdownMenuItem>
              )}
              {/* O bot no WhatsApp: link externo, não um módulo do ERP. Ele não
                  tem página, permissão nem nicho, e ocupava um lugar fixo na
                  dock para uma ação que nem é navegação. Sem a flag do tenant,
                  o item não existe, como antes. */}
              {hasWhatsApp && WHATSAPP_HREF && (
                <DropdownMenuItem
                  onClick={() =>
                    window.open(WHATSAPP_HREF, "_blank", "noopener,noreferrer")
                  }
                  className="cursor-pointer"
                >
                  <MessageCircle className="mr-2 h-4 w-4" />
                  <span>WhatsApp</span>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onClick={() =>
                  window.open(SUPPORT_HREF, "_blank", "noopener,noreferrer")
                }
                className="cursor-pointer"
              >
                <LifeBuoy className="mr-2 h-4 w-4" />
                <span>Falar com o suporte</span>
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
          <InstallAppDialog
            open={installHelpOpen}
            onOpenChange={setInstallHelpOpen}
          />
        </div>
      </div>
    </header>
  );
}
