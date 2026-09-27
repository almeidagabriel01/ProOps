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

/** O cliente pediu mudanças pelo link. Aberto até a empresa atender ou encerrar. */
export interface ClientChangeRequest {
  name: string | null;
  message: string;
  requestedAt: string;
  status?: "open" | "resolved";
}

export function isChangeRequestOpen(proposal: { clientChangeRequest?: ClientChangeRequest | null }): boolean {
  return proposal.clientChangeRequest?.status === "open";
}

interface LiveResponses {
  ready: boolean;
  acceptances: Map<string, unknown>;
  changeRequests: Map<string, unknown>;
}

/**
 * Com o listener em tempo real pronto, ele manda (a lista pode estar velha);
 * antes disso, vale o que veio com a proposta.
 */
export function hasPendingAcceptance(
  proposal: { id: string; clientAcceptance?: ClientAcceptance | null },
  live?: LiveResponses,
): boolean {
  return live?.ready ? live.acceptances.has(proposal.id) : isAcceptancePending(proposal);
}

export function hasOpenChangeRequest(
  proposal: { id: string; clientChangeRequest?: ClientChangeRequest | null },
  live?: LiveResponses,
): boolean {
  return live?.ready ? live.changeRequests.has(proposal.id) : isChangeRequestOpen(proposal);
}

