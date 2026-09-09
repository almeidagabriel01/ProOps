/**
 * Comissao de vendedor e arquiteto, atrelada a forma de pagamento do cliente.
 *
 * A regra de negocio em uma frase: **a comissao segue o cronograma do cliente**.
 * Se ele paga 60% de sinal e o resto em 4x, o parceiro recebe 60% da comissao
 * junto do sinal e o resto em 4x, nas mesmas datas. Por isso as despesas de
 * comissao nao sao calculadas por conta propria: elas ESPELHAM, uma a uma, as
 * receitas que `buildApprovedProposalTransactionDrafts` ja produziu.
 *
 * Proporcional a cada parcela, e nao uma divisao por N: e o que faz
 * "80% a vista e o saldo na entrega" sair certo pela mesma formula, sem caso
 * especial.
 *
 * Duas decisoes que parecem detalhe e nao sao:
 *
 * 1. **Despesa propria, nunca `extraCosts`.** `getWalletImpacts` aplica ao
 *    extraCost o SINAL DO PAI, entao comissao pendurada numa receita creditaria
 *    a carteira em vez de debitar.
 * 2. **Sem `proposalGroupId`.** Com ele as comissoes cairiam no mesmo doc-resumo
 *    de `transaction_groups` dos recebiveis, e a aba Agrupados somaria receita
 *    com despesa no mesmo card. Com `installmentGroupId` proprio, cada parceiro
 *    vira um grupo seu.
 */

import { roundCurrency } from "../services/transaction-helpers";

export const COMMISSION_ROLES = ["vendedor", "arquiteto"] as const;

export type CommissionRole = (typeof COMMISSION_ROLES)[number];

export type ProposalCommission = {
  contactId: string;
  contactName: string;
  role: CommissionRole;
  percentage: number;
};

export const MAX_COMMISSIONS_PER_PROPOSAL = 20;

const COMMISSION_CATEGORY = "Comissao";

function isCommissionRole(value: unknown): value is CommissionRole {
  return (COMMISSION_ROLES as readonly string[]).includes(String(value));
}

/**
 * Normaliza o que veio do formulario. Descarta silenciosamente entrada
 * invalida em vez de lancar: uma comissao malformada nao pode impedir a
 * proposta de ser salva, e o que sobra e sempre um array coerente.
 *
 * Percentual fora de 0..100 e recusado, nao clampado: 150% e erro de digitacao,
 * e virar 100% geraria uma comissao maior que a venda sem ninguem perceber.
 */
export function sanitizeProposalCommissionsInput(
  value: unknown,
): ProposalCommission[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const out: ProposalCommission[] = [];

  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Record<string, unknown>;

    const contactId = String(item.contactId || "").trim().slice(0, 100);
    const role = item.role;
    if (!contactId || !isCommissionRole(role)) continue;

    const percentage = Number(item.percentage);
    if (!Number.isFinite(percentage) || percentage <= 0 || percentage > 100) {
      continue;
    }

    // Mesmo contato pode ser vendedor E arquiteto na mesma proposta; o que nao
    // pode e a mesma dupla entrar duas vezes, que dobraria a comissao.
    const key = `${contactId}:${role}`;
    if (seen.has(key)) continue;
    seen.add(key);

    out.push({
      contactId,
      contactName: String(item.contactName || "").trim().slice(0, 200),
      role,
      percentage,
    });

    if (out.length >= MAX_COMMISSIONS_PER_PROPOSAL) break;
  }

  return out;
}

/** Le as comissoes ja gravadas no doc da proposta. */
export function readProposalCommissions(
  proposalData: Record<string, unknown>,
): ProposalCommission[] {
  return sanitizeProposalCommissionsInput(proposalData.commissions);
}

export function buildCommissionInstallmentGroupId(
  proposalId: string,
  contactId: string,
  role: CommissionRole,
): string {
  return `commission_${proposalId}_${contactId}_${role}`;
}

/**
 * Chave do diff idempotente do sync. O sync joga em `complexDocs` (e aborta)
 * todo doc com `proposalId` que ele nao consiga keyar, entao esta funcao e o
 * que impede uma comissao de derrubar a sincronizacao inteira da proposta.
 */
export function buildCommissionTransactionKey(
  contactId: string,
  role: string,
  sourceKey: string,
): string {
  return `commission_${contactId}_${role}_${sourceKey}`;
}

export type CommissionSourceDraft = {
  /** Chave da receita espelhada: "down_payment" | "installment_N" | "single". */
  sourceKey: string;
  amount: number;
  date: string;
  dueDate: string;
  installmentCount: number | null;
  installmentNumber: number | null;
};

export type CommissionDraft = {
  tenantId: string;
  type: "expense";
  description: string;
  amount: number;
  date: string;
  dueDate: string;
  status: "pending";
  clientId: string | null;
  clientName: string | null;
  proposalId: string;
  proposalGroupId: null;
  category: string;
  wallet: string | null;
  isDownPayment: false;
  isInstallment: boolean;
  installmentCount: number | null;
  installmentNumber: number | null;
  installmentGroupId: string | null;
  notes: string;
  createdById: string;
  isCommission: true;
  commissionContactId: string;
  commissionContactName: string;
  commissionRole: CommissionRole;
  commissionPercentage: number;
  commissionSourceKey: string;
};

/**
 * Reparte o total da comissao entre as receitas, na proporcao de cada uma.
 *
 * O resto do arredondamento vai para a ULTIMA parcela: sem isso, 10 parcelas de
 * uma comissao de R$ 1.000,01 somariam R$ 1.000,00 e o parceiro receberia um
 * centavo a menos, para sempre, sem que nada acusasse.
 */
export function splitCommissionAcrossSources(
  commissionTotal: number,
  sources: CommissionSourceDraft[],
): number[] {
  const total = roundCurrency(commissionTotal);
  const sourcesTotal = sources.reduce((sum, s) => sum + s.amount, 0);
  if (sources.length === 0 || total <= 0 || sourcesTotal <= 0) {
    return sources.map(() => 0);
  }

  // Divisor e a soma das RECEITAS, nao o valor da proposta: assim as partes
  // somam o total exato mesmo se um dia as duas coisas divergirem.
  const parts = sources.map((source) =>
    roundCurrency((total * source.amount) / sourcesTotal),
  );

  const assigned = roundCurrency(
    parts.slice(0, -1).reduce((sum, value) => sum + value, 0),
  );
  parts[parts.length - 1] = roundCurrency(total - assigned);

  return parts;
}

/**
 * Uma despesa por parceiro por parcela de receita.
 *
 * `status` e sempre "pending", mesmo quando a receita nasce paga: receber do
 * cliente nao significa que o parceiro ja foi pago.
 */
export function buildCommissionDrafts(params: {
  tenantId: string;
  proposalId: string;
  proposalTitle: string;
  commissions: ProposalCommission[];
  sources: CommissionSourceDraft[];
  baseTotal: number;
  walletName: string | null;
  userId: string;
}): CommissionDraft[] {
  const {
    tenantId,
    proposalId,
    proposalTitle,
    commissions,
    sources,
    baseTotal,
    walletName,
    userId,
  } = params;

  if (commissions.length === 0 || sources.length === 0 || baseTotal <= 0) {
    return [];
  }

  const drafts: CommissionDraft[] = [];

  for (const commission of commissions) {
    const commissionTotal = roundCurrency(
      (baseTotal * commission.percentage) / 100,
    );
    if (commissionTotal <= 0) continue;

    const amounts = splitCommissionAcrossSources(commissionTotal, sources);

    // A comissao vira UMA SERIE de parcelas, numerada 1..N sobre as receitas
    // que ela espelha — inclusive a que espelha a ENTRADA. Antes cada despesa
    // herdava o `isInstallment` da receita, entao numa proposta com entrada a
    // serie ficava mista: o card de grupo da tela de Lancamentos so renderiza
    // os membros `isInstallment`, e a comissao da entrada sumia da lista
    // (aparecia so no total do cabecalho, que nao batia com as linhas).
    const isSeries = sources.length > 1;

    sources.forEach((source, index) => {
      const amount = amounts[index];
      if (amount <= 0) return;

      drafts.push({
        tenantId,
        type: "expense",
        description: `Comissão ${commission.contactName || "parceiro"}: ${proposalTitle}`,
        amount,
        date: source.date,
        dueDate: source.dueDate,
        status: "pending",
        clientId: commission.contactId,
        clientName: commission.contactName || null,
        proposalId,
        proposalGroupId: null,
        category: COMMISSION_CATEGORY,
        wallet: walletName,
        isDownPayment: false,
        isInstallment: isSeries,
        installmentCount: isSeries ? sources.length : null,
        installmentNumber: isSeries ? index + 1 : null,
        // Comissao unica nao vira grupo de um membro so: fica avulsa, como
        // qualquer outra despesa sem parcelamento.
        installmentGroupId: isSeries
          ? buildCommissionInstallmentGroupId(
              proposalId,
              commission.contactId,
              commission.role,
            )
          : null,
        notes: `Comissão de ${commission.percentage}% gerada automaticamente pela proposta`,
        createdById: userId,
        isCommission: true,
        commissionContactId: commission.contactId,
        commissionContactName: commission.contactName || "",
        commissionRole: commission.role,
        commissionPercentage: commission.percentage,
        commissionSourceKey: source.sourceKey,
      });
    });
  }

  return drafts;
}
