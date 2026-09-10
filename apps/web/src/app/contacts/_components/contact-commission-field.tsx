"use client";

import * as React from "react";
import { FormItem } from "@/components/ui/form-components";
import { Input } from "@/components/ui/input";
import { isCommissionPartner } from "@/lib/contacts/commission-partner";
import type { ClientType } from "@/services/client-service";

interface ContactCommissionFieldProps {
  /** Só vendedor e arquiteto recebem comissão; para os outros não renderiza. */
  types: ClientType[];
  /** `null` = sem percentual padrão; o valor é digitado na proposta. */
  value: number | null;
  onChange: (value: number | null) => void;
}

/**
 * Comissão padrão do parceiro, ao lado do CPF/CNPJ no passo do contato.
 *
 * É um `FormItem` comum, irmão do documento na mesma linha: alinha rótulo,
 * campo e área de erro com o vizinho, que é o que faltava quando ela era um
 * `DecimalInput` de 32px centralizado no meio do formulário.
 *
 * Fica no passo 1, e não no dos dados fiscais, por duas razões: ela **não é
 * dado fiscal** (não entra em campo nenhum da NF-e; alimenta
 * `Proposal.commissions[]` e vira despesa no financeiro), e no celular a trilha
 * mostra só o TÍTULO do passo, então debaixo de "Dados Fiscais" ela ficava
 * invisível para quem acabou de marcar Vendedor.
 *
 * Compartilhado pelo cadastro e pela edição, como o seletor de tipos: uma
 * segunda cópia divergiria na primeira mudança.
 */
export function ContactCommissionField({
  types,
  value,
  onChange,
}: ContactCommissionFieldProps) {
  if (!isCommissionPartner({ types })) return null;

  return (
    <FormItem
      label="Comissão padrão"
      htmlFor="commissionPercentage"
      hint="Pode mudar por proposta"
    >
      <Input
        id="commissionPercentage"
        name="commissionPercentage"
        type="number"
        min={0}
        max={100}
        step="0.01"
        placeholder="0"
        value={value ?? ""}
        onChange={(e) => {
          // Em branco é `null`, nunca 0: zero é um percentual válido, e deixar
          // passar faria a proposta nascer com uma comissão que ninguém
          // escolheu.
          const raw = e.target.value;
          onChange(raw === "" ? null : Number(raw));
        }}
        suffix={<span className="text-sm">%</span>}
      />
    </FormItem>
  );
}
