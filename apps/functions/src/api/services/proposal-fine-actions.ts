import { db } from "../../init";
import { checkPermission } from "../../lib/auth-helpers";
import {
  commissionsChangeIsAutomatic,
  commissionsChanged,
  discountChanged,
  sellerChanged,
  type CommissionLine,
} from "./proposal-fine-permissions";

/** Percentual de comissão de cada contato no cadastro, para reconhecer a comissão automática. */
async function loadCommissionRegistry(
  tenantId: string,
  lines: readonly CommissionLine[],
): Promise<Map<string, number>> {
  const ids = [...new Set(lines.map((line) => line.contactId))].slice(0, 50);
  const registry = new Map<string, number>();
  if (ids.length === 0) return registry;
  const snaps = await db.getAll(...ids.map((id) => db.collection("clients").doc(id)));
  for (const snap of snaps) {
    const data = snap.data();
    if (!snap.exists || data?.tenantId !== tenantId) continue;
    const pct = Number(data?.commissionPercentage);
    if (Number.isFinite(pct)) registry.set(snap.id, pct);
  }
  return registry;
}

/**
 * As ações finas da proposta para quem não é dono nem administrador. Devolve
 * a mensagem do 403, ou null quando a gravação pode seguir. Vale o valor que
 * MUDA: o formulário reenvia a proposta inteira.
 */
export async function checkProposalFineActions(params: {
  userId: string;
  tenantId: string;
  current: Record<string, unknown> | null;
  input: Record<string, unknown>;
  commissionsAfter: CommissionLine[] | null;
  approvalChanges: boolean;
  paidOnApproval: boolean;
}): Promise<string | null> {
  const { userId, tenantId, current, input } = params;
  const can = (key: string) => checkPermission(userId, "proposals", key);
  if (params.approvalChanges && !(await can("approve"))) {
    return "Sem permissão para aprovar ou reverter propostas.";
  }
  if (params.paidOnApproval && !(await checkPermission(userId, "transactions", "canCreate"))) {
    return "Aprovar com o pagamento já recebido pede a permissão de criar lançamentos.";
  }
  if (discountChanged(current, input) && !(await can("discount"))) {
    return "Sem permissão para dar desconto ou mudar o valor fechado.";
  }
  const sellerBase = current ?? { sellerId: userId, partnerContactIds: input.partnerContactIds };
  if (sellerChanged(sellerBase, input) && !(await can("changeSeller"))) {
    return "Sem permissão para trocar o responsável pela venda.";
  }
  if (params.commissionsAfter) {
    const before = (Array.isArray(current?.commissions) ? current?.commissions : []) as CommissionLine[];
    if (commissionsChanged(before, params.commissionsAfter)) {
      const registry = await loadCommissionRegistry(tenantId, params.commissionsAfter);
      if (!commissionsChangeIsAutomatic(before, params.commissionsAfter, registry) && !(await can("commissions"))) {
        return "Sem permissão para mexer nas comissões.";
      }
    }
  }
  return null;
}
