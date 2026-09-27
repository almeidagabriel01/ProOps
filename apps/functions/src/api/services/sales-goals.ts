import { z } from "zod";
import { db } from "../../init";
import { soldValue } from "../../shared/sold-value";
import { monthWindowUtc } from "../../shared/sales-month";

/**
 * Metas de vendas (Pro e Enterprise).
 *
 * Quem vende é o membro escolhido na proposta (`sellerId`, padrão: quem criou),
 * e a venda conta no mês em que a proposta foi APROVADA (`approvedAt`, gravado
 * na transição para aprovada e apagado se ela sair de aprovada). A meta fica
 * em `sales_goals/{tenantId}_{YYYY-MM}`, que só o backend lê e grava.
 */

export const SALES_GOALS_COLLECTION = "sales_goals";
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const MAX_TARGET = 1_000_000_000;

export const SalesGoalsInputSchema = z
  .object({
    month: z.string().regex(MONTH, "Mês inválido."),
    companyTarget: z.number().min(0).max(MAX_TARGET).nullable(),
    targets: z.record(z.string().min(1).max(128), z.number().min(0).max(MAX_TARGET)),
  })
  .strict();

export type SalesGoalsInput = z.infer<typeof SalesGoalsInputSchema>;

export function isValidMonth(value: unknown): value is string {
  return typeof value === "string" && MONTH.test(value);
}

export function goalsDocId(tenantId: string, month: string): string {
  return `${tenantId}_${month}`;
}

export { monthWindowUtc };

/**
 * O que a mudança de status faz com a data da aprovação: grava na entrada em
 * aprovada, apaga na saída (a venda foi desfeita), e não mexe no resto.
 */
export function approvalTimestampUpdate(
  wasApproved: boolean,
  willBeApproved: boolean,
  nowIso: string,
): { approvedAt?: string | null } {
  if (willBeApproved && !wasApproved) return { approvedAt: nowIso };
  if (!willBeApproved && wasApproved) return { approvedAt: null };
  return {};
}

// Puro e em shared/ porque o Dashboard do front espelha a mesma conta.
export { soldValue };

/**
 * O vendedor precisa ser pessoa da empresa. Devolve id e nome para gravar na
 * proposta; `null` tira o vendedor.
 */
export async function resolveSeller(
  tenantId: string,
  sellerId: string | null,
): Promise<{ sellerId: string | null; sellerName: string | null }> {
  if (!sellerId) return { sellerId: null, sellerName: null };
  const snap = await db.collection("users").doc(sellerId).get();
  const data = snap.data();
  if (!snap.exists || data?.tenantId !== tenantId) throw new Error("VENDEDOR_INVALIDO");
  return { sellerId, sellerName: String(data?.name || data?.email || "Sem nome") };
}

export interface SoldProposal {
  sellerId?: string | null;
  sellerName?: string | null;
  closedValue?: unknown;
  totalValue?: unknown;
}

export interface GoalProgress {
  companyTarget: number | null;
  companyAchieved: number;
  companyCount: number;
  people: Array<{ id: string; name: string; target: number | null; achieved: number; count: number }>;
  /** Vendido em proposta sem vendedor (as antigas, anteriores ao campo). */
  unassignedAchieved: number;
}

/**
 * Pura: soma o vendido no mês por vendedor e para a empresa. Aparece quem tem
 * meta ou vendeu alguma coisa; quem não tem nem uma coisa nem outra fica de fora.
 */
export function computeGoalProgress(
  proposals: SoldProposal[],
  goals: { companyTarget: number | null; targets: Record<string, number> },
  people: Array<{ id: string; name: string }>,
): GoalProgress {
  const names = new Map(people.map((p) => [p.id, p.name]));
  const byPerson = new Map<string, { achieved: number; count: number; name: string | null }>();
  let companyAchieved = 0;
  let unassignedAchieved = 0;

  for (const proposal of proposals) {
    const value = soldValue(proposal);
    companyAchieved += value;
    if (!proposal.sellerId) {
      unassignedAchieved += value;
      continue;
    }
    const current = byPerson.get(proposal.sellerId) ?? { achieved: 0, count: 0, name: null };
    current.achieved += value;
    current.count += 1;
    current.name = current.name ?? proposal.sellerName ?? null;
    byPerson.set(proposal.sellerId, current);
  }

  const ids = new Set([...Object.keys(goals.targets), ...byPerson.keys()]);
  const result = Array.from(ids).map((id) => {
    const sold = byPerson.get(id);
    return {
      id,
      name: names.get(id) ?? sold?.name ?? "Sem nome",
      target: goals.targets[id] ?? null,
      achieved: sold?.achieved ?? 0,
      count: sold?.count ?? 0,
    };
  });
  result.sort((a, b) => b.achieved - a.achieved || a.name.localeCompare(b.name, "pt-BR"));

  return {
    companyTarget: goals.companyTarget,
    companyAchieved,
    companyCount: proposals.length,
    people: result,
    unassignedAchieved,
  };
}
