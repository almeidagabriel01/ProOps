"use client";

import * as React from "react";
import { History } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Loader } from "@/components/ui/loader";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { ActivityTimeline } from "@/components/admin/activity/activity-timeline";
import {
  CATEGORY_FILTER_OPTIONS,
  TenantActivityDrawer,
  type ActivityTenantTarget,
} from "@/components/admin/activity/tenant-activity-drawer";
import { useTenantActivity } from "@/hooks/use-tenant-activity";
import { AdminService, type TenantIndexItem } from "@/services/admin-service";
import type { ActivityCategory } from "@/lib/activity/catalog";

/**
 * Atividade das empresas: o que os usuários de cada empresa fizeram dentro do
 * ERP (telas, cliques em Assinar, bloqueios da demonstração, erros) e a
 * jornada do cadastro à assinatura. A auditoria continua sendo o rastro do
 * super admin e das recusas do backend; esta tela é o lado do cliente.
 */
export default function AdminActivityPage() {
  const [tenants, setTenants] = React.useState<TenantIndexItem[]>([]);
  const [tenantId, setTenantId] = React.useState("");
  const [category, setCategory] = React.useState<"all" | ActivityCategory>("all");
  const [drawerTenant, setDrawerTenant] = React.useState<ActivityTenantTarget | null>(null);

  React.useEffect(() => {
    AdminService.getTenantsIndex()
      .then(setTenants)
      .catch(() => setTenants([]));
  }, []);

  const feed = useTenantActivity({
    tenantId: tenantId || undefined,
    category: category === "all" ? undefined : category,
  });

  const tenantName = React.useCallback(
    (id: string) => tenants.find((t) => t.id === id)?.name ?? id,
    [tenants],
  );

  const openTenant = React.useCallback(
    (id: string) => setDrawerTenant({ id, name: tenantName(id) }),
    [tenantName],
  );

  return (
    <div className="max-w-5xl mx-auto space-y-6 md:p-6 max-md:p-0">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <History className="w-6 h-6 text-primary" />
          Atividade
        </h1>
        <p className="text-sm text-muted-foreground">
          O que os usuários das empresas fizeram no ERP: telas abertas, cliques em Assinar,
          tentativas na demonstração e erros. Clique no nome da empresa para ver a jornada
          dela do cadastro à assinatura. Guardado por 90 dias.
        </p>
      </div>

      <div className="flex flex-col gap-2 md:flex-row md:items-center">
        <Select
          value={tenantId}
          onChange={(e) => setTenantId(e.target.value)}
          aria-label="Filtrar por empresa"
          className="md:max-w-xs"
        >
          <option value="">Todas as empresas</option>
          {tenants.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </Select>
        <SegmentedControl
          id="Filtrar atividade por tipo"
          options={CATEGORY_FILTER_OPTIONS}
          value={category}
          onChange={(value) => setCategory(value as "all" | ActivityCategory)}
        />
        <div className="flex gap-2 md:ml-auto">
          {tenantId && (
            <Button variant="outline" onClick={() => openTenant(tenantId)}>
              Ver jornada
            </Button>
          )}
          <Button variant="outline" onClick={feed.reload} disabled={feed.isLoading}>
            {feed.isLoading && <Loader size="sm" variant="button" className="mr-2" />}
            Atualizar
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 md:p-6">
          {feed.error && <p className="mb-4 text-sm text-destructive">{feed.error}</p>}
          <ActivityTimeline
            events={feed.events}
            isLoading={feed.isLoading}
            isLoadingMore={feed.isLoadingMore}
            hasMore={feed.hasMore}
            onLoadMore={feed.loadMore}
            tenantName={tenantName}
            onTenantClick={openTenant}
          />
        </CardContent>
      </Card>

      <TenantActivityDrawer tenant={drawerTenant} onClose={() => setDrawerTenant(null)} />
    </div>
  );
}
