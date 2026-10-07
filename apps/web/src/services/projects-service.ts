"use client";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  where,
  type DocumentData,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { callApi, callPublicApi } from "@/lib/api-client";
import type { ScheduleLike } from "@/lib/projects/stage-schedule";
import type { Proposal } from "@/types/proposal";
import type {
  Project,
  ProjectChecklistItem,
  ProjectItem,
  ProjectItemStatus,
  ProjectPhoto,
  ProjectSettings,
  ProjectStage,
  ProjectStatus,
  StageSchedule,
  StageScheduleInput,
  StageStatus,
} from "@/types/project";
import { ownerFilter } from "@/lib/permissions/query-scope";

const COLLECTION = "projects";
const MAX_PROJECTS = 300;

function str(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

export function toProject(id: string, data: DocumentData): Project {
  return {
    id,
    tenantId: String(data.tenantId ?? ""),
    proposalId: str(data.proposalId),
    proposalTitle: str(data.proposalTitle),
    proposalCode: str(data.proposalCode),
    clientId: str(data.clientId),
    clientName: str(data.clientName),
    clientPhone: str(data.clientPhone),
    clientEmail: str(data.clientEmail),
    address: str(data.address),
    title: String(data.title ?? "Projeto"),
    status: (data.status as ProjectStatus) ?? "active",
    stages: Array.isArray(data.stages) ? (data.stages as ProjectStage[]) : [],
    items: Array.isArray(data.items) ? (data.items as ProjectItem[]) : [],
    assigneeId: str(data.assigneeId),
    assigneeName: str(data.assigneeName),
    startDate: str(data.startDate),
    dueDate: str(data.dueDate),
    notes: str(data.notes),
    delivery: data.delivery ?? { status: "none", acceptance: null },
    createdAt: str(data.createdAt),
    updatedAt: str(data.updatedAt),
  };
}

/**
 * Leitura direta no Firestore, como o CRM: é o que faz a conta de
 * demonstração enxergar o projeto de exemplo (tenant "demo"). Toda escrita
 * passa pela API, que aplica permissão de membro e plano.
 */
export const ProjectsService = {
  async list(tenantId: string): Promise<Project[]> {
    if (!tenantId) return [];
    // "Só os meus" (o técnico da obra): as rules recusam a lista sem o filtro.
    const owner = await ownerFilter("projects");
    const snap = await getDocs(
      query(
        collection(db, COLLECTION),
        where("tenantId", "==", tenantId),
        ...(owner ? [where(owner.field, "==", owner.uid)] : []),
        limit(MAX_PROJECTS),
      ),
    );
    return snap.docs
      .map((d) => toProject(d.id, d.data()))
      .sort((a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")));
  },

  /** O projeto de uma proposta tem id determinístico (`proposal_{id}`). */
  async getByProposal(proposalId: string): Promise<Project | null> {
    const snap = await getDoc(doc(db, COLLECTION, `proposal_${proposalId}`));
    return snap.exists() ? toProject(snap.id, snap.data()) : null;
  },

  /** O detalhe acompanha em tempo real: técnico marcando o checklist na obra aparece na hora. */
  subscribe(
    projectId: string,
    onChange: (project: Project | null) => void,
    onError: (error: Error) => void,
  ): () => void {
    return onSnapshot(
      doc(db, COLLECTION, projectId),
      (snap) => onChange(snap.exists() ? toProject(snap.id, snap.data()) : null),
      onError,
    );
  },

  create: (input: { proposalId?: string; clientId?: string; title?: string }) =>
    callApi<{ projectId: string; created: boolean }>("/v1/projects", "POST", input),

  update: (
    id: string,
    input: Partial<{
      title: string;
      status: ProjectStatus;
      assigneeId: string | null;
      startDate: string | null;
      dueDate: string | null;
      notes: string | null;
      address: string | null;
    }>,
  ) => callApi(`/v1/projects/${id}`, "PUT", input),

  remove: (id: string) => callApi(`/v1/projects/${id}`, "DELETE"),

  /**
   * As linhas de produto e os ambientes da proposta da obra, sem preço, para
   * registrar os aparelhos instalados. Pela API porque quem registra costuma
   * ser o técnico, que não lê proposta pelo SDK.
   */
  getProposalEquipmentSource: (id: string) =>
    callApi<Pick<Proposal, "products" | "sistemas">>(`/v1/projects/${id}/proposal-equipment`),

  updateStage: (id: string, stageId: string, input: { name?: string; status?: StageStatus }) =>
    callApi<{ stage: ProjectStage }>(`/v1/projects/${id}/stages/${stageId}`, "PUT", input),

  /** Marca (ou remarca) a visita da etapa: vira um evento na Agenda. */
  scheduleStage: (id: string, stageId: string, input: StageScheduleInput) =>
    callApi<{ schedule: StageSchedule | null }>(`/v1/projects/${id}/stages/${stageId}/schedule`, "PUT", input),

  /** Desmarca a visita: o evento sai da Agenda (e do Google). */
  unscheduleStage: (id: string, stageId: string) =>
    callApi<{ success: boolean }>(`/v1/projects/${id}/stages/${stageId}/schedule`, "DELETE"),

  addChecklistItem: (id: string, stageId: string, text: string) =>
    callApi<{ item: ProjectChecklistItem }>(`/v1/projects/${id}/stages/${stageId}/checklist`, "POST", { text }),

  toggleChecklistItem: (id: string, stageId: string, itemId: string, done: boolean) =>
    callApi<{ item: ProjectChecklistItem }>(
      `/v1/projects/${id}/stages/${stageId}/checklist/${itemId}`,
      "PUT",
      { done },
    ),

  deleteChecklistItem: (id: string, stageId: string, itemId: string) =>
    callApi(`/v1/projects/${id}/stages/${stageId}/checklist/${itemId}`, "DELETE"),

  uploadPhoto: (id: string, stageId: string, dataUrl: string, caption?: string) =>
    callApi<{ photo: ProjectPhoto }>(`/v1/projects/${id}/stages/${stageId}/photos`, "POST", {
      dataUrl,
      ...(caption ? { caption } : {}),
    }),

  deletePhoto: (id: string, stageId: string, photoId: string) =>
    callApi(`/v1/projects/${id}/stages/${stageId}/photos/${photoId}`, "DELETE"),

  /** Traz os produtos da proposta para a obra que ainda não tem a lista. */
  importItems: (id: string) => callApi<{ count: number }>(`/v1/projects/${id}/items/import`, "POST"),

  /** Marca um ou vários itens da obra (compra, estoque, instalado). */
  updateItemsStatus: (id: string, itemIds: string[], status: ProjectItemStatus) =>
    callApi<{ changed: number }>(`/v1/projects/${id}/items/status`, "PUT", { itemIds, status }),

  deliveryLink: (id: string) =>
    callApi<{ url: string }>(`/v1/projects/${id}/delivery-link`, "POST"),

  assignees: async (): Promise<Array<{ id: string; name: string }>> => {
    const res = await callApi<{ assignees: Array<{ id: string; name: string }> }>(
      "/v1/projects/assignees",
      "GET",
    );
    return res.assignees;
  },

  getSettings: async (): Promise<ProjectSettings> => {
    const res = await callApi<{ settings: ProjectSettings }>("/v1/projects/settings", "GET");
    return res.settings;
  },

  saveSettings: async (input: Partial<ProjectSettings>): Promise<ProjectSettings> => {
    const res = await callApi<{ settings: ProjectSettings }>("/v1/projects/settings", "PUT", input);
    return res.settings;
  },
};

export interface SharedProjectView {
  title: string;
  clientName: string | null;
  address: string | null;
  status: ProjectStatus;
  stages: Array<{
    id: string;
    name: string;
    status: StageStatus;
    completedAt: string | null;
    /** Data marcada da visita, sem o id do evento da Agenda. */
    schedule?: ScheduleLike | null;
    checklist: Array<{ id: string; text: string; done: boolean }>;
    photos: Array<{ id: string; url: string; caption: string | null }>;
  }>;
  delivery: {
    status: "none" | "sent" | "accepted";
    acceptance: { name: string; acceptedAt: string } | null;
  };
}

export interface SharedProjectTenant {
  name: string | null;
  logoUrl: string | null;
  primaryColor: string | null;
}

/** Link público da entrega da obra (sem login). */
export const SharedProjectService = {
  get: (token: string) =>
    callPublicApi<{ project: SharedProjectView; tenant: SharedProjectTenant }>(
      `/v1/share/project/${token}`,
      "GET",
    ),

  accept: (token: string, input: { name: string; document: string; accepted: true }) =>
    callPublicApi<{ acceptedAt: string }>(`/v1/share/project/${token}/accept`, "POST", input),
};
