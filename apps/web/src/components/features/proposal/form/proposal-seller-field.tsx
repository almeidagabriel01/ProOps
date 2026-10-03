"use client";

import * as React from "react";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { ResponsibleMemberField } from "@/components/features/responsibles/responsibles-fields";
import type { TeamPerson } from "@/services/team-service";

interface ProposalSellerFieldProps {
  /** `undefined` enquanto a proposta nova ainda não escolheu: vale quem cria. */
  value: string | null | undefined;
  currentUserId: string | null | undefined;
  people: TeamPerson[];
  onChange: (sellerId: string | null) => void;
  disabled?: boolean;
}

/**
 * Quem da equipe cuida da venda. Chamado "Responsável pela venda", e não
 * "Vendedor", porque o passo de pagamento já tem "vendedor" nas comissões, que
 * é outra coisa: um contato parceiro que recebe comissão.
 *
 * Todos os planos: ao escolher o cliente, vem preenchido com o responsável do
 * contato. Nos planos com metas, conta também na meta da pessoa.
 *
 * Mesmo `FormItem` dos campos vizinhos: fica ao lado do Endereço, e só alinha
 * se rótulo e campo tiverem a mesma altura dos dele. Enquanto a equipe carrega
 * o campo fica desabilitado, e não some: sumir desmontaria a linha que já foi
 * dividida com o Endereço.
 */
export function ProposalSellerField({
  value,
  currentUserId,
  people,
  onChange,
  disabled,
}: ProposalSellerFieldProps) {
  const { hasSalesGoals } = usePlanLimits();
  const selected = value === undefined ? (currentUserId ?? null) : value;

  return (
    <ResponsibleMemberField
      id="proposal-seller"
      label="Responsável pela venda"
      value={selected}
      people={people}
      currentUserId={currentUserId}
      onChange={onChange}
      disabled={disabled}
      hint={
        hasSalesGoals
          ? "Conta na meta desta pessoa. Não é a comissão, que fica no passo de pagamento."
          : "Quem da equipe cuida desta venda."
      }
    />
  );
}
