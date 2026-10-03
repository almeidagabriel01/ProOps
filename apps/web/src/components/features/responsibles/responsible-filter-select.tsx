"use client";

import * as React from "react";
import { Select } from "@/components/ui/select";
import { useContactResponsibles } from "@/hooks/use-contact-responsibles";
import { COMMISSION_ROLE_LABELS, primaryCommissionRole } from "@/lib/contacts/commission-partner";
import { MY_RESPONSIBLE_FILTER } from "@/lib/contacts/responsible-filter";

interface ResponsibleFilterSelectProps {
  /** Valor do endereço: "", `eu`, `m:<uid>` ou `p:<contato>`. */
  value: string;
  onChange: (value: string) => void;
  /** "Meus clientes", "Minhas propostas". */
  mineLabel: string;
  /** Parceiros externos também como opção (a lista de propostas filtra só pela equipe). */
  includePartners?: boolean;
  className?: string;
}

/** O filtro "Responsável" das listas: todos, os meus, uma pessoa da equipe ou um parceiro. */
export function ResponsibleFilterSelect({
  value,
  onChange,
  mineLabel,
  includePartners,
  className,
}: ResponsibleFilterSelectProps) {
  const { people, partners } = useContactResponsibles();

  return (
    <div className={className}>
      <Select
        aria-label="Filtrar por responsável"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disableSort
      >
        <option value="">Todos os responsáveis</option>
        <option value={MY_RESPONSIBLE_FILTER}>{mineLabel}</option>
        {people.map((person) => (
          <option key={`m-${person.id}`} value={`m:${person.id}`}>
            {person.name}
          </option>
        ))}
        {(includePartners ? partners : []).map((partner) => {
          const role = primaryCommissionRole(partner);
          return (
            <option key={`p-${partner.id}`} value={`p:${partner.id}`}>
              {role ? `${partner.name} (${COMMISSION_ROLE_LABELS[role].toLowerCase()})` : partner.name}
            </option>
          );
        })}
      </Select>
    </div>
  );
}
