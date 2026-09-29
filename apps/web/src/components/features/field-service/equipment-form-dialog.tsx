"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { keepOpenOnOutsideClick } from "@/lib/field-service/service-orders";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader } from "@/components/ui/loader";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ClientSelect } from "@/components/features/client-select";
import { useCurrentNicheConfig } from "@/hooks/useCurrentNicheConfig";
import { toast } from "@/lib/toast";
import { FieldService } from "@/services/field-service-service";
import type { CustomerEquipment, EquipmentInput, EquipmentStatus } from "@/types/field-service";

interface EquipmentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  equipment?: CustomerEquipment | null;
  /** Cliente fixo, quando o cadastro é aberto pela ficha do contato. */
  client?: { id: string; name: string } | null;
  onSaved: () => void;
}

type FormState = Required<Omit<EquipmentInput, "status">> & { clientName: string; status: EquipmentStatus };

function initial(equipment?: CustomerEquipment | null, client?: { id: string; name: string } | null): FormState {
  return {
    clientId: equipment?.clientId ?? client?.id ?? "",
    clientName: equipment?.clientName ?? client?.name ?? "",
    name: equipment?.name ?? "",
    type: equipment?.type ?? "",
    brand: equipment?.brand ?? "",
    model: equipment?.model ?? "",
    serialNumber: equipment?.serialNumber ?? "",
    capacity: equipment?.capacity ?? "",
    location: equipment?.location ?? "",
    installedAt: equipment?.installedAt ?? "",
    warrantyUntil: equipment?.warrantyUntil ?? "",
    notes: equipment?.notes ?? "",
    status: equipment?.status ?? "active",
  };
}

const TEXT_FIELDS: { key: "brand" | "model" | "serialNumber" | "capacity" | "location"; label: string }[] = [
  { key: "brand", label: "Marca" },
  { key: "model", label: "Modelo" },
  { key: "serialNumber", label: "Número de série" },
  { key: "capacity", label: "Capacidade ou potência" },
  { key: "location", label: "Local" },
];

/** O aparelho instalado no cliente: o que é, onde está e até quando tem garantia. */
export function EquipmentFormDialog({ open, onOpenChange, equipment, client, onSaved }: EquipmentFormDialogProps) {
  const niche = useCurrentNicheConfig();
  const [form, setForm] = React.useState<FormState>(() => initial(equipment, client));
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (open) setForm(initial(equipment, client));
  }, [open, equipment, client]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));
  const valid = Boolean(form.clientId) && form.name.trim().length >= 2;
  const typeListId = "equipment-type-suggestions";

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!valid) return;
    setSaving(true);
    const clean = (value: string | null) => (value && value.trim() ? value.trim() : null);
    const input: EquipmentInput = {
      clientId: form.clientId,
      name: form.name.trim(),
      type: clean(form.type),
      brand: clean(form.brand),
      model: clean(form.model),
      serialNumber: clean(form.serialNumber),
      capacity: clean(form.capacity),
      location: clean(form.location),
      installedAt: form.installedAt || null,
      warrantyUntil: form.warrantyUntil || null,
      notes: clean(form.notes),
      status: form.status,
    };
    try {
      if (equipment) await FieldService.updateEquipment(equipment.id, input);
      else await FieldService.createEquipment(input);
      toast.success(equipment ? "Equipamento atualizado." : "Equipamento cadastrado.");
      onOpenChange(false);
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar o equipamento.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="sm:max-w-2xl" onInteractOutside={keepOpenOnOutsideClick}>
        <DialogHeader>
          <DialogTitle>{equipment ? "Editar equipamento" : "Novo equipamento"}</DialogTitle>
          <DialogDescription>
            Cada aparelho do cliente, com garantia e histórico de atendimentos.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {!client && (
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
                  }))
                }
              />
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="equipmentName">Nome</Label>
              <Input
                id="equipmentName"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder={niche.fieldService.equipmentNamePlaceholder}
                maxLength={120}
                disabled={saving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="equipmentType">Tipo</Label>
              <Input
                id="equipmentType"
                list={typeListId}
                value={form.type ?? ""}
                onChange={(e) => set("type", e.target.value)}
                maxLength={80}
                disabled={saving}
              />
              <datalist id={typeListId}>
                {niche.fieldService.equipmentTypes.map((type) => (
                  <option key={type} value={type} />
                ))}
              </datalist>
            </div>
            {TEXT_FIELDS.map((field) => (
              <div key={field.key} className="space-y-2">
                <Label htmlFor={`equipment-${field.key}`}>{field.label}</Label>
                <Input
                  id={`equipment-${field.key}`}
                  value={form[field.key] ?? ""}
                  onChange={(e) => set(field.key, e.target.value)}
                  maxLength={field.key === "location" ? 120 : 80}
                  disabled={saving}
                />
              </div>
            ))}
            <div className="space-y-2">
              <Label htmlFor="equipmentStatus">Situação</Label>
              <Select
                id="equipmentStatus"
                value={form.status}
                onChange={(e) => set("status", e.target.value as EquipmentStatus)}
                disableSort
                disabled={saving}
              >
                <option value="active">Em uso</option>
                <option value="inactive">Desativado</option>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="equipmentInstalledAt">Instalado em</Label>
              <DatePicker
                id="equipmentInstalledAt"
                name="equipmentInstalledAt"
                value={form.installedAt ?? ""}
                onChange={(e) => set("installedAt", e.target.value)}
                disabled={saving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="equipmentWarranty">Garantia até</Label>
              <DatePicker
                id="equipmentWarranty"
                name="equipmentWarranty"
                value={form.warrantyUntil ?? ""}
                onChange={(e) => set("warrantyUntil", e.target.value)}
                disabled={saving}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="equipmentNotes">Observações</Label>
            <Textarea
              id="equipmentNotes"
              value={form.notes ?? ""}
              onChange={(e) => set("notes", e.target.value)}
              rows={3}
              maxLength={2000}
              disabled={saving}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving || !valid}>
              {saving && <Loader size="sm" variant="button" className="mr-2" />}
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
