/** Tarefa: o "a fazer" com responsável, ligado ou não a contato, proposta ou lead. */
export interface Task {
  id: string;
  tenantId: string;
  title: string;
  notes: string | null;
  /** Dia no formato YYYY-MM-DD, ou sem prazo. */
  dueAt: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
  mentionUids: string[];
  clientId: string | null;
  clientName: string | null;
  proposalId: string | null;
  proposalTitle: string | null;
  leadId: string | null;
  leadName: string | null;
  doneAt: string | null;
  doneBy: string | null;
  createdBy: string | null;
  createdByName: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

/** A que a tarefa está ligada, quando nasce de um contato, proposta ou lead. */
export interface TaskContext {
  clientId?: string;
  clientName?: string;
  proposalId?: string;
  proposalTitle?: string;
  leadId?: string;
  leadName?: string;
}

export interface TaskPerson {
  id: string;
  name: string;
}

export interface TaskInput {
  title: string;
  notes?: string;
  dueAt?: string | null;
  assigneeId?: string | null;
  mentionUids?: string[];
  clientId?: string;
  proposalId?: string;
  leadId?: string;
}
