/**
 * Resumo desnormalizado por grupo de lançamentos — base da coleção
 * `transaction_groups` (1 doc por grupo), mantida pelo trigger
 * onTransactionTotals. A aba "Agrupados" do frontend lê 1 doc-resumo por
 * grupo em vez de baixar todos os membros.
 *
 * A chave de grupo espelha EXATAMENTE getGroupedTransactionKey do frontend
 * (apps/web/src/app/transactions/_lib/financial-utils.ts):
 * proposalGroupId > installmentGroupId | recurringGroupId > avulso (null).
 */

import { computeTransactionTotals } from "./transaction-totals";

export type TransactionGroupSummary = {
  tenantId: string;
  groupKey: string; // "proposal:{id}" | "group:{id}"
  kind: "proposal" | "installment" | "recurring";
  type: "income" | "expense";
  description: string;
  wallet?: string;
  clientName?: string;
  proposalId?: string;
  memberCount: number;
  paidCount: number;
  total: number;
  paidTotal: number;
  pendingTotal: number;
  nextDueDate: string | null; // menor dueDate entre membros não-pagos (YYYY-MM-DD)
  firstDueDate: string | null;
  lastDueDate: string | null;
  status: "paid" | "pending" | "overdue";
  updatedAt: string; // ISO
  /** id do doc âncora — permite links/ações no card colapsado sem carregar membros */
  anchorTransactionId?: string;
  /** amount do âncora — exibição de recorrentes (valor por ocorrência, não Σ) */
  anchorAmount?: number;
  /** installmentGroupId do âncora — delete/status de grupo em resumos kind proposal */
  anchorInstallmentGroupId?: string;
};

type GroupIdFields = {
  proposalGroupId?: unknown;
  installmentGroupId?: unknown;
  recurringGroupId?: unknown;
};

function asNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function resolveGroupKey(
  data: GroupIdFields | null | undefined,
): string | null {
  if (!data) return null;
  const proposalGroupId = asNonEmptyString(data.proposalGroupId);
  if (proposalGroupId) return `proposal:${proposalGroupId}`;
  const groupId =
    asNonEmptyString(data.installmentGroupId) ??
    asNonEmptyString(data.recurringGroupId);
  if (groupId) return `group:${groupId}`;
  return null;
}

/** Firestore doc IDs não aceitam "/"; padronizar "_" evita surpresas em URLs. */
export function groupDocIdFromKey(groupKey: string): string {
  return groupKey.replace(/:/g, "_");
}

type MemberDoc = Record<string, unknown>;

function memberDueDate(member: MemberDoc): string | null {
  const raw = member.dueDate;
  if (typeof raw !== "string" || !raw) return null;
  return raw.includes("T") ? raw.split("T")[0] : raw;
}

function isPaid(member: MemberDoc): boolean {
  return String(member.status ?? "").trim().toLowerCase() === "paid";
}

function isOverdue(member: MemberDoc, todayIso: string): boolean {
  const status = String(member.status ?? "").trim().toLowerCase();
  if (status === "overdue") return true;
  if (status !== "pending") return false;
  const due = memberDueDate(member);
  return !!due && due < todayIso;
}

function memberInstallmentNumber(member: MemberDoc): number | null {
  const n = Number(member.installmentNumber);
  return Number.isFinite(n) ? n : null;
}

/**
 * Âncora para description/type/wallet/clientName: membro com menor
 * installmentNumber >= 1; fallback menor dueDate; fallback primeiro.
 */
function pickAnchor(members: MemberDoc[]): MemberDoc {
  let byInstallment: MemberDoc | null = null;
  let byInstallmentNumber = Infinity;
  for (const m of members) {
    const n = memberInstallmentNumber(m);
    if (n !== null && n >= 1 && n < byInstallmentNumber) {
      byInstallment = m;
      byInstallmentNumber = n;
    }
  }
  if (byInstallment) return byInstallment;

  let byDueDate: MemberDoc | null = null;
  let earliest: string | null = null;
  for (const m of members) {
    const due = memberDueDate(m);
    if (due && (earliest === null || due < earliest)) {
      byDueDate = m;
      earliest = due;
    }
  }
  return byDueDate ?? members[0];
}

function resolveKind(
  groupKey: string,
  members: MemberDoc[],
): TransactionGroupSummary["kind"] {
  if (groupKey.startsWith("proposal:")) return "proposal";
  const hasRecurring = members.some(
    (m) => asNonEmptyString(m.recurringGroupId) !== null,
  );
  const hasInstallment = members.some(
    (m) => asNonEmptyString(m.installmentGroupId) !== null,
  );
  return hasInstallment || !hasRecurring ? "installment" : "recurring";
}

export function computeGroupSummary(
  tenantId: string,
  groupKey: string,
  members: MemberDoc[],
  todayIso: string,
): TransactionGroupSummary | null {
  if (members.length === 0) return null;

  let paidTotal = 0;
  let pendingTotal = 0;
  let paidCount = 0;
  let anyOverdue = false;
  let nextDueDate: string | null = null;
  let firstDueDate: string | null = null;
  let lastDueDate: string | null = null;

  for (const member of members) {
    const totals = computeTransactionTotals(member);
    paidTotal += totals.paidTotal;
    pendingTotal += totals.pendingTotal;

    const paid = isPaid(member);
    if (paid) paidCount += 1;
    if (isOverdue(member, todayIso)) anyOverdue = true;

    const due = memberDueDate(member);
    if (due) {
      if (firstDueDate === null || due < firstDueDate) firstDueDate = due;
      if (lastDueDate === null || due > lastDueDate) lastDueDate = due;
      if (!paid && (nextDueDate === null || due < nextDueDate)) {
        nextDueDate = due;
      }
    }
  }

  const anchor = pickAnchor(members);
  const status: TransactionGroupSummary["status"] =
    paidCount === members.length ? "paid" : anyOverdue ? "overdue" : "pending";

  const summary: TransactionGroupSummary = {
    tenantId,
    groupKey,
    kind: resolveKind(groupKey, members),
    type: anchor.type === "expense" ? "expense" : "income",
    description: asNonEmptyString(anchor.description) ?? "",
    memberCount: members.length,
    paidCount,
    total: paidTotal + pendingTotal,
    paidTotal,
    pendingTotal,
    nextDueDate,
    firstDueDate,
    lastDueDate,
    status,
    updatedAt: new Date().toISOString(),
  };

  const wallet = asNonEmptyString(anchor.wallet);
  if (wallet) summary.wallet = wallet;
  const clientName = asNonEmptyString(anchor.clientName);
  if (clientName) summary.clientName = clientName;
  const proposalId = asNonEmptyString(anchor.proposalId);
  if (proposalId) summary.proposalId = proposalId;
  const anchorId = asNonEmptyString(anchor.id);
  if (anchorId) summary.anchorTransactionId = anchorId;
  const anchorAmount = Number(anchor.amount);
  if (Number.isFinite(anchorAmount)) summary.anchorAmount = anchorAmount;
  const anchorInstallmentGroupId = asNonEmptyString(anchor.installmentGroupId);
  if (anchorInstallmentGroupId) {
    summary.anchorInstallmentGroupId = anchorInstallmentGroupId;
  }

  return summary;
}
