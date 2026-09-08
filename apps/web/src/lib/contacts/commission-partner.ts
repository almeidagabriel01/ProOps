/**
 * Quem recebe comissao, em modulo puro.
 *
 * Mora fora de `services/client-service.ts` de proposito: aquele arquivo
 * importa o SDK do Firebase, e qualquer teste ou componente que precisasse
 * apenas desta lista passaria a inicializar auth, firestore e storage junto.
 */

export const COMMISSION_CLIENT_TYPES = ["vendedor", "arquiteto"] as const;

export type CommissionRole = (typeof COMMISSION_CLIENT_TYPES)[number];

export const COMMISSION_ROLE_LABELS: Record<CommissionRole, string> = {
  vendedor: "Vendedor",
  arquiteto: "Arquiteto",
};

export function isCommissionRole(value: string): value is CommissionRole {
  return (COMMISSION_CLIENT_TYPES as readonly string[]).includes(value);
}

/** Verdadeiro quando o contato recebe comissao por qualquer um dos papeis. */
export function isCommissionPartner(contact: {
  types?: readonly string[];
}): boolean {
  return (contact.types || []).some(isCommissionRole);
}

/** Primeiro papel de comissao do contato, para pre-selecionar na proposta. */
export function primaryCommissionRole(contact: {
  types?: readonly string[];
}): CommissionRole | null {
  return (contact.types || []).find(isCommissionRole) ?? null;
}
