"use client";

import * as React from "react";
import {
  Users,
  Building2,
  Handshake,
  DraftingCompass,
  type LucideIcon,
} from "lucide-react";
import { FormItem } from "@/components/ui/form-components";
import { DecimalInput } from "@/components/ui/decimal-input";
import { isCommissionPartner } from "@/lib/contacts/commission-partner";
import type { ClientType } from "@/services/client-service";

type TypeOption = {
  value: ClientType;
  label: string;
  description: string;
  icon: LucideIcon;
};

/**
 * Fornecedor deixou de ser descrito como "Vendedor de produtos/servicos": com
 * um tipo Vendedor ao lado, a descricao antiga apontava para o cadastro errado.
 */
const TYPE_OPTIONS: TypeOption[] = [
  {
    value: "cliente",
    label: "Cliente",
    description: "Comprador de produtos ou serviços",
    icon: Users,
  },
  {
    value: "fornecedor",
    label: "Fornecedor",
    description: "Fornece produtos ou serviços para você",
    icon: Building2,
  },
  {
    value: "vendedor",
    label: "Vendedor",
    description: "Recebe comissão sobre a venda",
    icon: Handshake,
  },
  {
    value: "arquiteto",
    label: "Arquiteto",
    description: "Indica o projeto e recebe comissão",
    icon: DraftingCompass,
  },
];

interface ContactTypeSelectorProps {
  types: ClientType[];
  onTypesChange: (types: ClientType[]) => void;
  /** `null` = sem percentual padrão; o valor é digitado na proposta. */
  commissionPercentage: number | null;
  onCommissionPercentageChange: (value: number | null) => void;
}

/**
 * Seleção múltipla do tipo do contato, compartilhada pelo cadastro e pela
 * edição. As duas telas mantinham cópias independentes deste bloco, e um tipo
 * novo entraria só numa delas.
 */
export function ContactTypeSelector({
  types,
  onTypesChange,
  commissionPercentage,
  onCommissionPercentageChange,
}: ContactTypeSelectorProps) {
  const toggle = (value: ClientType) => {
    const next = types.includes(value)
      ? types.filter((t) => t !== value)
      : [...types, value];
    // Pelo menos um tipo sempre selecionado.
    onTypesChange(next.length > 0 ? next : [value]);
  };

  const showCommission = isCommissionPartner({ types });

  return (
    <div className="flex flex-col gap-4">
      <FormItem
        label="Tipo de Cadastro (selecione um ou mais)"
        htmlFor="types"
        required
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {TYPE_OPTIONS.map((option) => {
            const selected = types.includes(option.value);
            const Icon = option.icon;
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={selected}
                onClick={() => toggle(option.value)}
                className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all cursor-pointer ${
                  selected
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                }`}
              >
                <div
                  className={`w-10 h-10 shrink-0 rounded-lg flex items-center justify-center ${
                    selected ? "bg-primary/10" : "bg-muted"
                  }`}
                >
                  <Icon
                    className={`w-5 h-5 ${selected ? "text-primary" : "text-muted-foreground"}`}
                  />
                </div>
                <div className="min-w-0 text-left">
                  <p className={`font-medium ${selected ? "text-primary" : ""}`}>
                    {option.label}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {option.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </FormItem>

      {showCommission && (
        <FormItem
          label="Comissão padrão (%)"
          htmlFor="commissionPercentage"
          hint="Pode ser alterada em cada proposta"
        >
          <DecimalInput
            id="commissionPercentage"
            name="commissionPercentage"
            value={commissionPercentage ?? 0}
            onChange={(value) =>
              onCommissionPercentageChange(value > 0 ? value : null)
            }
            className="text-base md:text-sm"
            aria-label="Comissão padrão em percentual"
          />
        </FormItem>
      )}
    </div>
  );
}
