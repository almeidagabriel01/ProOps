"use client";

import * as React from "react";
import { FormGroup, FormStatic } from "@/components/ui/form-components";
import {
  PartnerContactsField,
  ResponsibleMemberField,
} from "@/components/features/responsibles/responsibles-fields";
import { useContactResponsibles } from "@/hooks/use-contact-responsibles";
import type { ClientType } from "@/services/client-service";

/** Se o bloco aparece: quem cuida de alguém é o cliente, não o fornecedor nem o parceiro. */
export function showsContactResponsibles(types: readonly ClientType[]): boolean {
  return types.includes("cliente");
}

export interface ContactResponsiblesValue {
  responsibleMemberId: string | null;
  partnerContactIds: string[];
}

interface ContactResponsiblesSectionProps {
  types: ClientType[];
  value: ContactResponsiblesValue;
  onChange: (value: ContactResponsiblesValue) => void;
  /** Na edição: o próprio contato não pode ser parceiro dele mesmo. */
  contactId?: string;
  readOnly?: boolean;
}

/**
 * "Quem cuida deste cliente": o responsável da equipe e os parceiros externos.
 * Mesmo bloco no cadastro e na edição, para as duas telas não divergirem. A
 * proposta herda os dois ao escolher o cliente.
 */
export function ContactResponsiblesSection({
  types,
  value,
  onChange,
  contactId,
  readOnly,
}: ContactResponsiblesSectionProps) {
  const { people, partners } = useContactResponsibles();
  if (!showsContactResponsibles(types)) return null;

  if (readOnly) {
    const memberName = people.find((p) => p.id === value.responsibleMemberId)?.name;
    const partnerNames = value.partnerContactIds
      .map((id) => partners.find((p) => p.id === id)?.name)
      .filter(Boolean)
      .join(", ");
    return (
      <FormGroup>
        <FormStatic label="Responsável da equipe" value={memberName} placeholder="Sem responsável" />
        <FormStatic label="Parceiros externos" value={partnerNames} placeholder="Nenhum" />
      </FormGroup>
    );
  }

  return (
    <FormGroup>
      <ResponsibleMemberField
        id="responsibleMemberId"
        value={value.responsibleMemberId}
        people={people}
        onChange={(responsibleMemberId) => onChange({ ...value, responsibleMemberId })}
        hint="Quem cuida deste cliente. A proposta já vem com essa pessoa."
      />
      <PartnerContactsField
        id="partnerContactIds"
        value={value.partnerContactIds}
        partners={partners}
        excludeContactId={contactId}
        onChange={(partnerContactIds) => onChange({ ...value, partnerContactIds })}
        hint="Arquiteto ou vendedor de fora que acompanha este cliente."
      />
    </FormGroup>
  );
}
