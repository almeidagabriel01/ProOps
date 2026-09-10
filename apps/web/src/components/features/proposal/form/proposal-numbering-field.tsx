"use client";

import * as React from "react";
import { FormItem, FormStatic } from "@/components/ui/form-components";
import { Select } from "@/components/ui/select";
import { useProposalNumbering } from "@/hooks/useProposalNumbering";

interface ProposalNumberingFieldProps {
  /** Código já alocado. Presente só em proposta que já foi criada. */
  proposalCode?: string | null;
  praca?: string | null;
  isReadOnly?: boolean;
  onPracaChange?: (praca: string | null) => void;
}

/**
 * Código da proposta e escolha da praça.
 *
 * Some por completo quando a empresa não liga a numeração, que é o padrão: o
 * formato de um cliente não pode virar campo obrigatório do formulário de
 * todo mundo.
 *
 * Em proposta já criada mostra o código como texto, nunca como campo. Ele é um
 * número de documento: mudar depois de o cliente ter recebido o PDF faria a
 * mesma proposta ter dois identificadores.
 */
export function ProposalNumberingField({
  proposalCode,
  praca,
  isReadOnly,
  onPracaChange,
}: ProposalNumberingFieldProps) {
  const { config } = useProposalNumbering();

  if (proposalCode) {
    return <FormStatic label="Código da Proposta" value={proposalCode} />;
  }

  // Sem numeração ligada, ou com numeração sem praça nenhuma configurada, não
  // há o que perguntar: o backend monta o código sozinho.
  if (!config?.enabled || config.pracas.length === 0) return null;

  if (isReadOnly) {
    return <FormStatic label="Praça" value={praca || undefined} />;
  }

  const atual = praca ?? config.defaultPraca;

  return (
    <FormItem
      label="Praça"
      htmlFor="proposalPraca"
      hint="Entra no código"
    >
      <Select
        id="proposalPraca"
        name="proposalPraca"
        value={atual ?? ""}
        onChange={(e) => onPracaChange?.(e.target.value || null)}
        disableSort
      >
        <option value="">Nenhuma</option>
        {config.pracas.map((sigla) => (
          <option key={sigla} value={sigla}>
            {sigla}
          </option>
        ))}
      </Select>
    </FormItem>
  );
}
