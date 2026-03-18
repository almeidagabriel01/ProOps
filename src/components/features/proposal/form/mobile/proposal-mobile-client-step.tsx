"use client";

import * as React from "react";
import {
  Building2,
  CalendarClock,
  FileText,
  Mail,
  MapPin,
  UserRound,
  Users,
} from "lucide-react";
import { Proposal } from "@/services/proposal-service";
import { ClientType } from "@/services/client-service";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { DatePicker } from "@/components/ui/date-picker";
import { Checkbox } from "@/components/ui/checkbox";
import { ClientSelect } from "@/components/features/client-select";
import {
  MobileFieldShell,
  MobileMetric,
  MobilePanel,
  formatDateLabel,
} from "./shared";

interface ProposalMobileClientStepProps {
  formData: Partial<Proposal>;
  selectedClientId?: string;
  errors: Record<string, string>;
  isNewClient: boolean;
  clientTypes: ClientType[];
  onClientTypesChange: (types: ClientType[]) => void;
  onFormChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => void;
  onClientChange: (data: {
    clientId?: string;
    clientName: string;
    clientEmail?: string;
    clientPhone?: string;
    clientAddress?: string;
    isNew: boolean;
  }) => void;
}

export function ProposalMobileClientStep({
  formData,
  selectedClientId,
  errors,
  isNewClient,
  clientTypes,
  onClientTypesChange,
  onFormChange,
  onClientChange,
}: ProposalMobileClientStepProps) {
  const filledFields = [
    formData.title,
    formData.clientName,
    formData.clientEmail,
    formData.clientPhone,
    formData.clientAddress,
    formData.validUntil,
  ].filter(Boolean).length;

  const handleTypeChange = (type: ClientType, checked: boolean) => {
    if (checked) {
      if (!clientTypes.includes(type)) {
        onClientTypesChange([...clientTypes, type]);
      }
      return;
    }

    const nextTypes = clientTypes.filter((value) => value !== type);
    if (nextTypes.length > 0) {
      onClientTypesChange(nextTypes);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <MobileMetric
          label="Andamento"
          value={`${filledFields}/6 campos`}
          hint="titulo, contato e validade sao obrigatorios"
          accent="sky"
        />
        <MobileMetric
          label="Validade"
          value={formatDateLabel(formData.validUntil)}
          hint="revisado no resumo antes de salvar"
          accent="amber"
        />
      </div>

      <MobilePanel
        eyebrow="Base da proposta"
        title="Identidade comercial"
        description="Defina o nome da proposta e o contato principal."
        icon={FileText}
        tone="accent"
      >
        <MobileFieldShell
          label="Titulo da proposta"
          required
          error={errors.title}
        >
          <Input
            id="title"
            name="title"
            value={formData.title || ""}
            onChange={onFormChange}
            placeholder="Ex: Automacao residencial - Casa Silva"
            icon={<FileText className="h-4 w-4" />}
            className={errors.title ? "border-destructive" : ""}
          />
        </MobileFieldShell>

        <MobileFieldShell
          label="Contato"
          required
          error={errors.clientName}
        >
          <ClientSelect
            value={formData.clientName || ""}
            clientId={selectedClientId}
            onChange={onClientChange}
            error={!!errors.clientName}
          />
        </MobileFieldShell>

        {isNewClient && formData.clientName ? (
          <div className="rounded-2xl border border-dashed border-primary/25 bg-primary/5 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Cadastro automatico
            </p>
            <p className="mt-1 text-sm text-foreground">
              Ao salvar, esse contato pode entrar na base como:
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              <label className="flex min-h-11 items-center gap-2 rounded-2xl border border-border/60 bg-background/80 px-3 py-2">
                <Checkbox
                  checked={clientTypes.includes("cliente")}
                  onCheckedChange={(checked) =>
                    handleTypeChange("cliente", checked === true)
                  }
                />
                <Users className="h-4 w-4 text-sky-600" />
                <span className="text-sm font-medium">Contato</span>
              </label>
              <label className="flex min-h-11 items-center gap-2 rounded-2xl border border-border/60 bg-background/80 px-3 py-2">
                <Checkbox
                  checked={clientTypes.includes("fornecedor")}
                  onCheckedChange={(checked) =>
                    handleTypeChange("fornecedor", checked === true)
                  }
                />
                <Building2 className="h-4 w-4 text-emerald-600" />
                <span className="text-sm font-medium">Fornecedor</span>
              </label>
            </div>
          </div>
        ) : null}
      </MobilePanel>

      <MobilePanel
        eyebrow="Contato direto"
        title="Canais e prazo"
        description="Dados de contato e validade da proposta."
        icon={CalendarClock}
      >
        <div className="grid gap-4">
          <MobileFieldShell label="Email" error={errors.clientEmail}>
            <Input
              id="clientEmail"
              name="clientEmail"
              type="email"
              value={formData.clientEmail || ""}
              onChange={onFormChange}
              placeholder="email@empresa.com"
              icon={<Mail className="h-4 w-4" />}
              className={errors.clientEmail ? "border-destructive" : ""}
            />
          </MobileFieldShell>

          <MobileFieldShell
            label="Telefone"
            required
            error={errors.clientPhone}
          >
            <PhoneInput
              id="clientPhone"
              name="clientPhone"
              value={formData.clientPhone || ""}
              onChange={onFormChange}
              placeholder="(11) 99999-9999"
              className={errors.clientPhone ? "border-destructive" : ""}
            />
          </MobileFieldShell>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <MobileFieldShell
              label="Valida ate"
              required
              error={errors.validUntil}
            >
              <DatePicker
                id="validUntil"
                name="validUntil"
                value={formData.validUntil ? formData.validUntil.split("T")[0] : ""}
                onChange={onFormChange}
                className={errors.validUntil ? "border-destructive" : ""}
              />
            </MobileFieldShell>

            <div className="rounded-2xl border border-border/60 bg-background/70 px-4 py-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <CalendarClock className="h-4 w-4 text-amber-600" />
                Prazo atual
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {formData.validUntil
                  ? `Documento valido ate ${formatDateLabel(formData.validUntil)}.`
                  : "Defina uma data para liberar a validacao da proposta."}
              </p>
            </div>
          </div>

          <MobileFieldShell label="Endereco">
            <Input
              id="clientAddress"
              name="clientAddress"
              value={formData.clientAddress || ""}
              onChange={onFormChange}
              placeholder="Rua, numero, complemento, cidade"
              icon={<MapPin className="h-4 w-4" />}
            />
          </MobileFieldShell>
        </div>
      </MobilePanel>

      <div className="rounded-[24px] border border-slate-200/80 bg-linear-to-br from-white via-slate-50 to-sky-50 px-4 py-4 text-slate-950 shadow-[0_24px_60px_-36px_rgba(14,165,233,0.35)] dark:border-white/10 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 dark:text-white dark:shadow-[0_24px_60px_-36px_rgba(15,23,42,0.85)]">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 dark:bg-white/10">
            <UserRound className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-300">
              Revisao rapida
            </p>
            <h3 className="text-base font-semibold [overflow-wrap:anywhere]">
              {formData.clientName || "Contato ainda nao definido"}
            </h3>
            <p className="mt-1 text-sm leading-5 text-slate-600 dark:text-slate-300 [overflow-wrap:anywhere]">
              {formData.clientEmail || "Sem email"}{" "}
              {formData.clientPhone ? `/ ${formData.clientPhone}` : ""}
            </p>
            <p className="mt-3 text-sm leading-5 text-slate-600 dark:text-slate-300 [overflow-wrap:anywhere]">
              {formData.clientAddress ||
                "Endereco ainda nao informado."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
