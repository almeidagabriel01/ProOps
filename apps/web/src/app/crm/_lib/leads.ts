import type { ActivityType, Lead, LeadSource, LeadStage } from "@/services/leads-service";

/** Etapas fixas do funil de leads, na ordem das colunas. */
export const LEAD_STAGES: { id: LeadStage; label: string; color: string }[] = [
  { id: "novo", label: "Novo", color: "#64748b" },
  { id: "contato", label: "Em contato", color: "#3b82f6" },
  { id: "qualificado", label: "Qualificado", color: "#8b5cf6" },
  { id: "convertido", label: "Convertido", color: "#10b981" },
  { id: "perdido", label: "Perdido", color: "#ef4444" },
];

export const LEAD_SOURCE_LABELS: Record<LeadSource, string> = {
  indicacao: "Indicação",
  instagram: "Instagram",
  site: "Site",
  whatsapp: "WhatsApp",
  google: "Google",
  arquiteto: "Arquiteto",
  outro: "Outro",
};

export const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  nota: "Nota",
  ligacao: "Ligação",
  whatsapp: "WhatsApp",
  visita: "Visita",
  reuniao: "Reunião",
  tarefa: "Tarefa",
};

export function isLeadOpen(stage: LeadStage): boolean {
  return stage !== "convertido" && stage !== "perdido";
}

export function groupLeadsByStage(leads: Lead[]): Record<LeadStage, Lead[]> {
  const groups = Object.fromEntries(LEAD_STAGES.map((s) => [s.id, [] as Lead[]])) as Record<
    LeadStage,
    Lead[]
  >;
  for (const lead of leads) (groups[lead.stage] ?? groups.novo).push(lead);
  return groups;
}

export type NextActionState = "overdue" | "today" | "upcoming" | null;

/**
 * Situação da próxima ação de um lead ABERTO frente a `today` (YYYY-MM-DD).
 * Lead fechado não cobra ação nenhuma.
 */
export function nextActionState(lead: Pick<Lead, "stage" | "nextActionAt">, today: string): NextActionState {
  if (!lead.nextActionAt || !isLeadOpen(lead.stage)) return null;
  if (lead.nextActionAt < today) return "overdue";
  if (lead.nextActionAt === today) return "today";
  return "upcoming";
}

/** Dia de hoje no fuso de Brasília, no mesmo formato gravado nos leads. */
export function todayInBrazil(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Soma do valor estimado dos leads abertos (o "funil" em reais). */
export function openPipelineValue(leads: Lead[]): number {
  return leads.reduce(
    (sum, l) => (isLeadOpen(l.stage) && l.estimatedValue ? sum + l.estimatedValue : sum),
    0,
  );
}
