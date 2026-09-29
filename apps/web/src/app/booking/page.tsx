"use client";

import * as React from "react";
import { Shield } from "lucide-react";
import { PageViewSwitcher } from "@/components/layout/page-view-switcher";
import { UpgradeRequired } from "@/components/ui/upgrade-required";
import { usePermissions } from "@/providers/permissions-provider";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { useCurrentNicheConfig } from "@/hooks/useCurrentNicheConfig";
import { demoBookingSettings } from "@/lib/booking/booking-format";
import { BookingSettingsCard } from "./_components/booking-settings-card";
import { BookingCardSkeleton } from "./_components/booking-skeleton";

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

  if (!planLoading && !hasBookingLink) {
    return (
      <UpgradeRequired
        feature="Link de agendamento"
        description="Mande ao cliente um link para ele escolher um horário livre e pedir a visita, que entra na Agenda para você confirmar. Disponível a partir do plano Pro."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Link de agendamento
        </h1>
        <p className="mt-1 text-muted-foreground">
          O cliente escolhe um horário livre e pede a visita
        </p>
        <PageViewSwitcher className="mt-3" />
      </div>

      <div className="max-w-4xl">
        {permLoading || planLoading ? (
          <BookingCardSkeleton />
        ) : canConfigure ? (
          <BookingSettingsCard />
        ) : isDemo ? (
          <BookingSettingsCard readOnly demoDefaults={demoDefaults} />
        ) : (
          <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
            <Shield className="w-16 h-16 text-muted-foreground mb-4" />
            <h2 className="text-2xl font-bold mb-2">Acesso Restrito</h2>
            <p className="text-muted-foreground">
              Apenas o administrador configura o link. Os pedidos de visita aparecem no Calendário.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
