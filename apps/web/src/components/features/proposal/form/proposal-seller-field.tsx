"use client";

import * as React from "react";
import { FormItem } from "@/components/ui/form-components";
import { Select } from "@/components/ui/select";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { SalesGoalsService, type SalesGoalsPerson } from "@/services/sales-goals-service";

interface ProposalSellerFieldProps {
  /** `undefined` enquanto a proposta nova ainda não escolheu: vale quem cria. */
  value: string | null | undefined;
  currentUserId: string | null | undefined;
  onChange: (sellerId: string | null) => void;
  disabled?: boolean;
}

/**
 * Quem vendeu a proposta, para as metas de vendas. Chamado "Responsável pela
 * venda", e não "Vendedor", porque o passo de pagamento já tem "vendedor" nas
 * comissões, que é outra coisa: um contato parceiro que recebe comissão.
 *
 * Só aparece nos planos com metas; nos outros, o backend grava quem criou e
 * ninguém precisa escolher.
 */
export function ProposalSellerField({ value, currentUserId, onChange, disabled }: ProposalSellerFieldProps) {
  const { hasSalesGoals } = usePlanLimits();
  const [people, setPeople] = React.useState<SalesGoalsPerson[]>([]);

  React.useEffect(() => {
    if (!hasSalesGoals) return;
    let cancelled = false;
    SalesGoalsService.sellers()
      .then((list) => {
        if (!cancelled) setPeople(list);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [hasSalesGoals]);

  if (!hasSalesGoals) return null;

  const selected = value === undefined ? (currentUserId ?? "") : (value ?? "");

  return (
    // Mesmo `FormItem` dos campos vizinhos: fica ao lado do Endereço, e só
    // alinha se rótulo e campo tiverem a mesma altura dos dele. Enquanto a
    // equipe carrega o campo fica desabilitado, e não some: sumir desmontaria
    // a linha que já foi dividida com o Endereço.
    <FormItem label="Responsável pela venda" htmlFor="proposal-seller">
      <div className="space-y-2">
        <Select
          id="proposal-seller"
          aria-label="Responsável pela venda"
          value={selected}
          onChange={(e) => onChange(e.target.value || null)}
          disabled={disabled || people.length === 0}
          disableSort
        >
          <option value="">Sem responsável</option>
          {people.map((person) => (
            <option key={person.id} value={person.id}>
              {person.id === currentUserId ? `${person.name} (você)` : person.name}
            </option>
          ))}
        </Select>
        <p className="text-xs text-muted-foreground">
          Conta na meta desta pessoa. Não é a comissão, que fica no passo de pagamento.
        </p>
      </div>
    </FormItem>
  );
}
