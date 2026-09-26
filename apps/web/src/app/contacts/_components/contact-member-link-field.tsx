"use client";

import * as React from "react";
import { FormItem } from "@/components/ui/form-components";
import { Select } from "@/components/ui/select";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { SalesGoalsService, type SalesGoalsPerson } from "@/services/sales-goals-service";
import type { ClientType } from "@/services/client-service";

interface ContactMemberLinkFieldProps {
  types: ClientType[];
  value: string | null;
  onChange: (memberId: string | null) => void;
}

/**
 * "É da equipe?": liga o contato vendedor a um membro. É o que faz a comissão
 * dele entrar sozinha na proposta quando ele é o responsável pela venda.
 *
 * Só para vendedor (o arquiteto é parceiro externo) e só nos planos com metas,
 * onde existe o responsável pela venda. O vendedor externo fica em "Não".
 */
export function ContactMemberLinkField({ types, value, onChange }: ContactMemberLinkFieldProps) {
  const { hasSalesGoals } = usePlanLimits();
  const isSeller = types.includes("vendedor");
  const [people, setPeople] = React.useState<SalesGoalsPerson[]>([]);

  React.useEffect(() => {
    if (!hasSalesGoals || !isSeller) return;
    let cancelled = false;
    SalesGoalsService.sellers()
      .then((list) => {
        if (!cancelled) setPeople(list);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [hasSalesGoals, isSeller]);

  if (!hasSalesGoals || !isSeller || people.length === 0) return null;

  return (
    <FormItem
      label="É da equipe?"
      htmlFor="linkedMemberId"
      hint="Ligado a um membro, a comissão entra sozinha quando ele é o responsável pela venda"
    >
      <Select
        id="linkedMemberId"
        aria-label="É da equipe?"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        disableSort
      >
        <option value="">Não, é vendedor externo</option>
        {people.map((person) => (
          <option key={person.id} value={person.id}>
            Sim: {person.name}
          </option>
        ))}
      </Select>
    </FormItem>
  );
}
