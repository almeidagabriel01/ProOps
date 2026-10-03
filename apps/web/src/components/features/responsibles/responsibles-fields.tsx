"use client";

import * as React from "react";
import { X } from "lucide-react";
import { FormItem } from "@/components/ui/form-components";
import { Select } from "@/components/ui/select";
import { COMMISSION_ROLE_LABELS, primaryCommissionRole } from "@/lib/contacts/commission-partner";
import type { Client } from "@/services/client-service";
import type { TeamPerson } from "@/services/team-service";

/**
 * Quem cuida do cliente: um responsável da equipe e, se houver, parceiros
 * externos (vendedor ou arquiteto cadastrados como contato). O contato guarda
 * os dois, e a proposta os herda ao escolher o cliente.
 */

interface ResponsibleMemberFieldProps {
  id: string;
  label?: string;
  value: string | null;
  people: TeamPerson[];
  currentUserId?: string | null;
  onChange: (memberId: string | null) => void;
  disabled?: boolean;
  hint?: string;
}

export function ResponsibleMemberField({
  id,
  label = "Responsável da equipe",
  value,
  people,
  currentUserId,
  onChange,
  disabled,
  hint,
}: ResponsibleMemberFieldProps) {
  return (
    <FormItem label={label} htmlFor={id}>
      <div className="space-y-2">
        <Select
          id={id}
          aria-label={label}
          value={value ?? ""}
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
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
    </FormItem>
  );
}

interface PartnerContactsFieldProps {
  id: string;
  value: string[];
  partners: Client[];
  onChange: (partnerContactIds: string[]) => void;
  /** O próprio contato não aparece como parceiro dele mesmo. */
  excludeContactId?: string;
  disabled?: boolean;
  hint?: string;
}

function partnerLabel(partner: Client): string {
  const role = primaryCommissionRole(partner);
  return role ? `${partner.name} (${COMMISSION_ROLE_LABELS[role].toLowerCase()})` : partner.name;
}

export function PartnerContactsField({
  id,
  value,
  partners,
  onChange,
  excludeContactId,
  disabled,
  hint,
}: PartnerContactsFieldProps) {
  const byId = React.useMemo(() => new Map(partners.map((p) => [p.id, p])), [partners]);
  const available = partners.filter((p) => p.id !== excludeContactId && !value.includes(p.id));

  return (
    <FormItem label="Parceiros externos" htmlFor={id}>
      <div className="space-y-2">
        {value.length > 0 && (
          <ul className="flex flex-wrap gap-2" aria-label="Parceiros escolhidos">
            {value.map((partnerId) => {
              const partner = byId.get(partnerId);
              const name = partner ? partnerLabel(partner) : "Contato removido";
              return (
                <li
                  key={partnerId}
                  className="flex items-center gap-1 rounded-full border bg-muted/50 py-0.5 pl-3 pr-1 text-sm"
                >
                  <span>{name}</span>
                  {!disabled && (
                    <button
                      type="button"
                      onClick={() => onChange(value.filter((v) => v !== partnerId))}
                      className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                      aria-label={`Tirar ${partner?.name ?? "parceiro"}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <Select
          id={id}
          aria-label="Adicionar parceiro externo"
          value=""
          onChange={(e) => {
            if (e.target.value) onChange([...value, e.target.value]);
          }}
          disabled={disabled || available.length === 0}
          disableSort
        >
          <option value="">
            {partners.length === 0
              ? "Nenhum vendedor ou arquiteto cadastrado"
              : available.length === 0
                ? "Todos os parceiros já foram adicionados"
                : "Adicionar vendedor ou arquiteto"}
          </option>
          {available.map((partner) => (
            <option key={partner.id} value={partner.id}>
              {partnerLabel(partner)}
            </option>
          ))}
        </Select>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
    </FormItem>
  );
}
