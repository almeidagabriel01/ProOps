"use client";

import {
  collection,
  getDocs,
  limit,
  query,
  where,
  type DocumentData,
  type QueryConstraint,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { callApi } from "@/lib/api-client";
import type { Task, TaskContext, TaskInput, TaskPerson } from "@/types/task";

const COLLECTION = "tasks";
const MAX_TASKS = 500;

/**
 * Como a pessoa lê as tarefas. As rules só liberam a lista inteira da empresa
 * para o dono e os administradores; o membro precisa filtrar pelos próprios
 * (`audienceUids`), senão a consulta é recusada. A conta free lê o tenant
 * `demo`.
 */
export interface TaskReader {
  tenantId: string;
  uid: string;
  scope: "company" | "mine";
}

function str(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

export function toTask(id: string, data: DocumentData): Task {
  return {
    id,
    tenantId: String(data.tenantId ?? ""),
    title: String(data.title ?? "Tarefa"),
    notes: str(data.notes),
    dueAt: str(data.dueAt),
    assigneeId: str(data.assigneeId),
    assigneeName: str(data.assigneeName),
    mentionUids: Array.isArray(data.mentionUids) ? (data.mentionUids as string[]) : [],
    clientId: str(data.clientId),
    clientName: str(data.clientName),
    proposalId: str(data.proposalId),
    proposalTitle: str(data.proposalTitle),
    leadId: str(data.leadId),
    leadName: str(data.leadName),
    doneAt: str(data.doneAt),
    doneBy: str(data.doneBy),
    createdBy: str(data.createdBy),
    createdByName: str(data.createdByName),
    createdAt: str(data.createdAt),
    updatedAt: str(data.updatedAt),
  };
}

function readerConstraints(reader: TaskReader): QueryConstraint[] {
  const base = [where("tenantId", "==", reader.tenantId)];
  return reader.scope === "mine"
    ? [...base, where("audienceUids", "array-contains", reader.uid)]
    : base;
}

async function run(constraints: QueryConstraint[]): Promise<Task[]> {
  // Sem orderBy: igualdade e array-contains se resolvem pelos índices simples,
  // sem índice composto. A ordem é aplicada aqui.
  const snap = await getDocs(query(collection(db, COLLECTION), ...constraints, limit(MAX_TASKS)));
  return snap.docs
    .map((d) => toTask(d.id, d.data()))
    .sort((a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")));
}

/** Leitura direta no Firestore; toda escrita passa pela API. */
export const TasksService = {
  list(reader: TaskReader): Promise<Task[]> {
    if (!reader.tenantId) return Promise.resolve([]);
    return run(readerConstraints(reader));
  },

  /** As tarefas de um contato, proposta ou lead que a pessoa enxerga. */
  listByContext(reader: TaskReader, context: TaskContext): Promise<Task[]> {
    if (!reader.tenantId) return Promise.resolve([]);
    const filter = context.leadId
      ? where("leadId", "==", context.leadId)
      : context.proposalId
        ? where("proposalId", "==", context.proposalId)
        : context.clientId
          ? where("clientId", "==", context.clientId)
          : null;
    if (!filter) return Promise.resolve([]);
    return run([...readerConstraints(reader), filter]);
  },

  async people(): Promise<TaskPerson[]> {
    const response = await callApi<{ people: TaskPerson[] }>("/v1/tasks/people", "GET");
    return response.people ?? [];
  },

  async create(input: TaskInput): Promise<Task> {
    const response = await callApi<{ task: DocumentData & { id: string } }>("/v1/tasks", "POST", input);
    return toTask(response.task.id, response.task);
  },

  async update(
    id: string,
    input: Partial<Omit<TaskInput, "clientId" | "proposalId" | "leadId">> & { done?: boolean },
  ): Promise<Task> {
    const response = await callApi<{ task: DocumentData & { id: string } }>(
      `/v1/tasks/${id}`,
      "PUT",
      input,
    );
    return toTask(response.task.id, response.task);
  },

  async remove(id: string): Promise<void> {
    await callApi(`/v1/tasks/${id}`, "DELETE");
  },
};
