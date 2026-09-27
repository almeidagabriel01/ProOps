/**
 * Portal do cliente (capacidade `clientPortal`, Pro e Enterprise): uma página
 * por CONTATO, aberta por um link fixo e revogável, com as propostas, os
 * pagamentos, a obra e as notas fiscais dele.
 *
 * O portal não cria link nenhum ao abrir. Cada item leva à página pública que
 * já existe (proposta, lançamento, obra), e o link dela só é obtido ou criado
 * quando o cliente clica (`openPortalItem`). Abrir o portal é leitura pura.
 *
 * Tudo aqui é puro: o serviço lê o Firestore e passa os documentos crus.
 */

export const CLIENT_PORTAL_LINKS_COLLECTION = "client_portal_links";

/** Um link por contato: o id do doc é `{tenantId}_{clientId}`. */
export function portalLinkDocId(tenantId: string, clientId: string): string {
  return `${tenantId}_${clientId}`;
}

export const PORTAL_TOKEN_PATTERN = /^[A-Za-z0-9_-]{16,64}$/;

export type PortalProposalState = "approved" | "rejected" | "open";

export interface PortalProposal {
  id: string;
  title: string;
  code: string | null;
  state: PortalProposalState;
  value: number;
  createdAt: string | null;
  validUntil: string | null;
}

export type PortalPaymentStatus = "paid" | "pending" | "overdue";

export interface PortalPayment {
  id: string;
  description: string;
  amount: number;
  dueDate: string | null;
  status: PortalPaymentStatus;
  /** Entrada da proposta: vai primeiro na lista do que falta pagar. */
  isDownPayment: boolean;
}

export interface PortalProject {
  id: string;
  title: string;
  status: "active" | "completed";
  stagesDone: number;
  stagesTotal: number;
  deliveryAccepted: boolean;
}

export interface PortalInvoice {
  id: string;
  type: "nfe" | "nfse";
  number: string | null;
  amount: number;
  issuedAt: string | null;
  pdfUrl: string;
}

export interface PortalView {
  company: { name: string; logoUrl: string | null; primaryColor: string | null };
  client: { firstName: string };
  proposals: PortalProposal[];
  payments: PortalPayment[];
  /** A empresa recebe online (Asaas ligado e capacidade `onlinePayments`). */
  canPayOnline: boolean;
  projects: PortalProject[];
  invoices: PortalInvoice[];
}

type Doc = { id: string; data: Record<string, unknown> };

/** O que a coluna do quadro diz sobre a proposta, lido do doc do status. */
export interface KanbanStatusInfo {
  mappedStatus?: unknown;
  category?: unknown;
  label?: unknown;
}

function norm(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function str(value: unknown): string | null {
  const text = typeof value === "string" ? value.trim() : "";
  return text || null;
}

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Onde a proposta está no caminho até o cliente:
 * - `sent`: na coluna Enviada (o cliente já tem);
 * - `building`: em aberto, sendo montada (legado `in_progress`, a coluna
 *   padrão ou coluna mapeada para ela);
 * - `unknown`: coluna própria da empresa, que não diz se já foi enviada;
 * - `draft`: rascunho.
 * Aprovada e recusada seguem a leitura de `isStatusApproved` (valor legado,
 * coluna padrão, `mappedStatus`, categoria e, por último, o nome da coluna).
 */
export type ProposalStage = "approved" | "rejected" | "sent" | "building" | "unknown" | "draft";

export function classifyProposalStatus(status: unknown, kanban: KanbanStatusInfo | undefined): ProposalStage {
  const value = norm(status);
  if (value === "approved" || value === "default_2") return "approved";
  if (value === "rejected" || value === "default_3") return "rejected";
  if (value === "sent" || value === "default_1") return "sent";
  if (value === "in_progress" || value === "default_0") return "building";
  if (value === "draft" || !value) return "draft";
  if (!kanban) return "unknown";
  const mapped = norm(kanban.mappedStatus);
  if (mapped === "approved") return "approved";
  if (mapped === "rejected") return "rejected";
  if (mapped === "sent") return "sent";
  if (mapped === "draft") return "draft";
  if (mapped === "in_progress") return "building";
  const category = norm(kanban.category);
  if (category === "won") return "approved";
  if (category === "lost") return "rejected";
  const label = norm(kanban.label);
  if (label.includes("aprovad") || label.includes("ganha")) return "approved";
  if (label.includes("recusad") || label.includes("perdid")) return "rejected";
  if (label.includes("enviad")) return "sent";
  if (label.includes("rascunho")) return "draft";
  if (label.includes("em aberto")) return "building";
  return "unknown";
}

/**
 * A proposta só entra no portal depois de ir para o cliente: enviada,
 * aprovada ou recusada. Em coluna própria, que não diz se já foi enviada, vale
 * o fato de a empresa já ter gerado o link dela (`sharedIds`). Rascunho e "em
 * aberto" nunca aparecem. Mais novas primeiro.
 */
export function buildPortalProposals(
  docs: Doc[],
  kanban: Map<string, KanbanStatusInfo>,
  sharedIds: ReadonlySet<string> = new Set(),
): PortalProposal[] {
  const result: PortalProposal[] = [];
  for (const { id, data } of docs) {
    const stage = classifyProposalStatus(data.status, kanban.get(String(data.status ?? "")));
    if (stage === "draft" || stage === "building") continue;
    if (stage === "unknown" && !sharedIds.has(id)) continue;
    const state: PortalProposalState = stage === "approved" || stage === "rejected" ? stage : "open";
    const closed = data.closedValue;
    result.push({
      id,
      title: str(data.title) ?? "Proposta",
      code: str(data.proposalCode),
      state,
      value: state === "approved" && closed != null && Number.isFinite(Number(closed)) ? num(closed) : num(data.totalValue),
      createdAt: str(data.createdAt),
      validUntil: str(data.validUntil),
    });
  }
  return result.sort((a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")));
}

/**
 * Só o que o cliente deve à empresa: receita, fora a comissão (que tem o
 * `clientId` do PARCEIRO, não do comprador). Em aberto primeiro, a entrada à
 * frente e depois pelo vencimento; os pagos depois, os mais recentes antes.
 */
export function buildPortalPayments(docs: Doc[], today: string): PortalPayment[] {
  const items: PortalPayment[] = [];
  for (const { id, data } of docs) {
    if (data.type !== "income" || data.isCommission === true) continue;
    const dueDate = str(data.dueDate) ?? str(data.date);
    const raw = norm(data.status);
    const status: PortalPaymentStatus =
      raw === "paid" ? "paid" : raw === "overdue" || (dueDate !== null && dueDate < today) ? "overdue" : "pending";
    items.push({
      id,
      description: str(data.description) ?? "Parcela",
      amount: num(data.amount),
      dueDate,
      status,
      isDownPayment: data.isDownPayment === true,
    });
  }
  const open = items
    .filter((p) => p.status !== "paid")
    .sort(
      (a, b) =>
        Number(b.isDownPayment) - Number(a.isDownPayment) ||
        String(a.dueDate ?? "9999").localeCompare(String(b.dueDate ?? "9999")),
    );
  const paid = items
    .filter((p) => p.status === "paid")
    .sort((a, b) => String(b.dueDate ?? "").localeCompare(String(a.dueDate ?? "")));
  return [...open, ...paid];
}

/** Obra cancelada some; o resto mostra o avanço pelas etapas concluídas. */
export function buildPortalProjects(docs: Doc[]): PortalProject[] {
  const result: PortalProject[] = [];
  for (const { id, data } of docs) {
    if (data.status === "canceled") continue;
    const stages = Array.isArray(data.stages) ? (data.stages as Array<Record<string, unknown>>) : [];
    const delivery = (data.delivery ?? {}) as Record<string, unknown>;
    result.push({
      id,
      title: str(data.title) ?? "Obra",
      status: data.status === "completed" ? "completed" : "active",
      stagesDone: stages.filter((s) => s?.status === "done").length,
      stagesTotal: stages.length,
      deliveryAccepted: delivery.status === "accepted",
    });
  }
  return result;
}

/**
 * Só nota autorizada e com o PDF do provedor (que abre sem login). Cancelada,
 * rejeitada ou em processamento não é documento do cliente.
 */
export function buildPortalInvoices(docs: Doc[]): PortalInvoice[] {
  const result: PortalInvoice[] = [];
  for (const { id, data } of docs) {
    const pdfUrl = str(data.pdfUrl);
    if (data.status !== "authorized" || !pdfUrl || !/^https:\/\//i.test(pdfUrl)) continue;
    result.push({
      id,
      type: data.type === "nfse" ? "nfse" : "nfe",
      number: data.numero != null ? String(data.numero) : null,
      amount: num(data.valorTotal),
      issuedAt: str(data.authorizedAt) ?? str(data.createdAt),
      pdfUrl,
    });
  }
  return result.sort((a, b) => String(b.issuedAt ?? "").localeCompare(String(a.issuedAt ?? "")));
}

/** Só o primeiro nome: a página é aberta por link, sem login. */
/** Propostas que ainda não dizem pela coluna se já foram para o cliente. */
export function proposalsNeedingShareCheck(docs: Doc[], kanban: Map<string, KanbanStatusInfo>): string[] {
  return docs
    .filter(({ data }) => classifyProposalStatus(data.status, kanban.get(String(data.status ?? ""))) === "unknown")
    .map(({ id }) => id);
}

export function firstName(name: unknown): string {
  return String(name ?? "").trim().split(/\s+/)[0] ?? "";
}
