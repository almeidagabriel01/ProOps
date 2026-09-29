"use client";

import * as React from "react";
import { Shield } from "lucide-react";
import { PageViewSwitcher } from "@/components/layout/page-view-switcher";
import { UpgradeRequired } from "@/components/ui/upgrade-required";
import { usePermissions } from "@/providers/permissions-provider";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { useCurrentNicheConfig } from "@/hooks/useCurrentNicheConfig";
import { demoBookingSettings } from "@/lib/booking/booking-format";
import { BookingSettingsPanel } from "./_components/booking-settings-panel";
import { BookingSkeleton } from "./_components/booking-skeleton";

/**
 * Link de agendamento (Pro e Enterprise), uma visão do grupo Agenda. O
 * expediente é do dono e dos administradores; o portão fica dentro da tela,
 * como nas metas, para o membro não cair em `/403`. Os pedidos que chegam são
 * respondidos no Calendário, com a permissão dele. A conta de demonstração vê
 * o padrão do nicho, sem salvar.
 */
export default function BookingPage() {
  const { isMaster, isDemo, isLoading: permLoading } = usePermissions();
  const { hasBookingLink, isLoading: planLoading } = usePlanLimits();
  const nicheConfig = useCurrentNicheConfig();
  const canConfigure = isMaster && !isDemo;

  const demoDefaults = React.useMemo(
    () => demoBookingSettings(nicheConfig.booking.defaultVisitType),
    [nicheConfig.booking.defaultVisitType],
  );

  if (permLoading || planLoading) return <BookingSkeleton />;

  if (!hasBookingLink) {
    return (
      <UpgradeRequired
        feature="Link de agendamento"
        description="Mande ao cliente um link para ele escolher um horário livre e pedir a visita, que entra na Agenda para você confirmar. Disponível a partir do plano Pro."
      />
    );
  }

  const header = (
    <div>
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Link de agendamento</h1>
      <p className="mt-1 text-muted-foreground">O cliente escolhe um horário livre e pede a visita</p>
      <PageViewSwitcher className="mt-3" />
    </div>
  );

  if (canConfigure) return <BookingSettingsPanel header={header} />;
  if (isDemo) return <BookingSettingsPanel header={header} readOnly demoDefaults={demoDefaults} />;

  return (
    <div className="space-y-6">
      {header}
      <div className="flex min-h-[400px] flex-col items-center justify-center text-center">
        <Shield className="mb-4 h-16 w-16 text-muted-foreground" />
        <h2 className="mb-2 text-2xl font-bold">Acesso Restrito</h2>
        <p className="text-muted-foreground">
          Apenas o administrador configura o link. Os pedidos de visita aparecem no Calendário.
        </p>
      </div>
    </div>
  );
}
