"use client";

import * as React from "react";
import { Percent } from "lucide-react";
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
 * Comissão padrão do parceiro, num bloco próprio.
 *
 * Vive fora do seletor de tipos e fora do bloco fiscal de propósito, mesmo
 * dividindo o passo com este último: comissão **não é dado fiscal**. Ela não
 * entra em campo nenhum da NF-e, alimenta `Proposal.commissions[]` e vira
 * despesa no financeiro. Sem cabeçalho próprio ela seria lida como mais um
 * campo da nota.
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

  // A borda separa do bloco fiscal, que vem logo abaixo no mesmo passo.
  return (
    <div className="space-y-5 pb-6 border-b border-border/50">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-linear-to-br from-primary/15 to-primary/5 flex items-center justify-center">
          <Percent className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h3 className="text-lg font-semibold">Comissão</h3>
          <p className="text-sm text-muted-foreground">
            Percentual padrão deste parceiro, sugerido ao montar a proposta
          </p>
        </div>
      </div>

      <div className="max-w-[220px]">
        <div className="flex items-center justify-between h-5 mb-4">
          <label
            htmlFor="commissionPercentage"
            className="text-sm font-medium text-foreground leading-5"
          >
            Comissão padrão
          </label>
        </div>
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
            // Em branco é `null`, nunca 0: zero é um percentual válido, e
            // deixar passar faria a proposta nascer com uma comissão que
            // ninguém escolheu.
            const raw = e.target.value;
            onChange(raw === "" ? null : Number(raw));
          }}
          suffix={<span className="text-sm">%</span>}
        />
        <p className="text-xs text-muted-foreground mt-2">
          Pode ser alterado em cada proposta.
        </p>
      </div>
    </div>
  );
}
