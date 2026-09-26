import { createHash } from "node:crypto";
import { z } from "zod";
import { db } from "../../init";
import { isValidCpfOrCnpj, onlyDigits } from "../../lib/br-document";
import { PDF_IRRELEVANT_PROPOSAL_FIELDS } from "./proposal-pdf.service";

/**
 * Aceite da proposta pelo cliente final, no link compartilhado.
 *
 * O aceite NÃO aprova a proposta: ele fica pendente até a empresa confirmar.
 * Aprovar direto do link gerava lançamentos, entrega no Drive e cobrança sobre
 * uma proposta que às vezes ainda precisava de ajuste, e desfazer lançamento é
 * justamente o que o ERP protege. Quem confirma é sempre alguém da equipe, pelo
 * mesmo caminho de mudar o status para aprovada.
 *
 * O aceite (nome, documento, data, IP, navegador e a versão aceita) fica
 * gravado na própria proposta.
 */
export const ONLINE_APPROVAL_ACTOR = "client_online_approval";

export const OnlineApprovalSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(3, "Informe o nome completo.")
      .max(120, "Nome muito longo."),
    document: z
      .string()
      .trim()
      .refine(isValidCpfOrCnpj, "CPF ou CNPJ inválido."),
    accepted: z.literal(true, { message: "É preciso aceitar a proposta." }),
  })
  .strict();

export type OnlineApprovalInput = z.infer<typeof OnlineApprovalSchema>;

/**
 * - `pending`: o cliente aceitou e a empresa ainda não confirmou.
 * - `confirmed`: a empresa aprovou a proposta com o aceite em aberto.
 * - `discarded`: a empresa descartou para ajustar (ou recusou a proposta).
 * - `invalidated`: a proposta mudou depois do aceite; o cliente aceitou outra versão.
 */
export type ClientAcceptanceStatus = "pending" | "confirmed" | "discarded" | "invalidated";

export interface ClientAcceptance {
  name: string;
  document: string;
  acceptedAt: string;
  ip: string | null;
  userAgent: string | null;
  sharedProposalId: string;
  status: ClientAcceptanceStatus;
  /** Conteúdo da proposta no momento do aceite (`proposalContentHash`). */
  contentHash: string;
  resolvedAt?: string;
  resolvedBy?: string;
}

/** Aceite antigo, gravado quando o link aprovava direto, conta como confirmado. */
export function acceptanceStatus(acceptance: unknown): ClientAcceptanceStatus | null {
  if (!acceptance || typeof acceptance !== "object") return null;
  const status = (acceptance as { status?: unknown }).status;
  return status === "pending" || status === "discarded" || status === "invalidated"
    ? status
    : "confirmed";
}

export function isAcceptancePending(acceptance: unknown): boolean {
  return acceptanceStatus(acceptance) === "pending";
}

function normalizeForHash(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizeForHash);
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined && v !== null && v !== "")
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => [k, normalizeForHash(v)]);
    return Object.fromEntries(entries);
  }
  return value;
}

/**
 * Impressão digital do que o cliente vê na proposta: os mesmos campos que
 * entram no PDF. Vazio, nulo e ausente contam igual, porque o formulário
 * reenvia todos os campos em cada salvamento e um `""` novo não é mudança.
 */
export function proposalContentHash(proposal: Record<string, unknown>): string {
  const relevant = Object.fromEntries(
    Object.entries(proposal).filter(([key]) => !PDF_IRRELEVANT_PROPOSAL_FIELDS.has(key)),
  );
  return createHash("sha256")
    .update(JSON.stringify(normalizeForHash(relevant)))
    .digest("hex");
}

/**
 * O que acontece com um aceite PENDENTE quando a empresa salva a proposta.
 * Devolve o novo estado, ou `null` quando nada muda.
 *
 * Mudança de conteúdo vence tudo: se a empresa editou e aprovou no mesmo
 * salvamento, a aprovação vale (é decisão dela), mas o aceite registrado é de
 * outra versão e não pode constar como confirmado.
 */
export function resolveAcceptanceOnSave(params: {
  acceptance: unknown;
  proposalAfter: Record<string, unknown>;
  isBeingApproved: boolean;
  closedWithoutApproval: boolean;
}): ClientAcceptanceStatus | null {
  if (!isAcceptancePending(params.acceptance)) return null;
  const accepted = params.acceptance as ClientAcceptance;
  if (accepted.contentHash !== proposalContentHash(params.proposalAfter)) {
    return "invalidated";
  }
  if (params.isBeingApproved) return "confirmed";
  if (params.closedWithoutApproval) return "discarded";
  return null;
}

export function buildClientAcceptance(params: {
  input: OnlineApprovalInput;
  ip: string | null | undefined;
  userAgent: string | null | undefined;
  sharedProposalId: string;
  contentHash: string;
  now?: Date;
}): ClientAcceptance {
  const userAgent = params.userAgent ? String(params.userAgent).slice(0, 300) : null;
  return {
    name: params.input.name.trim(),
    document: onlyDigits(params.input.document),
    acceptedAt: (params.now ?? new Date()).toISOString(),
    ip: params.ip ? String(params.ip).slice(0, 64) : null,
    userAgent,
    sharedProposalId: params.sharedProposalId,
    status: "pending",
    contentHash: params.contentHash,
  };
}

/** Hoje no fuso de Brasília, "YYYY-MM-DD" (a validade é uma data de calendário). */
export function todayInBrazil(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Vencida quando a data de validade já passou (o dia da validade ainda vale). */
export function isProposalExpired(
  validUntil: unknown,
  now: Date = new Date(),
): boolean {
  const date = String(validUntil ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  return date < todayInBrazil(now);
}

interface StatusColumn {
  id: string;
  order?: number;
  mappedStatus?: string | null;
  category?: string | null;
}

/**
 * O status que a aprovação grava. Precisa cair numa coluna do quadro do CRM:
 * empresa com funil personalizado pode ter uma coluna "ganha" sem
 * `mappedStatus`, e uma proposta com status "approved" contaria como aprovada
 * no backend sem aparecer em coluna nenhuma.
 */
export function pickApprovedStatus(columns: StatusColumn[]): string {
  const sorted = [...columns].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const mapped = sorted.find((c) => c.mappedStatus === "approved");
  if (mapped) return mapped.id;
  const won = sorted.find((c) => c.category === "won");
  if (won) return won.id;
  return "approved";
}

/** Rascunho, recusada ou coluna "perdida": a proposta fechou sem aprovação. */
export async function isStatusClosedWithoutApproval(
  status: string | undefined,
  tenantId: string,
): Promise<boolean> {
  if (!status) return false;
  if (status === "draft" || status === "rejected") return true;
  if (status.startsWith("default_") || ["in_progress", "sent", "approved"].includes(status)) {
    return false;
  }
  const column = await db.collection("kanban_statuses").doc(status).get();
  const data = column.data();
  if (!column.exists || data?.tenantId !== tenantId) return false;
  return data?.category === "lost" || data?.mappedStatus === "rejected";
}

export async function resolveApprovedStatusForTenant(
  tenantId: string,
): Promise<string> {
  const snap = await db
    .collection("kanban_statuses")
    .where("tenantId", "==", tenantId)
    .limit(50)
    .get();
  return pickApprovedStatus(
    snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Omit<StatusColumn, "id">) })),
  );
}
