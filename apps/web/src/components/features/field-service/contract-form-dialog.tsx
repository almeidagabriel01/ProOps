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
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader } from "@/components/ui/loader";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ClientSelect } from "@/components/features/client-select";
import { ItemsEditor } from "@/components/features/field-service/items-editor";
import { useTenant } from "@/providers/tenant-provider";
import { useCurrentNicheConfig } from "@/hooks/useCurrentNicheConfig";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { toast } from "@/lib/toast";
import { keepOpenOnOutsideClick } from "@/lib/field-service/service-orders";
import {
  BILLING_DAYS,
  CONTRACT_TYPE_LABELS,
  VISIT_INTERVAL_OPTIONS,
} from "@/lib/field-service/contracts";
import { FieldService } from "@/services/field-service-service";
import { WalletService } from "@/services/wallet-service";
import type { Wallet } from "@/types";
import type {
  ContractLine,
  ContractType,
  CustomerEquipment,
  ServiceContract,
  ServiceContractInput,
  ServiceOrderItem,
} from "@/types/field-service";

interface ContractFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contract?: ServiceContract | null;
  onSaved: (id: string) => void;
}

interface FormState {
  clientId: string;
  clientName: string;
  title: string;
  type: ContractType;
  items: ServiceOrderItem[];
  billingDay: number;
  wallet: string;
  issueNfse: boolean;
  endDate: string;
  equipmentIds: string[];
  visitsEnabled: boolean;
  intervalMonths: number;
  technicianId: string;
  checklistText: string;
  notes: string;
}

function toItems(lines: ContractLine[]): ServiceOrderItem[] {
  return lines.map((line) => ({ ...line, fromStock: false }));
}

function toLines(items: ServiceOrderItem[]): ContractLine[] {
  return items.map(({ id, kind, refId, name, quantity, unitPrice }) => ({
    id,
    kind,
    refId,
    name: name.trim() || "Item",
    quantity,
    unitPrice,
  }));
}

function initialState(
  contract: ServiceContract | null | undefined,
  defaults: { type: ContractType; checklist: string[] },
): FormState {
  return {
    clientId: contract?.clientId ?? "",
    clientName: contract?.clientName ?? "",
    title: contract?.title ?? "",
    type: contract?.type ?? defaults.type,
    items: toItems(contract?.lines ?? []),
    billingDay: contract?.billingDay ?? 10,
    wallet: contract?.wallet ?? "",
    issueNfse: contract?.issueNfse ?? false,
    endDate: contract?.endDate ?? "",
    equipmentIds: contract?.equipmentIds ?? [],
    visitsEnabled: contract?.visitPlan.enabled ?? false,
    intervalMonths: contract?.visitPlan.intervalMonths ?? 3,
    technicianId: contract?.visitPlan.technicianId ?? "",
    checklistText: (contract ? contract.visitPlan.checklist : defaults.checklist).join("\n"),
    notes: contract?.notes ?? "",
  };
}

/**
 * O contrato de manutenção: o que se cobra todo mês, em que dia, em qual
 * carteira, e as visitas preventivas que ele promete. Nasce rascunho; a
 * cobrança começa ao ativar, na tela do contrato.
 */
export function ContractFormDialog({ open, onOpenChange, contract, onSaved }: ContractFormDialogProps) {
  const { tenant } = useTenant();
  const niche = useCurrentNicheConfig();
  const { hasFiscal } = usePlanLimits();
  const defaults = React.useMemo(
    () => ({ type: niche.fieldService.defaultContractType, checklist: niche.fieldService.preventiveChecklist }),
    [niche.fieldService.defaultContractType, niche.fieldService.preventiveChecklist],
  );
  const [form, setForm] = React.useState<FormState>(() => initialState(contract, defaults));
  const [saving, setSaving] = React.useState(false);
  const [wallets, setWallets] = React.useState<Wallet[]>([]);
  const [equipment, setEquipment] = React.useState<CustomerEquipment[]>([]);
  const [technicians, setTechnicians] = React.useState<{ id: string; name: string }[]>([]);

  React.useEffect(() => {
    if (open) setForm(initialState(contract, defaults));
  }, [open, contract, defaults]);

  React.useEffect(() => {
    if (!open || !tenant?.id) return;
    WalletService.getWallets(tenant.id)
      .then((list) => {
        const active = list.filter((w) => w.status !== "archived");
        setWallets(active);
        setForm((f) => (f.wallet ? f : { ...f, wallet: (active.find((w) => w.isDefault) ?? active[0])?.id ?? "" }));
      })
      .catch(() => setWallets([]));
    FieldService.listTechnicians()
      .then(({ technicians: list }) => setTechnicians(list))
      .catch(() => setTechnicians([]));
  }, [open, tenant?.id]);

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
  const clientLocked = Boolean(contract && contract.status !== "draft");
  const valid =
    Boolean(form.clientId) && form.title.trim().length >= 2 && form.items.length > 0 && Boolean(form.wallet);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!valid) return;
    setSaving(true);
    const input: ServiceContractInput = {
      clientId: form.clientId,
      title: form.title.trim(),
      type: form.type,
      lines: toLines(form.items),
      billingDay: form.billingDay,
      wallet: form.wallet,
      issueNfse: form.issueNfse,
      equipmentIds: form.equipmentIds,
      visitPlan: {
        enabled: form.visitsEnabled,
        intervalMonths: form.intervalMonths,
        technicianId: form.technicianId || null,
        checklist: form.checklistText
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean)
          .slice(0, 60),
      },
      notes: form.notes.trim() || null,
      endDate: form.endDate || null,
    };
    try {
      if (contract) {
        const { clientId, ...rest } = input;
        await FieldService.updateContract(contract.id, clientLocked ? rest : { clientId, ...rest });
        toast.success("Contrato atualizado.");
        onOpenChange(false);
        onSaved(contract.id);
      } else {
        const created = await FieldService.createContract(input);
        toast.success(`Contrato ${created.code} criado como rascunho.`);
        onOpenChange(false);
        onSaved(created.id);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar o contrato.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="sm:max-w-4xl" onInteractOutside={keepOpenOnOutsideClick}>
        <DialogHeader>
          <DialogTitle>{contract ? `Editar ${contract.code}` : "Novo contrato"}</DialogTitle>
          <DialogDescription>
            A mensalidade que o cliente paga todo mês e as visitas que o contrato garante. A cobrança começa quando
            você ativar o contrato.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>Cliente</Label>
              <ClientSelect
                value={form.clientName}
                clientId={form.clientId || undefined}
                disabled={saving || clientLocked}
                onChange={(data) =>
                  setForm((f) => ({
                    ...f,
                    clientId: data.isNew ? "" : (data.clientId ?? ""),
                    clientName: data.clientName,
                    equipmentIds: [],
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contractTitle">Nome do contrato</Label>
              <Input
                id="contractTitle"
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
                placeholder={niche.fieldService.contractTitlePlaceholder}
                maxLength={160}
                disabled={saving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contractType">Tipo</Label>
              <Select
                id="contractType"
                value={form.type}
                onChange={(e) => set("type", e.target.value as ContractType)}
                disableSort
                disabled={saving}
              >
                {(Object.keys(CONTRACT_TYPE_LABELS) as ContractType[]).map((type) => (
                  <option key={type} value={type}>
                    {CONTRACT_TYPE_LABELS[type]}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>O que é cobrado todo mês</Label>
            <ItemsEditor
              items={form.items}
              onChange={(items) => set("items", items)}
              disabled={saving}
              stock={false}
              emptyText="Nenhum item na mensalidade."
              totalLabel="Mensalidade"
              totalSuffix="/mês"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="contractBillingDay">Dia do vencimento</Label>
              <Select
                id="contractBillingDay"
                value={String(form.billingDay)}
                onChange={(e) => set("billingDay", Number(e.target.value))}
                disableSort
                disabled={saving}
              >
                {BILLING_DAYS.map((day) => (
                  <option key={day} value={day}>
                    Todo dia {day}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="contractWallet">Carteira</Label>
              <Select
                id="contractWallet"
                value={form.wallet}
                onChange={(e) => set("wallet", e.target.value)}
                disabled={saving}
              >
                {wallets.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="contractEndDate">Fim do contrato (opcional)</Label>
              <DatePicker
                id="contractEndDate"
                name="contractEndDate"
                value={form.endDate}
                onChange={(e) => set("endDate", e.target.value)}
                disabled={saving}
              />
            </div>
          </div>

          <div className="flex items-start justify-between gap-4 rounded-xl border p-4">
            <div className="space-y-1">
              <Label htmlFor="contractNfse" className="font-medium">
                Emitir a nota de serviço quando a mensalidade for paga
              </Label>
              <p className="text-xs text-muted-foreground">
                {hasFiscal
                  ? "A nota sai das linhas de serviço do catálogo, no valor da mensalidade paga."
                  : "O seu plano não inclui notas fiscais."}
              </p>
            </div>
            <Switch
              id="contractNfse"
              checked={form.issueNfse}
              onCheckedChange={(checked) => set("issueNfse", checked)}
              disabled={saving || (!hasFiscal && !form.issueNfse)}
            />
          </div>

          <div className="space-y-4 rounded-xl border p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-1">
                <Label htmlFor="contractVisits" className="font-medium">
                  Visitas preventivas
                </Label>
                <p className="text-xs text-muted-foreground">
                  A OS da visita abre sozinha uma semana antes, com o técnico e o checklist abaixo.
                </p>
              </div>
              <Switch
                id="contractVisits"
                checked={form.visitsEnabled}
                onCheckedChange={(checked) => set("visitsEnabled", checked)}
                disabled={saving}
              />
            </div>
            {form.visitsEnabled && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="contractInterval">Frequência</Label>
                  <Select
                    id="contractInterval"
                    value={String(form.intervalMonths)}
                    onChange={(e) => set("intervalMonths", Number(e.target.value))}
                    disableSort
                    disabled={saving}
                  >
                    {VISIT_INTERVAL_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contractTechnician">Técnico</Label>
                  <Select
                    id="contractTechnician"
                    value={form.technicianId}
                    onChange={(e) => set("technicianId", e.target.value)}
                    disabled={saving}
                    placeholder="Sem técnico definido"
                  >
                    <option value="">Sem técnico definido</option>
                    {technicians.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="contractChecklist">Checklist da visita (um item por linha)</Label>
                  <Textarea
                    id="contractChecklist"
                    value={form.checklistText}
                    onChange={(e) => set("checklistText", e.target.value)}
                    rows={4}
                    maxLength={6000}
                    disabled={saving}
                  />
                </div>
              </div>
            )}
          </div>

          {form.clientId && equipment.length > 0 && (
            <div className="space-y-2">
              <Label>Equipamentos cobertos</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {equipment.map((item) => {
                  const checked = form.equipmentIds.includes(item.id);
                  return (
                    <label key={item.id} className="flex cursor-pointer items-start gap-2 rounded-lg border p-3 text-sm">
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
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="contractNotes">Observações</Label>
            <Textarea
              id="contractNotes"
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              rows={3}
              maxLength={4000}
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
