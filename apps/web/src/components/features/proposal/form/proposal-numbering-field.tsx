"use client";

import * as React from "react";
import { FormItem, FormStatic } from "@/components/ui/form-components";
import { Select } from "@/components/ui/select";
import type { ProposalNumberingConfig } from "@/services/proposal-numbering-service";

interface ProposalNumberingFieldProps {
  /**
   * Configuração da empresa. Vem de fora, e não de um `useProposalNumbering()`
   * aqui dentro, porque quem monta o grid precisa saber ANTES se este campo vai
   * aparecer: escondido, ele deixaria um buraco de meia linha ao lado do
   * vizinho. Buscar aqui também renderia duas chamadas à API por formulário.
   */
  config: ProposalNumberingConfig | null;
  /** Código já alocado. Presente só em proposta que já foi criada. */
  proposalCode?: string | null;
  praca?: string | null;
  isReadOnly?: boolean;
  /**
   * A praca so e escolhida na CRIACAO: ela entra no codigo, e o codigo e
   * imutavel depois de alocado. Numa proposta que ja existe, oferecer o
   * seletor seria pior que nao oferecer nada — `proposalPraca` esta fora da
   * allowlist do `PUT`, entao a escolha seria aceita na tela e descartada.
   */
  canChoosePraca?: boolean;
  onPracaChange?: (praca: string | null) => void;
}

/**
 * Decide se há numeração para mostrar nesta proposta.
 *
 * Exportada porque a seção que monta o grid faz a MESMA pergunta para escolher
 * o número de colunas. Duas respostas diferentes para isso é o que produz o
 * campo órfão numa linha vazia.
 */
export function hasProposalNumbering(
  config: ProposalNumberingConfig | null,
  proposalCode?: string | null,
  canChoosePraca = true,
): boolean {
  if (proposalCode) return true;
  if (!canChoosePraca) return false;
  return Boolean(config?.enabled) && (config?.pracas.length ?? 0) > 0;
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
  config,
  proposalCode,
  praca,
  isReadOnly,
  canChoosePraca = true,
  onPracaChange,
}: ProposalNumberingFieldProps) {
  if (proposalCode) {
    // Na visão somente leitura os vizinhos também são `FormStatic`, então ele
    // alinha. Na de edição o vizinho é um `FormItem` (o "Válida até"), que
    // espaça rótulo e campo de outro jeito: usar `FormStatic` ali deixaria as
    // duas caixas em alturas diferentes na mesma linha.
    if (isReadOnly) {
      return <FormStatic label="Código da Proposta" value={proposalCode} />;
    }

    return (
      <FormItem label="Código da Proposta" hint="Gerado ao criar">
        <div className="h-12 px-4 rounded-xl bg-muted/40 border border-border/30 flex items-center text-sm font-mono">
          {proposalCode}
        </div>
      </FormItem>
    );
  }

  if (!hasProposalNumbering(config, proposalCode, canChoosePraca)) return null;

  if (isReadOnly) {
    return <FormStatic label="Praça" value={praca || undefined} />;
  }

  const atual = praca ?? config?.defaultPraca;

  return (
    <FormItem label="Praça" htmlFor="proposalPraca" hint="Entra no código">
      <Select
        id="proposalPraca"
        name="proposalPraca"
        value={atual ?? ""}
        onChange={(e) => onPracaChange?.(e.target.value || null)}
        disableSort
      >
        <option value="">Nenhuma</option>
        {(config?.pracas ?? []).map((sigla) => (
          <option key={sigla} value={sigla}>
            {sigla}
          </option>
        ))}
      </Select>
    </FormItem>
  );
}
