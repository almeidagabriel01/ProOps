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
