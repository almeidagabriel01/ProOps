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

/** Rótulo de cada tipo de contato, na ordem em que a tela os apresenta. */
const CONTACT_TYPE_LABELS: Record<string, string> = {
  cliente: "Cliente",
  fornecedor: "Fornecedor",
  vendedor: "Vendedor",
  arquiteto: "Arquiteto",
};

const CONTACT_TYPE_ORDER = ["cliente", "fornecedor", "vendedor", "arquiteto"];

/**
 * "Cliente", "Cliente e arquiteto", "Cliente, fornecedor e arquiteto".
 *
 * Existe porque as mensagens do cadastro diziam "Cliente" a seco, e passaram a
 * mentir quando vendedor e arquiteto entraram: quem cadastrava um arquiteto
 * lia "Cliente criado com sucesso".
 */
export function describeContactTypes(types: readonly string[] = []): string {
  const rotulos = CONTACT_TYPE_ORDER.filter((t) => types.includes(t)).map(
    (t, index) =>
      index === 0 ? CONTACT_TYPE_LABELS[t] : CONTACT_TYPE_LABELS[t].toLowerCase(),
  );

  if (rotulos.length === 0) return "Contato";
  if (rotulos.length === 1) return rotulos[0];
  return `${rotulos.slice(0, -1).join(", ")} e ${rotulos[rotulos.length - 1]}`;
}
