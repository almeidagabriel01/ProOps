export type AttentionReason = "acceptance" | "change_request" | "expiring" | "stale";

interface ProposalLike {
  id: string;
  title?: string;
  clientName?: string;
  validUntil?: string;
  updatedAt?: string;
}

export interface AttentionItem {
  id: string;
  title: string;
  clientName: string;
  reason: AttentionReason;
  /** O motivo em palavras: "Vence em 3 dias", "Sem movimento há 9 dias". */
  detail: string;
  href: string;
}

export interface AttentionInput {
  acceptances: ProposalLike[];
  changeRequests: ProposalLike[];
  expiring: ProposalLike[];
  stale: ProposalLike[];
  today: Date;
  max?: number;
}

export interface AttentionResult {
  items: AttentionItem[];
  /** Quantas propostas por motivo, depois de tirar as repetidas. */
  counts: Record<AttentionReason, number>;
  total: number;
}

/** Dias sem movimento para a proposta enviada contar como parada. */
export const STALE_AFTER_DAYS = 7;
/** Janela de "vence em breve", contando hoje. */
export const EXPIRING_WITHIN_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/** `validUntil` chega como "AAAA-MM-DD" ou ISO; vale o dia. */
function daysUntil(validUntil: string, today: Date): number {
  const [y, m, d] = validUntil.slice(0, 10).split("-").map(Number);
  return Math.round((new Date(y, m - 1, d).getTime() - startOfDay(today)) / DAY_MS);
}

function daysSince(iso: string, today: Date): number {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return 0;
  return Math.max(0, Math.round((startOfDay(today) - startOfDay(then)) / DAY_MS));
}

function expiringDetail(days: number): string {
  if (days <= 0) return "Vence hoje";
  if (days === 1) return "Vence amanhã";
  return `Vence em ${days} dias`;
}

/**
 * O que nas propostas pede ação, na ordem em que vale agir: o cliente que já
 * aceitou (a venda espera só a empresa confirmar), o que pediu mudança, a que
 * vence em breve e a que parou. Uma proposta aparece uma vez, pelo motivo mais
 * urgente.
 */
export function buildAttentionItems({
  acceptances,
  changeRequests,
  expiring,
  stale,
  today,
  max = 5,
}: AttentionInput): AttentionResult {
  const seen = new Set<string>();
  const all: AttentionItem[] = [];
  const counts: Record<AttentionReason, number> = {
    acceptance: 0,
    change_request: 0,
    expiring: 0,
    stale: 0,
  };

  const add = (
    list: ProposalLike[],
    reason: AttentionReason,
    detail: (p: ProposalLike) => string,
    href: (p: ProposalLike) => string,
  ) => {
    for (const proposal of list) {
      if (seen.has(proposal.id)) continue;
      seen.add(proposal.id);
      counts[reason] += 1;
      all.push({
        id: proposal.id,
        title: proposal.title || "Proposta sem título",
        clientName: proposal.clientName || "",
        reason,
        detail: detail(proposal),
        href: href(proposal),
      });
    }
  };

  add(
    acceptances,
    "acceptance",
    () => "Aceite do cliente a confirmar",
    (p) => `/proposals?aceite=${encodeURIComponent(p.id)}`,
  );
  add(
    changeRequests,
    "change_request",
    () => "Cliente pediu mudanças",
    (p) => `/proposals?ajuste=${encodeURIComponent(p.id)}`,
  );
  add(
    [...expiring].sort((a, b) => (a.validUntil ?? "").localeCompare(b.validUntil ?? "")),
    "expiring",
    (p) => expiringDetail(daysUntil(p.validUntil ?? "", today)),
    (p) => `/proposals/${encodeURIComponent(p.id)}/view`,
  );
  add(
    [...stale].sort((a, b) => (a.updatedAt ?? "").localeCompare(b.updatedAt ?? "")),
    "stale",
    (p) => `Sem movimento há ${daysSince(p.updatedAt ?? "", today)} dias`,
    (p) => `/proposals/${encodeURIComponent(p.id)}/view`,
  );

  return { items: all.slice(0, max), counts, total: all.length };
}
