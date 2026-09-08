import { db } from "../../init";
import { resolveUserAndTenant } from "../../lib/auth-helpers";
import { checkFinancialPermission } from "../../lib/finance-helpers";
import type { CommissionRole } from "../controllers/proposal-commissions";

/**
 * Relatorio mensal de comissoes: quanto a empresa deve a cada vendedor e a cada
 * arquiteto no mes.
 *
 * Nao usa aggregation query. `sum()` e `count()` nao agrupam por campo, e o que
 * a pergunta pede e exatamente o agrupamento ("o arquiteto A tem X, o B tem
 * Y"). O volume torna isso barato: comissoes do mes = parceiros x parcelas que
 * vencem no mes, dezenas de docs, nao milhares.
 *
 * O escopo e por `dueDate`, com `orderBy` EXPLICITO. Intervalo sem orderBy
 * assume ASC e pede um indice diferente do declarado — falha que so aparece em
 * runtime, como FAILED_PRECONDITION, no primeiro clique de alguem.
 */

const COLLECTION_NAME = "transactions";

/** Teto de seguranca. Um mes real fica em ordem de dezenas de documentos. */
const MAX_COMMISSIONS_PER_MONTH = 2000;

export type CommissionReportEntry = {
  transactionId: string;
  amount: number;
  dueDate: string;
  status: string;
  proposalId: string | null;
  description: string;
  installmentNumber: number | null;
  installmentCount: number | null;
};

export type CommissionReportPartner = {
  contactId: string;
  contactName: string;
  role: CommissionRole | null;
  /** Ainda nao pago ao parceiro (pendente + vencido). */
  aPagar: number;
  pago: number;
  total: number;
  entries: CommissionReportEntry[];
};

export type CommissionReport = {
  month: string;
  aPagar: number;
  pago: number;
  total: number;
  partners: CommissionReportPartner[];
};

/** "2026-10" -> { start: "2026-10-01", end: "2026-10-31" } */
export function resolveMonthRange(month: string): {
  month: string;
  start: string;
  end: string;
} {
  const match = /^(\d{4})-(\d{2})$/.exec(String(month || "").trim());
  const now = new Date();
  const year = match ? Number(match[1]) : now.getFullYear();
  const monthIndex = match ? Number(match[2]) - 1 : now.getMonth();

  // Dia 0 do mes seguinte e o ultimo dia deste mes, fevereiro e bissexto
  // inclusive. Date normaliza mes 12 para janeiro do ano seguinte sozinho.
  const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const mm = String(monthIndex + 1).padStart(2, "0");

  return {
    month: `${year}-${mm}`,
    start: `${year}-${mm}-01`,
    end: `${year}-${mm}-${String(lastDay).padStart(2, "0")}`,
  };
}

function normalizeRole(value: unknown): CommissionRole | null {
  return value === "vendedor" || value === "arquiteto" ? value : null;
}

export async function getCommissionReport(
  userId: string,
  claims: Parameters<typeof resolveUserAndTenant>[1],
  options: { month?: string; requestedTenantId?: string } = {},
): Promise<CommissionReport> {
  const { tenantId, isSuperAdmin } = await checkFinancialPermission(
    userId,
    "transactions",
    "canView",
    claims,
  );

  const effectiveTenantId =
    isSuperAdmin && options.requestedTenantId?.trim()
      ? options.requestedTenantId.trim()
      : tenantId;

  if (!effectiveTenantId) {
    throw new Error("AUTH_CLAIMS_MISSING_TENANT");
  }

  const range = resolveMonthRange(options.month || "");

  const snapshot = await db
    .collection(COLLECTION_NAME)
    .where("tenantId", "==", effectiveTenantId)
    .where("isCommission", "==", true)
    .where("dueDate", ">=", range.start)
    .where("dueDate", "<=", range.end)
    .orderBy("dueDate", "asc")
    .limit(MAX_COMMISSIONS_PER_MONTH)
    .get();

  const byPartner = new Map<string, CommissionReportPartner>();

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const contactId = String(data.commissionContactId || "").trim();
    if (!contactId) continue;

    const role = normalizeRole(data.commissionRole);
    const key = `${contactId}:${role || ""}`;

    let partner = byPartner.get(key);
    if (!partner) {
      partner = {
        contactId,
        contactName: String(data.commissionContactName || "").trim(),
        role,
        aPagar: 0,
        pago: 0,
        total: 0,
        entries: [],
      };
      byPartner.set(key, partner);
    }

    const amount = Number(data.amount) || 0;
    // "overdue" e derivado, nao escrito: qualquer coisa que nao seja "paid"
    // ainda e dinheiro a pagar ao parceiro.
    if (data.status === "paid") {
      partner.pago += amount;
    } else {
      partner.aPagar += amount;
    }
    partner.total += amount;

    partner.entries.push({
      transactionId: doc.id,
      amount,
      dueDate: String(data.dueDate || ""),
      status: String(data.status || "pending"),
      proposalId: data.proposalId ? String(data.proposalId) : null,
      description: String(data.description || ""),
      installmentNumber:
        data.installmentNumber == null ? null : Number(data.installmentNumber),
      installmentCount:
        data.installmentCount == null ? null : Number(data.installmentCount),
    });
  }

  const partners = Array.from(byPartner.values()).sort(
    (a, b) => b.aPagar - a.aPagar || a.contactName.localeCompare(b.contactName),
  );

  return {
    month: range.month,
    aPagar: partners.reduce((sum, p) => sum + p.aPagar, 0),
    pago: partners.reduce((sum, p) => sum + p.pago, 0),
    total: partners.reduce((sum, p) => sum + p.total, 0),
    partners,
  };
}
