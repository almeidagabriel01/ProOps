"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ClipboardPlus, Pencil, Plus, ServerCog, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { useTenant } from "@/providers/tenant-provider";
import { usePagePermission } from "@/hooks/usePagePermission";
import { useServiceOrderScope } from "@/hooks/useServiceOrders";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { normalize } from "@/utils/text";
import { FieldService } from "@/services/field-service-service";
import type { CustomerEquipment } from "@/types/field-service";
import { ServiceOrderFormDialog } from "@/components/features/field-service/service-order-form-dialog";
import { formatWhen, warrantyState } from "@/lib/field-service/service-orders";
import { EquipmentFormDialog } from "./equipment-form-dialog";

interface EquipmentListProps {
  /** Só os equipamentos deste contato (a aba da ficha). */
  client?: { id: string; name: string } | null;
}

function todayInBrazil(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

function formatDay(day: string | null): string | null {
  if (!day) return null;
  const [y, m, d] = day.split("-");
  return `${d}/${m}/${y}`;
}

const WARRANTY_COPY = {
  expired: { label: "Garantia vencida", tone: "text-rose-600 dark:text-rose-400" },
  expiring: { label: "Garantia vence em breve", tone: "text-amber-600 dark:text-amber-400" },
  valid: { label: "Na garantia", tone: "text-emerald-600 dark:text-emerald-400" },
} as const;

/** O parque instalado: da empresa inteira, ou de um cliente só. */
export function EquipmentList({ client }: EquipmentListProps) {
  const router = useRouter();
  const { tenant, isReadOnly } = useTenant();
  const equipmentPermission = usePagePermission("equipment");
  const ordersPermission = usePagePermission("service_orders");
  const scope = useServiceOrderScope();
  const [items, setItems] = React.useState<CustomerEquipment[] | null>(null);
  const [search, setSearch] = React.useState("");
  const [editing, setEditing] = React.useState<CustomerEquipment | null>(null);
  const [formOpen, setFormOpen] = React.useState(false);
  const [orderFor, setOrderFor] = React.useState<CustomerEquipment | null>(null);
  const [removing, setRemoving] = React.useState<CustomerEquipment | null>(null);
  const [busy, setBusy] = React.useState(false);
  const today = React.useMemo(() => todayInBrazil(), []);
  const tenantId = tenant?.id;

  const load = React.useCallback(() => {
    if (!tenantId) return;
    FieldService.listEquipment(tenantId, client?.id)
      .then(setItems)
      .catch(() => {
        setItems([]);
        toast.error("Erro ao carregar os equipamentos.");
      });
  }, [tenantId, client?.id]);

  React.useEffect(load, [load]);

  const writable = !isReadOnly;
  const canCreate = writable && equipmentPermission.canCreate;
  const canEdit = writable && equipmentPermission.canEdit;
  const canDelete = writable && equipmentPermission.canDelete;
  const canOpenOrder = writable && ordersPermission.canCreate && scope.seesAll;

  const term = normalize(search.trim());
  const visible = (items ?? []).filter(
    (item) =>
      !term ||
      [item.name, item.clientName, item.type, item.brand, item.model, item.serialNumber, item.location]
        .filter(Boolean)
        .some((value) => normalize(String(value)).includes(term)),
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {!client && (
          <Input
            aria-label="Buscar equipamento"
            placeholder="Buscar por nome, cliente, marca, modelo ou série"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="sm:max-w-sm"
          />
        )}
        {canCreate && (
          <Button
            className="sm:ml-auto"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Novo equipamento
          </Button>
        )}
      </div>

      {items === null ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-40 w-full rounded-xl" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={ServerCog}
          title={items.length === 0 ? "Nenhum equipamento cadastrado" : "Nada encontrado"}
          description={
            items.length === 0
              ? "Cadastre o que está instalado no cliente, com marca, modelo, série e garantia. A OS aponta para o aparelho atendido e o histórico fica guardado."
              : "Tente outro termo de busca."
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((item) => {
            const warranty = warrantyState(item.warrantyUntil, today);
            const detail = [item.brand, item.model].filter(Boolean).join(" ");
            return (
              <Card key={item.id} className={cn(item.status === "inactive" && "opacity-70")}>
                <CardContent className="space-y-3 p-5">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-muted-foreground">
                      {[item.type, item.status === "inactive" ? "Desativado" : null].filter(Boolean).join(" · ") ||
                        "Equipamento"}
                    </p>
                    <h3 className="truncate font-semibold">{item.name}</h3>
                    {!client && <p className="truncate text-sm text-muted-foreground">{item.clientName}</p>}
                  </div>
                  <dl className="space-y-1 text-sm">
                    {detail && <div className="truncate">{detail}</div>}
                    {item.serialNumber && <div className="truncate text-muted-foreground">Série {item.serialNumber}</div>}
                    {item.location && <div className="truncate text-muted-foreground">{item.location}</div>}
                    {warranty !== "none" && (
                      <div className={WARRANTY_COPY[warranty].tone}>
                        {WARRANTY_COPY[warranty].label} ({formatDay(item.warrantyUntil)})
                      </div>
                    )}
                    <div className="text-muted-foreground">
                      {item.lastServiceAt ? `Último atendimento ${formatWhen(item.lastServiceAt)}` : "Nunca atendido"}
                    </div>
                  </dl>
                  {(canOpenOrder || canEdit || canDelete) && (
                    <div className="flex flex-wrap gap-2 border-t pt-3">
                      {canOpenOrder && (
                        <Button size="sm" variant="outline" onClick={() => setOrderFor(item)}>
                          <ClipboardPlus className="mr-1.5 h-4 w-4" />
                          Abrir OS
                        </Button>
                      )}
                      {canEdit && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditing(item);
                            setFormOpen(true);
                          }}
                        >
                          <Pencil className="mr-1.5 h-4 w-4" />
                          Editar
                        </Button>
                      )}
                      {canDelete && (
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={`Excluir ${item.name}`}
                          className="ml-auto"
                          onClick={() => setRemoving(item)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <EquipmentFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        equipment={editing}
        client={client}
        onSaved={load}
      />
      <ServiceOrderFormDialog
        open={orderFor !== null}
        onOpenChange={(open) => !open && setOrderFor(null)}
        initialClient={orderFor ? { id: orderFor.clientId, name: orderFor.clientName } : null}
        initialEquipmentIds={orderFor ? [orderFor.id] : undefined}
        onSaved={(id) => router.push(`/service-orders/${id}`)}
      />
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={`Excluir ${removing?.name ?? "equipamento"}?`}
        description="As OS antigas continuam com o nome do aparelho. Para só tirá-lo de uso, edite e marque como desativado."
        confirmLabel="Excluir"
        destructive
        isPending={busy}
        onConfirm={async () => {
          if (!removing) return;
          setBusy(true);
          try {
            await FieldService.removeEquipment(removing.id);
            toast.success("Equipamento excluído.");
            setRemoving(null);
            load();
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "Erro ao excluir o equipamento.");
          } finally {
            setBusy(false);
          }
        }}
      />
    </div>
  );
}
