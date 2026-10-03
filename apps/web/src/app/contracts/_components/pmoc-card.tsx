"use client";

import * as React from "react";
import Link from "next/link";
import { HardHat } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDay } from "@/lib/field-service/contracts";
import { pmocItemsSummary } from "@/lib/field-service/pmoc-form";
import {
  ART_STATUS_LABELS,
  ART_STATUS_STYLES,
  artStatus,
  todayInBrazil,
} from "@/lib/field-service/technical-responsibles";
import { cn } from "@/lib/utils";
import { TechnicalResponsiblesService } from "@/services/technical-responsibles-service";
import type { ServiceContract, TechnicalResponsible } from "@/types/field-service";

interface PmocCardProps {
  contract: ServiceContract;
  tenantId: string;
  /** Quem cuida do contrato pode ir cadastrar o responsável que falta. */
  showSettingsLink: boolean;
}

/** O PMOC do contrato: quem assina, o prédio e o tamanho do plano. */
export function PmocCard({ contract, tenantId, showSettingsLink }: PmocCardProps) {
  const pmoc = contract.pmoc;
  const responsibleId = pmoc?.responsibleId ?? null;
  const [responsible, setResponsible] = React.useState<TechnicalResponsible | null | undefined>(undefined);

  React.useEffect(() => {
    if (!responsibleId) {
      setResponsible(null);
      return;
    }
    let cancelled = false;
    TechnicalResponsiblesService.list(tenantId)
      .then((list) => !cancelled && setResponsible(list.find((r) => r.id === responsibleId) ?? null))
      .catch(() => !cancelled && setResponsible(null));
    return () => {
      cancelled = true;
    };
  }, [tenantId, responsibleId]);

  if (!pmoc) return null;
  const building = pmoc.building;
  const facts = [
    building.use,
    building.occupants != null ? `${building.occupants} ocupantes` : null,
    building.climatizedArea != null ? `${building.climatizedArea.toLocaleString("pt-BR")} m² climatizados` : null,
  ].filter(Boolean);
  const status = responsible ? artStatus(responsible.artValidUntil, todayInBrazil()) : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <HardHat className="h-4 w-4" />
          PMOC
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 text-sm md:grid-cols-3">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Responsável técnico</p>
          {responsible === undefined ? (
            <p className="text-muted-foreground">Carregando...</p>
          ) : responsible ? (
            <>
              <p className="font-medium">{responsible.name}</p>
              <p className="text-muted-foreground">
                {responsible.council} {responsible.registryNumber}
              </p>
              {status && (
                <Badge variant="outline" className={cn("font-normal", ART_STATUS_STYLES[status])}>
                  {ART_STATUS_LABELS[status]}
                  {responsible.artValidUntil ? `, até ${formatDay(responsible.artValidUntil)}` : ""}
                </Badge>
              )}
            </>
          ) : (
            <p className="text-muted-foreground">
              Nenhum. Obrigatório para ativar.
              {showSettingsLink && (
                <>
                  {" "}
                  <Link
                    href="/settings/technical-responsibles"
                    className="text-primary underline-offset-4 hover:underline"
                  >
                    Cadastrar
                  </Link>
                </>
              )}
            </p>
          )}
        </div>
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Prédio</p>
          <p className="font-medium">{building.name || contract.clientName}</p>
          {building.address && <p className="text-muted-foreground">{building.address}</p>}
          {facts.length > 0 && <p className="text-muted-foreground">{facts.join(", ")}</p>}
        </div>
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Plano</p>
          <p>{pmocItemsSummary(pmoc.items)}</p>
          {pmoc.anchorDate && (
            <p className="text-muted-foreground">Frequências contadas desde {formatDay(pmoc.anchorDate)}.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
