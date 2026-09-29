"use client";

import * as React from "react";
import { Clock3 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader } from "@/components/ui/loader";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ClientSelect } from "@/components/features/client-select";
import { useTenant } from "@/providers/tenant-provider";
import { useCurrentNicheConfig } from "@/hooks/useCurrentNicheConfig";
import { toast } from "@/lib/toast";
import { FieldService } from "@/services/field-service-service";
import type {
  CustomerEquipment,
  ServiceOrder,
  ServiceOrderInput,
  ServiceOrderPriority,
  ServiceOrderType,
} from "@/types/field-service";
import {
  DURATIONS,
  PRIORITY_LABELS,
  TYPE_LABELS,
  formatDuration,
  isoToSchedule,
  scheduleToIso,
  type ScheduleFields,
} from "@/lib/field-service/service-orders";

interface ServiceOrderFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Sem `order`, abre uma OS nova. */
  order?: ServiceOrder | null;
  /** Cliente já escolhido (a OS aberta pela ficha do contato ou do equipamento). */
  initialClient?: { id: string; name: string } | null;
  initialEquipmentIds?: string[];
  onSaved: (id: string) => void;
}

interface FormState {
  clientId: string;
  clientName: string;
  address: string;
  title: string;
  type: ServiceOrderType;
  priority: ServiceOrderPriority;
  description: string;
  equipmentIds: string[];
  technicianId: string;
  schedule: ScheduleFields;
}

function initialState(
  order: ServiceOrder | null | undefined,
  client: { id: string; name: string } | null | undefined,
  equipmentIds: string[] | undefined,
): FormState {
  return {
    clientId: order?.clientId ?? client?.id ?? "",
    clientName: order?.clientName ?? client?.name ?? "",
    address: order?.address ?? "",
    title: order?.title ?? "",
    type: order?.type ?? "corrective",
    priority: order?.priority ?? "normal",
    description: order?.description ?? "",
    equipmentIds: order?.equipmentIds ?? equipmentIds ?? [],
    technicianId: order?.technicianUids[0] ?? "",
    schedule: isoToSchedule(order?.scheduledStart ?? null, order?.scheduledEnd ?? null),
  };
}

/** Abrir ou editar a OS: é o formulário de quem coordena os chamados. */
export function ServiceOrderFormDialog({
  open,
  onOpenChange,
  order,
  initialClient,
  initialEquipmentIds,
  onSaved,
}: ServiceOrderFormDialogProps) {
  const { tenant } = useTenant();
  const niche = useCurrentNicheConfig();
  const [form, setForm] = React.useState<FormState>(() => initialState(order, initialClient, initialEquipmentIds));
  const [saving, setSaving] = React.useState(false);
  const [equipment, setEquipment] = React.useState<CustomerEquipment[]>([]);
  const [technicians, setTechnicians] = React.useState<{ id: string; name: string }[]>([]);

  React.useEffect(() => {
    if (open) setForm(initialState(order, initialClient, initialEquipmentIds));
  }, [open, order, initialClient, initialEquipmentIds]);

  React.useEffect(() => {
    if (!open) return;
    FieldService.listTechnicians()
      .then(({ technicians: list }) => setTechnicians(list))
      .catch(() => setTechnicians([]));
  }, [open]);

  React.useEffect(() => {
    if (!open || !tenant?.id || !form.clientId) {
      setEquipment([]);
      return;
    }
    let cancelled = false;
    FieldService.listEquipment(tenant.id, form.clientId)
      .then((list) => !cancelled && setEquipment(list.filter((e) => e.status === "active")))
      .catch(() => !cancelled && setEquipment([]));
    return () => {
      cancelled = true;
    };
  }, [open, tenant?.id, form.clientId]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));
  const scheduled = form.schedule.date ? scheduleToIso(form.schedule) : null;
  const valid = Boolean(form.clientId) && form.title.trim().length >= 2 && (!form.schedule.date || scheduled);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!valid) return;
    setSaving(true);
    const input: ServiceOrderInput = {
      clientId: form.clientId,
      title: form.title.trim(),
      type: form.type,
      priority: form.priority,
      description: form.description.trim() || null,
      equipmentIds: form.equipmentIds,
      technicianId: form.technicianId || null,
      scheduledStart: scheduled?.start ?? null,
      scheduledEnd: scheduled?.end ?? null,
      address: form.address.trim() || null,
    };
    // A preventiva nova já nasce com o que a manutenção do segmento confere.
    if (!order && form.type === "preventive") {
      input.checklist = niche.fieldService.preventiveChecklist.map((text, i) => ({
        id: `preventiva_${i + 1}`,
        text,
        done: false,
        note: null,
      }));
    }
    try {
      if (order) {
        await FieldService.updateOrder(order.id, input);
        toast.success("OS atualizada.");
        onSaved(order.id);
      } else {
        const { id, code } = await FieldService.createOrder(input);
        toast.success(`${code} aberta.`);
        onSaved(id);
      }
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar a OS.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{order ? `Editar ${order.code}` : "Nova ordem de serviço"}</DialogTitle>
          <DialogDescription>
            O chamado do cliente: o que aconteceu, em qual aparelho, quando e com quem.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label>Cliente</Label>
            <ClientSelect
              value={form.clientName}
              clientId={form.clientId || undefined}
              disabled={saving}
              onChange={(data) =>
                setForm((f) => ({
                  ...f,
                  clientId: data.isNew ? "" : (data.clientId ?? ""),
                  clientName: data.clientName,
                  address: data.isNew ? f.address : (data.clientAddress ?? f.address),
                  equipmentIds: data.clientId === f.clientId ? f.equipmentIds : [],
                }))
              }
            />
            {!form.clientId && form.clientName.trim() && (
              <p className="text-xs text-muted-foreground">
                Escolha um contato da lista. Um cliente novo é cadastrado antes em Contatos.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="soTitle">O que o cliente relatou</Label>
            <Input
              id="soTitle"
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="Ex.: ar-condicionado da sala não gela"
              maxLength={160}
              disabled={saving}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="soType">Tipo</Label>
              <Select
                id="soType"
                value={form.type}
                onChange={(e) => set("type", e.target.value as ServiceOrderType)}
                disableSort
                disabled={saving}
              >
                {Object.entries(TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
              {!order && form.type === "preventive" && (
                <p className="text-xs text-muted-foreground">
                  Nasce com o checklist da manutenção preventiva do seu segmento.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="soPriority">Prioridade</Label>
              <Select
                id="soPriority"
                value={form.priority}
                onChange={(e) => set("priority", e.target.value as ServiceOrderPriority)}
                disableSort
                disabled={saving}
              >
                {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="soDescription">Detalhes</Label>
            <Textarea
              id="soDescription"
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              rows={3}
              maxLength={4000}
              disabled={saving}
            />
          </div>

          {form.clientId && (
            <div className="space-y-2">
              <Label>Equipamentos atendidos</Label>
              {equipment.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Este cliente ainda não tem equipamento cadastrado.
                </p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {equipment.map((item) => {
                    const checked = form.equipmentIds.includes(item.id);
                    return (
                      <label
                        key={item.id}
                        className="flex cursor-pointer items-start gap-2 rounded-lg border p-3 text-sm"
                      >
                        <Checkbox
                          checked={checked}
                          disabled={saving}
                          onCheckedChange={(next) =>
                            set(
                              "equipmentIds",
                              next ? [...form.equipmentIds, item.id] : form.equipmentIds.filter((id) => id !== item.id),
                            )
                          }
                          className="mt-0.5"
                        />
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{item.name}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {[item.brand, item.model, item.location].filter(Boolean).join(" · ") || "Sem detalhes"}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="soTechnician">Técnico</Label>
              <Select
                id="soTechnician"
                value={form.technicianId}
                onChange={(e) => set("technicianId", e.target.value)}
                disableSort
                disabled={saving}
              >
                <option value="">Sem técnico</option>
                {technicians.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="soAddress">Endereço do atendimento</Label>
              <Input
                id="soAddress"
                value={form.address}
                onChange={(e) => set("address", e.target.value)}
                maxLength={300}
                disabled={saving}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="soDate">Data da visita</Label>
              <DatePicker
                id="soDate"
                name="soDate"
                value={form.schedule.date}
                onChange={(e) => set("schedule", { ...form.schedule, date: e.target.value })}
                disabled={saving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="soTime">Horário</Label>
              <Input
                id="soTime"
                type="time"
                value={form.schedule.time}
                onChange={(e) => set("schedule", { ...form.schedule, time: e.target.value })}
                icon={<Clock3 className="h-4 w-4" />}
                disabled={saving || !form.schedule.date}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="soDuration">Duração</Label>
              <Select
                id="soDuration"
                value={String(form.schedule.durationMin)}
                onChange={(e) => set("schedule", { ...form.schedule, durationMin: Number(e.target.value) })}
                disableSort
                disabled={saving || !form.schedule.date}
              >
                {DURATIONS.map((minutes) => (
                  <option key={minutes} value={minutes}>
                    {formatDuration(minutes)}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving || !valid}>
              {saving && <Loader size="sm" variant="button" className="mr-2" />}
              {order ? "Salvar" : "Abrir OS"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
