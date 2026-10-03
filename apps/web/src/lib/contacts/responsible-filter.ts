/**
 * Filtro "Responsável" das listas de contatos e de propostas, em módulo puro.
 *
 * Fica no endereço (`resp`) como texto curto: `eu` (quem está logado), `m:<uid>`
 * (uma pessoa da equipe) ou `p:<contato>` (um parceiro externo). "eu" é
 * guardado como "eu", e não como o uid, para o link continuar valendo para
 * quem o abrir.
 */

export type ResponsibleFilter =
  | { kind: "all" }
  | { kind: "member"; id: string }
  | { kind: "partner"; id: string };

export const MY_RESPONSIBLE_FILTER = "eu";

export function parseResponsibleFilter(
  value: string | null | undefined,
  currentUserId: string | null | undefined,
): ResponsibleFilter {
  const raw = (value ?? "").trim();
  if (raw === MY_RESPONSIBLE_FILTER) {
    return currentUserId ? { kind: "member", id: currentUserId } : { kind: "all" };
  }
  if (raw.startsWith("m:") && raw.length > 2) return { kind: "member", id: raw.slice(2) };
  if (raw.startsWith("p:") && raw.length > 2) return { kind: "partner", id: raw.slice(2) };
  return { kind: "all" };
}

interface ResponsibleRecord {
  responsibleMemberId?: string | null;
  partnerContactIds?: readonly string[] | null;
}

export function matchesResponsibleFilter(record: ResponsibleRecord, filter: ResponsibleFilter): boolean {
  if (filter.kind === "member") return record.responsibleMemberId === filter.id;
  if (filter.kind === "partner") return (record.partnerContactIds ?? []).includes(filter.id);
  return true;
}
