"use client";

import * as React from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Select } from "@/components/ui/select";
import { ACTIVITY_CATEGORIES, ACTIVITY_CATEGORY_LABELS, type ActivityCategory } from "@/lib/activity/catalog";
import { useTenantActivity } from "@/hooks/use-tenant-activity";
import { ActivityTimeline } from "./activity-timeline";
import { ActivityJourney } from "./activity-journey";

export interface ActivityTenantTarget {
  id: string;
  name: string;
}

interface TenantActivityDrawerProps {
  tenant: ActivityTenantTarget | null;
  onClose: () => void;
}

export const CATEGORY_FILTER_OPTIONS = [
  { value: "all", label: "Todas" },
  ...ACTIVITY_CATEGORIES.map((category) => ({ value: category, label: ACTIVITY_CATEGORY_LABELS[category] })),
];

/**
 * Linha do tempo de uma empresa: o que cada pessoa dela abriu, tentou e errou,
 * com a jornada do cadastro à assinatura no topo. Aberta pelo botão
 * "Atividade" do card da empresa, da Visão geral e da tela Atividade.
 */
export function TenantActivityDrawer({ tenant, onClose }: TenantActivityDrawerProps) {
  const [category, setCategory] = React.useState<"all" | ActivityCategory>("all");
  const [uid, setUid] = React.useState("");
  const open = Boolean(tenant);
  const tenantId = tenant?.id;

  React.useEffect(() => {
    setCategory("all");
    setUid("");
  }, [tenantId]);

  const journey = useTenantActivity({ tenantId, category: "funnel", limit: 50 }, open);
  const timeline = useTenantActivity(
    { tenantId, category: category === "all" ? undefined : category, uid: uid || undefined },
    open,
  );

  // Pessoas da empresa que aparecem no que já foi carregado.
  const people = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const event of [...timeline.events, ...journey.events]) {
      if (!event.uid || map.has(event.uid)) continue;
      map.set(event.uid, event.actor?.name || event.actor?.email || event.uid);
    }
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1], "pt-BR"));
  }, [timeline.events, journey.events]);

  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        {tenant && (
          <>
            <SheetHeader>
              <SheetTitle className="text-left">{tenant.name}</SheetTitle>
              <SheetDescription className="text-left">
                Telas, ações, jornada e erros dos usuários desta empresa nos últimos 90 dias.
              </SheetDescription>
            </SheetHeader>

            <div className="mt-5 space-y-5">
              <ActivityJourney events={journey.events} isLoading={journey.isLoading} />

              <div className="flex flex-col gap-2">
                <SegmentedControl
                  id="Filtrar atividade por tipo"
                  options={CATEGORY_FILTER_OPTIONS}
                  value={category}
                  onChange={(value) => setCategory(value as "all" | ActivityCategory)}
                />
                <Select
                  value={uid}
                  onChange={(e) => setUid(e.target.value)}
                  aria-label="Filtrar por usuário"
                  className="sm:max-w-xs"
                >
                  <option value="">Todos os usuários</option>
                  {people.map(([id, name]) => (
                    <option key={id} value={id}>
                      {name}
                    </option>
                  ))}
                </Select>
              </div>

              {timeline.error && <p className="text-sm text-destructive">{timeline.error}</p>}

              <ActivityTimeline
                events={timeline.events}
                isLoading={timeline.isLoading}
                isLoadingMore={timeline.isLoadingMore}
                hasMore={timeline.hasMore}
                onLoadMore={timeline.loadMore}
                emptyMessage="Nenhuma atividade desta empresa com esse filtro."
              />
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
