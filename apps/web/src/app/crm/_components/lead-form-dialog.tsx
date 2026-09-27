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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { PhoneInput } from "@/components/ui/phone-input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { DatePicker } from "@/components/ui/date-picker";
import { toast } from "@/lib/toast";
import {
  LeadsService,
  type Lead,
  type LeadInput,
  type LeadSource,
} from "@/services/leads-service";
import { LEAD_SOURCE_LABELS } from "../_lib/leads";

interface LeadFormDialogProps {
  open: boolean;
  /** Com lead, edita; sem, cria. */
  lead?: Lead | null;
  onOpenChange: (open: boolean) => void;
  onSaved: (lead: Lead) => void;
}

interface FormState {
  name: string;
  phone: string;
  email: string;
  company: string;
  source: LeadSource;
  estimatedValue: string;
  nextAction: string;
  nextActionAt: string;
  notes: string;
}

function initialState(lead?: Lead | null): FormState {
  return {
    name: lead?.name ?? "",
    phone: lead?.phone ?? "",
    email: lead?.email ?? "",
    company: lead?.company ?? "",
    source: lead?.source ?? "indicacao",
    estimatedValue: lead?.estimatedValue != null ? String(lead.estimatedValue) : "",
    nextAction: lead?.nextAction ?? "",
    nextActionAt: lead?.nextActionAt ?? "",
    notes: lead?.notes ?? "",
  };
}

/** Monta o corpo da API a partir do formulário (campo vazio limpa na edição). */
export function buildLeadPayload(form: FormState, editing: boolean): LeadInput {
  const text = (v: string) => {
    const t = v.trim();
    return t ? t : editing ? "" : undefined;
  };
  const value = form.estimatedValue ? Number(form.estimatedValue) : null;
  return {
    name: form.name.trim(),
    phone: text(form.phone),
    email: text(form.email),
    company: text(form.company),
    source: form.source,
    estimatedValue: Number.isFinite(value) ? value : null,
    nextAction: text(form.nextAction),
    nextActionAt: form.nextActionAt || null,
    notes: text(form.notes),
  };
}

export function LeadFormDialog({ open, lead, onOpenChange, onSaved }: LeadFormDialogProps) {
  const [form, setForm] = React.useState<FormState>(() => initialState(lead));
  const [saving, setSaving] = React.useState(false);
  const editing = Boolean(lead);

  React.useEffect(() => {
    if (open) setForm(initialState(lead));
  }, [open, lead]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (form.name.trim().length < 2) {
      toast.error("Informe o nome do lead.");
      return;
    }
    setSaving(true);
    try {
      const payload = buildLeadPayload(form, editing);
      const saved = lead
        ? await LeadsService.update(lead.id, payload)
        : await LeadsService.create(payload);
      toast.success(editing ? "Lead atualizado." : "Lead criado.");
      onSaved(saved);
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar o lead.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar lead" : "Novo lead"}</DialogTitle>
          <DialogDescription>
            Quem pediu contato e ainda não tem proposta. Marque a próxima ação para não perder o timing.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="lead-name">Nome</Label>
            <Input
              id="lead-name"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Ex.: Carla Mendes"
              autoFocus
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="lead-phone">Telefone</Label>
              <PhoneInput
                id="lead-phone"
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lead-email">E-mail</Label>
              <Input
                id="lead-email"
                type="email"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="lead-company">Empresa ou escritório</Label>
              <Input
                id="lead-company"
                value={form.company}
                onChange={(e) => set("company", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lead-source">Origem</Label>
              <Select
                id="lead-source"
                value={form.source}
                onChange={(e) => set("source", e.target.value as LeadSource)}
                disableSort
              >
                {Object.entries(LEAD_SOURCE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="lead-value">Valor estimado</Label>
            <CurrencyInput
              id="lead-value"
              value={form.estimatedValue}
              onChange={(e) => set("estimatedValue", e.target.value)}
              placeholder="0,00"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
            <div className="space-y-1.5">
              <Label htmlFor="lead-next-action">Próxima ação</Label>
              <Input
                id="lead-next-action"
                value={form.nextAction}
                onChange={(e) => set("nextAction", e.target.value)}
                placeholder="Ex.: Agendar visita técnica"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lead-next-action-at">Quando</Label>
              <DatePicker
                id="lead-next-action-at"
                value={form.nextActionAt}
                onChange={(e) => set("nextActionAt", e.target.value)}
                className="sm:w-[180px]"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="lead-notes">Observações</Label>
            <Textarea
              id="lead-notes"
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Salvando..." : editing ? "Salvar" : "Criar lead"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
