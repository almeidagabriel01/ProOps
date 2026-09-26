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

export interface ProjectStage {
  id: string;
  name: string;
  status: StageStatus;
  checklist: ProjectChecklistItem[];
  photos: ProjectPhoto[];
  completedAt: string | null;
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
