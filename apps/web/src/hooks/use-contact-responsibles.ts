"use client";

import * as React from "react";
import { useTenant } from "@/providers/tenant-provider";
import { ClientService, type Client } from "@/services/client-service";
import { TeamService, type TeamPerson } from "@/services/team-service";

/**
 * As duas listas de quem pode cuidar de um cliente: as pessoas da equipe e os
 * parceiros externos (contatos vendedor ou arquiteto). Servem ao cadastro do
 * contato, à proposta e aos filtros das listas.
 *
 * A equipe vem da API (o membro não lê `users` no Firestore). A conta de
 * demonstração não chama a API: os dados de exemplo não têm responsável.
 */
export interface ContactResponsiblesOptions {
  people: TeamPerson[];
  partners: Client[];
  loading: boolean;
}

export function useContactResponsibles(): ContactResponsiblesOptions {
  const { tenant, isDemo } = useTenant();
  const tenantId = tenant?.id;
  const [people, setPeople] = React.useState<TeamPerson[]>([]);
  const [partners, setPartners] = React.useState<Client[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!tenantId) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([
      isDemo ? Promise.resolve([]) : TeamService.people().catch(() => []),
      ClientService.getClientsByTypes(tenantId, ["vendedor", "arquiteto"]).catch(() => []),
    ])
      .then(([nextPeople, nextPartners]) => {
        if (cancelled) return;
        setPeople(nextPeople);
        setPartners(nextPartners);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tenantId, isDemo]);

  return { people, partners, loading };
}
