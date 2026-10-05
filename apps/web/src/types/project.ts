/** Projeto de instalação: a obra depois da venda. Gravado só pelo backend. */

export type ProjectStatus = "active" | "completed" | "canceled";
export type StageStatus = "pending" | "in_progress" | "done";

export interface ProjectChecklistItem {
  id: string;
  text: string;
  done: boolean;
  doneAt?: string | null;
  doneBy?: string | null;
}

export interface ProjectPhoto {
  id: string;
  url: string;
  caption: string | null;
  uploadedAt?: string;
  uploadedBy?: string;
  uploadedByName?: string | null;
}

/**
 * Data marcada da etapa: espelho do evento da Agenda ligado a ela. A data mora
 * no evento; mover na Agenda (ou no Google) muda o que a obra mostra.
 */
export interface StageSchedule {
  eventId: string;
  isAllDay: boolean;
  startsAt: string | null;
  endsAt: string | null;
  startDate: string | null;
  endDate: string | null;
  startMs: number;
  endMs: number;
}

/** O que o agendamento manda: horário ou dia inteiro. */
export interface StageScheduleInput {
  isAllDay: boolean;
  startsAt?: string | null;
  endsAt?: string | null;
  startDate?: string | null;
  endDate?: string | null;
}

export interface ProjectStage {
  id: string;
  name: string;
  status: StageStatus;
  checklist: ProjectChecklistItem[];
  photos: ProjectPhoto[];
  completedAt: string | null;
  /** Ausente nas etapas criadas antes do agendamento existir. */
  schedule?: StageSchedule | null;
}

export interface ProjectDelivery {
  status: "none" | "sent" | "accepted";
  sharedProjectId?: string | null;
  acceptance: { name: string; document?: string; acceptedAt: string } | null;
}

/** Situação de um item da obra, marcada à mão (não mexe em estoque nem no financeiro). */
export type ProjectItemStatus = "pending" | "purchase_requested" | "in_stock" | "installed";

/** Medida da linha por medida (persiana, vidro, móvel): os campos de `pricingDetails`, sem valor. */
export type ProjectItemMeasure =
  | { mode: "curtain_meter"; width: number; height: number; panels: number }
  | { mode: "curtain_width"; width: number; panels: number }
  | { mode: "curtain_height"; width: number; maxHeight: number; panels: number };

/**
 * Um produto da proposta copiado para a obra. Sem preço, total nem forma de
 * pagamento: o técnico lê o projeto. Gravado só pelo backend
 * (`api/services/projects/project-items.ts`).
 */
export interface ProjectItem {
  id: string;
  productId: string;
  name: string;
  manufacturer: string | null;
  quantity: number;
  /** O grupo da proposta (solução, sistema). */
  groupName: string | null;
  /** O local da obra. */
  placeName: string | null;
  measure: ProjectItemMeasure | null;
  status: ProjectItemStatus;
  statusAt: string | null;
  statusBy: string | null;
  statusByName: string | null;
}

export interface Project {
  id: string;
  tenantId: string;
  proposalId: string | null;
  proposalTitle: string | null;
  proposalCode: string | null;
  clientId: string | null;
  clientName: string | null;
  clientPhone: string | null;
  clientEmail: string | null;
  address: string | null;
  title: string;
  status: ProjectStatus;
  stages: ProjectStage[];
  /** Vazio nos projetos avulsos e nos criados antes da lista existir. */
  items: ProjectItem[];
  assigneeId: string | null;
  assigneeName: string | null;
  startDate: string | null;
  dueDate: string | null;
  notes: string | null;
  delivery: ProjectDelivery;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface StageTemplate {
  name: string;
  checklist: string[];
}

/** Na aprovação: perguntar se tem instalação (padrão), criar sempre ou nunca. */
export type ProjectOnApproval = "ask" | "always" | "never";

export interface ProjectSettings {
  onApproval: ProjectOnApproval;
  stageTemplate: StageTemplate[];
}
