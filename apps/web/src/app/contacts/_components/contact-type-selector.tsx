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
}

/**
 * Seleção múltipla do tipo do contato, compartilhada pelo cadastro e pela
 * edição. As duas telas mantinham cópias independentes deste bloco, e um tipo
 * novo entraria só numa delas.
 *
 * A comissão do parceiro saiu daqui e virou `ContactCommissionField`, no passo
 * seguinte: ela é consequência do tipo, mas não é um dado de contato, e no meio
 * do cadastro lia-se como se fosse.
 */
export function ContactTypeSelector({
  types,
  onTypesChange,
}: ContactTypeSelectorProps) {
  const toggle = (value: ClientType) => {
    const next = types.includes(value)
      ? types.filter((t) => t !== value)
      : [...types, value];
    // Pelo menos um tipo sempre selecionado.
    onTypesChange(next.length > 0 ? next : [value]);
  };

  return (
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
  );
}
