import { z } from "zod";
import { db } from "../../init";
import { isValidCpfOrCnpj, onlyDigits } from "../../lib/br-document";

/**
 * Aprovação da proposta pelo cliente final, no link compartilhado.
 *
 * Quem aprova não é usuário do ERP: o `createdById` dos lançamentos gerados e o
 * autor da nota automática ficam com este marcador, e o aceite (nome,
 * documento, data, IP e navegador) fica gravado na própria proposta.
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

export interface ClientAcceptance {
  name: string;
  document: string;
  acceptedAt: string;
  ip: string | null;
  userAgent: string | null;
  sharedProposalId: string;
}

export function buildClientAcceptance(params: {
  input: OnlineApprovalInput;
  ip: string | null | undefined;
  userAgent: string | null | undefined;
  sharedProposalId: string;
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
