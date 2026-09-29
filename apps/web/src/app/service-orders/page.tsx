"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ClipboardList, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { UpgradeRequired } from "@/components/ui/upgrade-required";
import { EmptyState } from "@/components/shared/empty-state";
import { SelectTenantState } from "@/components/shared/select-tenant-state";
import { PageViewSwitcher } from "@/components/layout/page-view-switcher";
import { useTenant } from "@/providers/tenant-provider";
import { useAuth } from "@/providers/auth-provider";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { usePagePermission } from "@/hooks/usePagePermission";
import { useServiceOrders } from "@/hooks/useServiceOrders";
import { ServiceOrdersSkeleton } from "./_components/service-orders-skeleton";
import { ServiceOrderCard } from "./_components/service-order-card";
import { ServiceOrderFormDialog } from "@/components/features/field-service/service-order-form-dialog";
import { filterOrders, sortQueue, type ServiceOrderFilter } from "@/lib/field-service/service-orders";

/** Ordens de serviço: a fila de chamados técnicos, da abertura à assinatura do cliente. */
export default function ServiceOrdersPage() {
  const router = useRouter();
  const { tenant, isReadOnly } = useTenant();
  const { user } = useAuth();
  const { hasFieldService, isLoading: isPlanLoading } = usePlanLimits();
  const { canCreate } = usePagePermission("service_orders");
  const allowed = hasFieldService || user?.role === "superadmin";
  const { orders, loading, error, scope } = useServiceOrders(tenant?.id, allowed);
  const [filter, setFilter] = React.useState<ServiceOrderFilter>("open");
  const [newOpen, setNewOpen] = React.useState(false);

  if (!user) return null;
  if (user.role === "superadmin" && !tenant) {
    return <SelectTenantState title="Selecione uma empresa para ver as ordens de serviço" />;
  }
  if (isPlanLoading) return <ServiceOrdersSkeleton />;
  if (!allowed) {
    return (
      <UpgradeRequired
        feature="Ordens de serviço"
        description="Atenda chamados com ordem de serviço: o técnico preenche no celular, as peças saem do estoque e o cliente assina na tela. Incluído nos planos Pro e Enterprise, ou como add-on no Starter."
      />
    );
  }
  if (loading) return <ServiceOrdersSkeleton />;

  const uid = user.id ?? null;
  const visible = filter === "completed" || filter === "all"
    ? filterOrders(orders, filter, uid)
    : sortQueue(filterOrders(orders, filter, uid));
  const count = (f: ServiceOrderFilter) => filterOrders(orders, f, uid).length;
  const canOpen = !isReadOnly && canCreate && scope.seesAll;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">Ordens de serviço</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {scope.seesAll
              ? "Os chamados técnicos da equipe, da abertura à assinatura do cliente."
              : "Os chamados atribuídos a você."}
          </p>
          <PageViewSwitcher className="mt-3" />
        </div>
        {canOpen && (
          <Button onClick={() => setNewOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nova OS
          </Button>
        )}
      </div>

      <SegmentedControl
        id="service-orders-filter"
        value={filter}
        onChange={(v) => setFilter(v as ServiceOrderFilter)}
        options={[
          { value: "open", label: "Em aberto", count: count("open") },
          { value: "mine", label: "Minhas", count: count("mine") },
          { value: "completed", label: "Concluídas", count: count("completed") },
          { value: "all", label: "Todas", count: orders.length },
        ]}
      />

      {error ? (
        <EmptyState
          icon={ClipboardList}
          title="Não foi possível carregar as OS"
          description="Verifique a conexão e recarregue a página."
        />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title={orders.length === 0 ? "Nenhuma ordem de serviço ainda" : "Nada neste filtro"}
          description={
            orders.length === 0
              ? scope.seesAll
                ? "Abra uma OS para cada chamado: o técnico recebe, atende pelo celular, registra peças e fotos, e o cliente assina na tela."
                : "Quando uma OS for atribuída a você, ela aparece aqui."
              : "Troque o filtro para ver as outras."
          }
          action={
            orders.length === 0 && canOpen ? (
              <Button onClick={() => setNewOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Nova OS
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((order) => (
            <ServiceOrderCard key={order.id} order={order} />
          ))}
        </div>
      )}

      <ServiceOrderFormDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        onSaved={(id) => router.push(`/service-orders/${id}`)}
      />
    </div>
  );
}
