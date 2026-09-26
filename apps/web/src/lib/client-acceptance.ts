/**
 * Aceite do cliente pelo link compartilhado. O aceite NÃO aprova a proposta:
 * ele fica pendente até a empresa confirmar, e confirmar é mudar a proposta
 * para a coluna aprovada, pelo mesmo caminho de sempre.
 */
export type ClientAcceptanceStatus = "pending" | "confirmed" | "discarded" | "invalidated";

export interface ClientAcceptance {
  name: string;
  document: string;
  acceptedAt: string;
  ip?: string | null;
  status?: ClientAcceptanceStatus;
}

export function isAcceptancePending(proposal: { clientAcceptance?: ClientAcceptance | null }): boolean {
  return proposal.clientAcceptance?.status === "pending";
}

interface ColumnLike {
  id: string;
  order?: number;
  mappedStatus?: string | null;
  category?: string | null;
}

/**
 * Coluna para onde "Confirmar aprovação" leva a proposta. Espelha
 * `pickApprovedStatus` do backend: a coluna mapeada como aprovada, senão a
 * primeira "ganha", na ordem do quadro.
 */
export function pickApprovedColumnId(columns: ColumnLike[]): string {
  const sorted = [...columns].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  return (
    sorted.find((c) => c.mappedStatus === "approved")?.id ??
    sorted.find((c) => c.category === "won")?.id ??
    "approved"
  );
}
