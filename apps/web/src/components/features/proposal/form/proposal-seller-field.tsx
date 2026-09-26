"use client";

import * as React from "react";
import { Label } from "@/components/ui/label";
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
 * Quem vendeu a proposta, para as metas de vendas. Só aparece nos planos com
 * metas; nos outros, o backend grava quem criou e ninguém precisa escolher.
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

  if (!hasSalesGoals || people.length === 0) return null;

  const selected = value === undefined ? (currentUserId ?? "") : (value ?? "");

  return (
    <div className="space-y-1.5">
      <Label htmlFor="proposal-seller">Vendedor</Label>
      <Select
        id="proposal-seller"
        aria-label="Vendedor"
        value={selected}
        onChange={(e) => onChange(e.target.value || null)}
        disabled={disabled}
        disableSort
      >
        <option value="">Sem vendedor</option>
        {people.map((person) => (
          <option key={person.id} value={person.id}>
            {person.id === currentUserId ? `${person.name} (você)` : person.name}
          </option>
        ))}
      </Select>
      <p className="text-xs text-muted-foreground">
        A venda conta na meta de quem está aqui, no mês em que a proposta for aprovada.
      </p>
    </div>
  );
}
