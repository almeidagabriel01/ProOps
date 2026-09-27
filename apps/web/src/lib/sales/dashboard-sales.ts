import { soldValue } from "./sold-value";

type SoldLike = { closedValue?: unknown; totalValue?: unknown };

export interface SalesSummary {
  /** Valor vendido no mês: propostas aprovadas nele, pelo valor fechado. */
  sold: number;
  soldCount: number;
  /** Valor médio por venda do mês; 0 sem venda. */
  ticket: number;
  previousSold: number;
  /** Variação contra o mês anterior, em %; null quando o anterior foi zero. */
  deltaPercent: number | null;
  /** Propostas com o cliente, esperando decisão. */
  openValue: number;
  openCount: number;
}

/**
 * Os números da faixa "Vendas do mês" do Dashboard. As vendas são as
 * propostas aprovadas no mês (`approvedAt`), a mesma regra das Metas, então
 * "Vendido" e o progresso da meta mostram o mesmo número.
 */
export function summarizeSales(
  current: SoldLike[],
  previous: SoldLike[],
  open: { count: number; total: number },
): SalesSummary {
  const sold = current.reduce((sum, p) => sum + soldValue(p), 0);
  const previousSold = previous.reduce((sum, p) => sum + soldValue(p), 0);
  const soldCount = current.length;
  return {
    sold,
    soldCount,
    ticket: soldCount > 0 ? sold / soldCount : 0,
    previousSold,
    deltaPercent:
      previousSold > 0 ? Math.round(((sold - previousSold) / previousSold) * 100) : null,
    openValue: Number.isFinite(open.total) ? open.total : 0,
    openCount: open.count,
  };
}

/**
 * Status em que a proposta está com o cliente: os abertos do kanban, menos o
 * rascunho e o "em aberto" (ainda em montagem pela empresa).
 */
export function negotiationStatuses(openStatuses: string[]): string[] {
  return openStatuses.filter((status) => status !== "draft" && status !== "in_progress");
}

/**
 * Valor vendido é número da empresa: dono e administradores, como nas Metas
 * (o membro vê só o próprio número lá). A demonstração vê um exemplo.
 */
export function canSeeCompanySales(viewer: {
  canViewProposals: boolean;
  isMaster: boolean;
  isDemo: boolean;
}): boolean {
  return viewer.canViewProposals && (viewer.isMaster || viewer.isDemo);
}
