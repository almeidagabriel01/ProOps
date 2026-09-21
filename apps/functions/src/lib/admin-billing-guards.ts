/**
 * Regras do painel de superadmin para mexer em assinatura sem desfazer o que o
 * Stripe controla. Funcoes puras: o controller le os docs e decide com elas.
 *
 * O motivo de existirem: o formulario de edicao mandava
 * `isManualSubscription: true` em TODO salvamento de plano pago. Num tenant que
 * paga pelo Stripe isso o colocava no radar de `checkManualSubscriptions`, que
 * rebaixa para `past_due` e depois `canceled` + free quando a data passa, ou
 * seja, cortava o acesso de quem estava pagando.
 */

type DocData = Record<string, unknown> | null | undefined;

function hasText(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * O tenant e cobrado por uma assinatura Stripe vinculada. Nesse caso plano,
 * status e data vem do webhook, e o painel nao deve escrever por cima.
 *
 * Um tenant marcado como manual continua manual mesmo que tenha sobrado um
 * `stripeSubscriptionId` antigo: e o caso de quem cancelou o Stripe e passou a
 * pagar por fora.
 */
export function isStripeManagedBilling(tenantData: DocData, userData: DocData): boolean {
  if (tenantData?.isManualSubscription === true) return false;
  return (
    hasText(tenantData?.stripeSubscriptionId) ||
    hasText(userData?.stripeSubscriptionId)
  );
}

export interface ManualSubscriptionInput {
  subscriptionStatus?: unknown;
  currentPeriodEnd?: unknown;
  isManualSubscription?: unknown;
}

export type ManualSubscriptionDecision =
  | { ok: true; updates: Record<string, unknown> }
  | { ok: false; status: 400 | 409; code: string; message: string };

const GRACE_PERIOD_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Status derivado da data, com a mesma regra do cron `checkManualSubscriptions`.
 */
export function deriveManualStatusFromPeriodEnd(periodEnd: Date, now: Date): string {
  if (periodEnd > now) return "active";
  if (now.getTime() - periodEnd.getTime() <= GRACE_PERIOD_MS) return "past_due";
  return "canceled";
}

/**
 * Filtra e valida a atualizacao manual de assinatura.
 *
 * - String vazia em `currentPeriodEnd` significa "nao mexer", nunca "apagar":
 *   antes ela passava pelo filtro de `undefined` e zerava a data gravada.
 * - Com a data presente, o status e derivado dela (mesma regra do cron).
 * - Em tenant cobrado pelo Stripe, qualquer escrita e recusada com 409.
 */
export function buildManualSubscriptionUpdate(
  input: ManualSubscriptionInput,
  options: { stripeManaged: boolean; now?: Date },
): ManualSubscriptionDecision {
  const updates: Record<string, unknown> = {};

  if (hasText(input.subscriptionStatus)) {
    updates.subscriptionStatus = String(input.subscriptionStatus).trim();
  }
  if (typeof input.isManualSubscription === "boolean") {
    updates.isManualSubscription = input.isManualSubscription;
  }
  if (hasText(input.currentPeriodEnd)) {
    const raw = String(input.currentPeriodEnd).trim();
    const periodEnd = new Date(raw);
    if (Number.isNaN(periodEnd.getTime())) {
      return {
        ok: false,
        status: 400,
        code: "INVALID_PERIOD_END",
        message: "Data de vencimento inválida.",
      };
    }
    updates.currentPeriodEnd = raw;
    updates.subscriptionStatus = deriveManualStatusFromPeriodEnd(
      periodEnd,
      options.now ?? new Date(),
    );
  }

  if (Object.keys(updates).length === 0) {
    return {
      ok: false,
      status: 400,
      code: "NO_VALID_FIELDS",
      message: "Nenhum campo válido para atualização",
    };
  }

  if (options.stripeManaged) {
    return {
      ok: false,
      status: 409,
      code: "STRIPE_MANAGED_SUBSCRIPTION",
      message:
        "Esta empresa paga pelo Stripe: plano, status e vencimento vêm da assinatura e não podem ser alterados pelo painel.",
    };
  }

  return { ok: true, updates };
}
