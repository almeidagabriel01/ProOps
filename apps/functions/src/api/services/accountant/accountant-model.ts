/**
 * Link do contador: leitura, sem login, do financeiro da empresa num período
 * (DRE, lançamentos, notas emitidas e notas de entrada). Puro: o serviço lê
 * o Firestore e passa os documentos crus. Só sai o que o contador precisa;
 * nada de id de carteira, de usuário ou de caminho no Storage.
 */

export const ACCOUNTANT_LINKS_COLLECTION = "accountant_links";
export const ACCOUNTANT_TOKEN_PATTERN = /^[A-Za-z0-9_-]{16,64}$/;

type Doc = { id: string; data: Record<string, unknown> };

function str(value: unknown): string | null {
  const text = typeof value === "string" ? value.trim() : "";
  return text || null;
}

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Data de Brasília (UTC-3) de um ISO, `YYYY-MM-DD`. */
function brazilDate(iso: string | null): string | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return iso.slice(0, 10);
  return new Date(ms - 3 * 3_600_000).toISOString().slice(0, 10);
}

export interface AccountantTransaction {
  id: string;
  description: string;
  type: "income" | "expense";
  status: "paid" | "pending" | "overdue";
  date: string | null;
  dueDate: string | null;
  paidAt: string | null;
  amount: number;
  /** Custos extras somados ao valor (os pendentes também). */
  extraCosts: number;
  category: string | null;
  contact: string | null;
  wallet: string | null;
  installment: string | null;
}

/**
 * Os lançamentos do período, no que interessa ao contador. "No período" é ter
 * a data do lançamento ou o pagamento dentro dele, a mesma união do DRE.
 */
export function buildAccountantTransactions(
  docs: Doc[],
  params: { from: string; to: string; walletNames: Map<string, string>; today: string },
): AccountantTransaction[] {
  const inRange = (date: string | null) => Boolean(date && date.slice(0, 7) >= params.from && date.slice(0, 7) <= params.to);
  const rows: AccountantTransaction[] = [];
  for (const { id, data } of docs) {
    if (data.type !== "income" && data.type !== "expense") continue;
    const date = str(data.date)?.slice(0, 10) ?? null;
    const paidAt = brazilDate(str(data.paidAt));
    if (!inRange(date) && !inRange(paidAt)) continue;
    const dueDate = str(data.dueDate)?.slice(0, 10) ?? null;
    const raw = data.status;
    const status: AccountantTransaction["status"] =
      raw === "paid" ? "paid" : raw === "overdue" || (dueDate !== null && dueDate < params.today) ? "overdue" : "pending";
    const extras = Array.isArray(data.extraCosts) ? (data.extraCosts as Array<Record<string, unknown>>) : [];
    const wallet = str(data.wallet);
    const number = num(data.installmentNumber);
    const count = num(data.installmentCount);
    rows.push({
      id,
      description: str(data.description) ?? "",
      type: data.type,
      status,
      date,
      dueDate,
      paidAt: status === "paid" ? paidAt ?? date : null,
      amount: round(num(data.amount)),
      extraCosts: round(extras.reduce((sum, e) => sum + num(e.amount), 0)),
      category: str(data.category),
      contact: str(data.clientName),
      wallet: wallet ? params.walletNames.get(wallet) ?? wallet : null,
      installment: data.isInstallment === true && count > 0 ? `${number}/${count}` : null,
    });
  }
  return rows.sort((a, b) => String(a.date ?? "").localeCompare(String(b.date ?? "")));
}

export interface AccountantInvoice {
  id: string;
  type: "nfe" | "nfse";
  number: string | null;
  series: string | null;
  status: "authorized" | "cancelled";
  amount: number;
  contact: string | null;
  issuedAt: string | null;
  cancelledAt: string | null;
  hasPdf: boolean;
  hasXml: boolean;
}

/** Notas emitidas que valem para o fisco: autorizadas e canceladas. */
export function buildAccountantInvoices(docs: Doc[]): AccountantInvoice[] {
  const rows: AccountantInvoice[] = [];
  for (const { id, data } of docs) {
    if (data.status !== "authorized" && data.status !== "cancelled") continue;
    rows.push({
      id,
      type: data.type === "nfse" ? "nfse" : "nfe",
      number: data.numero != null ? String(data.numero) : null,
      series: data.serie != null ? String(data.serie) : null,
      status: data.status,
      amount: round(num(data.valorTotal)),
      contact: str(data.clientName),
      issuedAt: brazilDate(str(data.authorizedAt) ?? str(data.createdAt)),
      cancelledAt: brazilDate(str(data.cancelledAt)),
      hasPdf: Boolean(str(data.storagePdfPath) || str(data.pdfUrl)),
      hasXml: Boolean(str(data.storageXmlPath) || str(data.xmlUrl)),
    });
  }
  return rows.sort((a, b) => String(a.issuedAt ?? "").localeCompare(String(b.issuedAt ?? "")));
}

export interface AccountantReceivedInvoice {
  id: string;
  issuer: string;
  issuerCnpj: string;
  number: string | null;
  series: string | null;
  issuedAt: string | null;
  amount: number;
  status: "resumo" | "completa" | "cancelada";
  hasXml: boolean;
}

export function buildAccountantReceived(docs: Doc[]): AccountantReceivedInvoice[] {
  return docs
    .map(({ id, data }) => ({
      id,
      issuer: str(data.emitenteNome) ?? "",
      issuerCnpj: str(data.emitenteCnpj) ?? "",
      number: data.numero != null ? String(data.numero) : null,
      series: data.serie != null ? String(data.serie) : null,
      issuedAt: str(data.dataEmissao)?.slice(0, 10) ?? null,
      amount: round(num(data.valorTotal)),
      status: (data.status === "cancelada" || data.status === "completa" ? data.status : "resumo") as AccountantReceivedInvoice["status"],
      hasXml: Boolean(str(data.storageXmlPath)),
    }))
    .sort((a, b) => String(a.issuedAt ?? "").localeCompare(String(b.issuedAt ?? "")));
}
