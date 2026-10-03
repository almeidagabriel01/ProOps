/**
 * O que a tela `/subscription-blocked` diz e oferece. Puro: a página lê o
 * tenant no servidor e passa o contexto, e este módulo decide o texto.
 *
 * - **Membro**: não paga nada nem consegue (o backend recusa portal e checkout
 *   para quem não é dono ou administrador). Vê que a empresa está suspensa e
 *   com quem falar, e só pode sair.
 * - **Dono/admin de plano manual** (dado pelo superadmin): o plano venceu, e só
 *   a ProOps renova. Portal do Stripe e compra por cartão não servem.
 * - **Dono/admin de assinatura Stripe**: renovar a assinatura, atualizar o
 *   pagamento ou falar com a ProOps.
 *
 * Nunca cita o nome do plano.
 */

export type BlockedAction = "renew" | "update_payment" | "contact" | "logout" | "login";

export interface BlockedScreenInput {
  /** Sessão válida (a pessoa está logada). Sem ela a tela é genérica. */
  hasSession: boolean;
  isTenantAdmin: boolean;
  billing: "manual" | "stripe";
  /** `subscriptionStatus` do tenant. */
  status: string;
  /** "dd/mm/aaaa" do fim do contrato manual. */
  periodEndLabel: string | null;
  tenantName: string | null;
  /** Nome do responsável pela conta, mostrado ao membro. */
  ownerName: string | null;
}

export interface BlockedScreen {
  /** Ícone: cartão para pagamento recusado, alerta para o resto. */
  kind: "payment" | "suspended";
  title: string;
  description: string;
  actions: BlockedAction[];
}

const PAYMENT_FAILURE_STATUSES = new Set(["past_due", "unpaid", "payment_failed"]);
const ENDED_STATUSES = new Set(["canceled", "cancelled"]);

export function resolveBlockedScreen(input: BlockedScreenInput): BlockedScreen {
  if (!input.hasSession) {
    return {
      kind: "suspended",
      title: "Acesso suspenso",
      description:
        "O acesso da sua empresa ao ERP está suspenso. Entre com a conta do responsável para regularizar, ou fale com a ProOps.",
      actions: ["login", "contact"],
    };
  }

  if (!input.isTenantAdmin) {
    // "da empresa X", e não "da X": o artigo depende do nome ("da Maison", "do Grupo").
    const company = input.tenantName?.trim() ? `da empresa ${input.tenantName.trim()}` : "da sua empresa";
    const owner = input.ownerName?.trim()
      ? `${input.ownerName.trim()}, responsável pela conta,`
      : "o responsável pela conta";
    return {
      kind: "suspended",
      title: "Acesso suspenso",
      description: `O acesso ${company} ao ERP está suspenso. Fale com ${owner} para regularizar.`,
      actions: ["logout"],
    };
  }

  if (input.billing === "manual") {
    const when = input.periodEndLabel ? ` em ${input.periodEndLabel}` : "";
    return {
      kind: "suspended",
      title: "Seu plano venceu",
      description: `Seu plano venceu${when}. Para voltar a usar o ERP, fale com a ProOps para renovar.`,
      actions: ["contact", "logout"],
    };
  }

  const stripeActions: BlockedAction[] = ["renew", "update_payment", "contact", "logout"];
  if (PAYMENT_FAILURE_STATUSES.has(input.status)) {
    return {
      kind: "payment",
      title: "Pagamento não aprovado",
      description:
        "Não conseguimos cobrar a assinatura da sua empresa, e o acesso ao ERP está suspenso. Atualize a forma de pagamento ou renove a assinatura para voltar a usar.",
      actions: stripeActions,
    };
  }
  if (ENDED_STATUSES.has(input.status)) {
    return {
      kind: "suspended",
      title: "Assinatura encerrada",
      description:
        "A assinatura da sua empresa foi encerrada, e o acesso ao ERP está suspenso. Renove a assinatura para voltar a usar.",
      actions: stripeActions,
    };
  }
  return {
    kind: "suspended",
    title: "Acesso suspenso",
    description:
      "A assinatura da sua empresa não está ativa, e o acesso ao ERP está suspenso. Renove a assinatura para voltar a usar.",
    actions: stripeActions,
  };
}
