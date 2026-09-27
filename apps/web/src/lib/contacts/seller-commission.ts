import type { ProposalCommission } from "@/types/proposal";

/** O que a regra precisa saber de um contato vendedor. */
export interface LinkedSellerContact {
  id: string;
  name: string;
  linkedMemberId?: string | null;
  commissionPercentage?: number | null;
}

/**
 * A comissão acompanha o responsável pela venda.
 *
 * Quando o responsável é um membro ligado a um contato vendedor, a comissão
 * dele entra na proposta com o percentual do cadastro. Trocar o responsável
 * tira a comissão do anterior (só a de vendedor, e só a do contato ligado a
 * ele) e põe a do novo. Comissão de arquiteto e de vendedor externo nunca é
 * tocada, e uma comissão que o novo responsável já tinha não é duplicada.
 */
export function applySellerCommission(
  commissions: ProposalCommission[],
  sellers: LinkedSellerContact[],
  previousSellerId: string | null | undefined,
  nextSellerId: string | null | undefined,
): ProposalCommission[] {
  const previousContact = previousSellerId
    ? sellers.find((s) => s.linkedMemberId === previousSellerId)
    : undefined;
  const nextContact = nextSellerId
    ? sellers.find((s) => s.linkedMemberId === nextSellerId)
    : undefined;

  let next = commissions;
  if (previousContact && previousContact.id !== nextContact?.id) {
    next = next.filter((c) => !(c.contactId === previousContact.id && c.role === "vendedor"));
  }
  if (nextContact && !next.some((c) => c.contactId === nextContact.id && c.role === "vendedor")) {
    next = [
      ...next,
      {
        contactId: nextContact.id,
        contactName: nextContact.name,
        role: "vendedor",
        percentage: nextContact.commissionPercentage ?? 0,
      },
    ];
  }
  return next;
}
