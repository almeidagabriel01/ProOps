"use client";

import * as React from "react";
import { CalendarClock, Shield } from "lucide-react";
import {
  FormContainer,
  FormHeader,
  FormHeaderSkeleton,
} from "@/components/ui/form-components";
import { UpgradeRequired } from "@/components/ui/upgrade-required";
import { BookingSettingsCard } from "@/app/settings/_components/booking-settings-card";
import { useReportSettingsLoading } from "@/app/settings/_components/settings-chrome";
import { BookingCardSkeleton } from "@/app/settings/_components/settings-skeleton";
import { usePermissions } from "@/providers/permissions-provider";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { useCurrentNicheConfig } from "@/hooks/useCurrentNicheConfig";
import { demoBookingSettings } from "@/lib/booking/booking-format";

/**
 * Link de agendamento (Pro e Enterprise). O expediente é do dono e dos
 * administradores; o portão fica dentro da tela, como nas metas, para o membro
 * não cair em `/403`. Os pedidos que chegam são respondidos na Agenda, com a
 * permissão dela. A conta de demonstração vê o padrão do nicho, sem salvar.
 */
export default function SettingsBookingPage() {
  const { isMaster, isDemo, isLoading: permLoading } = usePermissions();
  const { hasBookingLink, isLoading: planLoading } = usePlanLimits();
  const nicheConfig = useCurrentNicheConfig();
  const [cardLoading, setCardLoading] = React.useState(true);
  const canConfigure = isMaster && !isDemo;
  const loading = permLoading || planLoading || (canConfigure && cardLoading);
  useReportSettingsLoading(loading);

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
    <FormContainer>
      {permLoading || planLoading ? (
        <FormHeaderSkeleton />
      ) : (
        <FormHeader
          title="Link de agendamento"
          subtitle="O cliente escolhe um horário livre e pede a visita"
          icon={CalendarClock}
        />
      )}
      {permLoading || planLoading ? (
        <BookingCardSkeleton />
      ) : canConfigure ? (
        <BookingSettingsCard onLoadingChange={setCardLoading} />
      ) : isDemo ? (
        <BookingSettingsCard readOnly demoDefaults={demoDefaults} />
      ) : (
        <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
          <Shield className="w-16 h-16 text-muted-foreground mb-4" />
          <h2 className="text-2xl font-bold mb-2">Acesso Restrito</h2>
          <p className="text-muted-foreground">
            Apenas o administrador configura o link. Os pedidos de visita aparecem na Agenda.
          </p>
        </div>
      )}
    </FormContainer>
  );
}
