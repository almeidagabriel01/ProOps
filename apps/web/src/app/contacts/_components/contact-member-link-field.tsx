"use client";

import * as React from "react";
import { FormItem } from "@/components/ui/form-components";
import { Select } from "@/components/ui/select";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { SalesGoalsService, type SalesGoalsPerson } from "@/services/sales-goals-service";
import type { ClientType } from "@/services/client-service";
import { isCommissionPartner } from "@/lib/contacts/commission-partner";
import { usePermissions } from "@/providers/permissions-provider";

/**
 * Se o campo aparece. A página usa isto para decidir o layout (ao lado do
 * nome, dividindo a linha, ou o nome ocupando a linha toda): o campo não pode
 * sumir depois de a linha já ter sido dividida.
 */
export function showsMemberLink(types: ClientType[], hasSalesGoals: boolean): boolean {
  return hasSalesGoals && isCommissionPartner({ types });
}

interface ContactMemberLinkFieldProps {
  types: ClientType[];
  value: string | null;
  onChange: (memberId: string | null) => void;
}

/**
 * "É da equipe?": liga o contato parceiro (vendedor ou arquiteto) a um membro.
 * Ligado, ele acompanha as comissões dele no Dashboard ("Minhas comissões"); e,
 * se for vendedor, a comissão entra sozinha na proposta quando ele é o
 * responsável pela venda.
 *
 * Só nos planos com metas, onde existe o responsável pela venda. O parceiro
 * externo fica em "Não".
 *
 * Só o dono e os administradores ligam: um membro que se ligasse a um
 * parceiro passaria a ler as comissões dele (o backend recusa).
 */
export function ContactMemberLinkField({ types, value, onChange }: ContactMemberLinkFieldProps) {
  const { hasSalesGoals } = usePlanLimits();
  const { isMaster } = usePermissions();
  const visible = showsMemberLink(types, hasSalesGoals);
  const [people, setPeople] = React.useState<SalesGoalsPerson[]>([]);

  React.useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    SalesGoalsService.sellers()
      .then((list) => {
        if (!cancelled) setPeople(list);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [visible]);

  if (!visible) return null;

  return (
    // Sem dica no cabeçalho: a linha do rótulo tem altura fixa e divide a
    // largura com a dica, e qualquer texto ali quebrava "É da equipe?" em duas
    // linhas. A explicação vai embaixo do campo.
    <FormItem label="É da equipe?" htmlFor="linkedMemberId">
      <div className="space-y-2">
        <Select
          id="linkedMemberId"
          aria-label="É da equipe?"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value || null)}
          disabled={people.length === 0 || !isMaster}
          disableSort
        >
          <option value="">Não, é parceiro externo</option>
          {people.map((person) => (
            <option key={person.id} value={person.id}>
              Sim: {person.name}
            </option>
          ))}
        </Select>
        <p className="text-xs text-muted-foreground">
          Ligado a um membro, ele vê as próprias comissões no Dashboard. Se for vendedor, a
          comissão entra sozinha na proposta quando ele é o responsável pela venda.
        </p>
      </div>
    </FormItem>
  );
}
