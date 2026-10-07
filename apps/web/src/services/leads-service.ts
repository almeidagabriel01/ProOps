"use client";

import { collection, getDocs, limit, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { callApi } from "@/lib/api-client";

export type LeadStage = "novo" | "contato" | "qualificado" | "convertido" | "perdido";
export type LeadSource =
  | "indicacao"
  | "instagram"
  | "site"
  | "whatsapp"
  | "google"
  | "arquiteto"
  | "outro";
export type ActivityType = "nota" | "ligacao" | "whatsapp" | "visita" | "reuniao" | "tarefa";

export interface Lead {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  company: string | null;
  source: LeadSource;
  stage: LeadStage;
  estimatedValue: number | null;
  notes: string | null;
  nextAction: string | null;
  /** YYYY-MM-DD */
  nextActionAt: string | null;
  lostReason: string | null;
  clientId: string | null;
  ownerId: string | null;
  ownerName: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface LeadInput {
  name: string;
  phone?: string;
  email?: string;
  company?: string;
  source?: LeadSource;
  stage?: LeadStage;
  estimatedValue?: number | null;
  notes?: string;
  nextAction?: string;
  nextActionAt?: string | null;
  lostReason?: string;
  /** Só na edição, e só com "Trocar dono do lead". */
  ownerId?: string;
}

export interface Activity {
  id: string;
  leadId: string | null;
  clientId: string | null;
  type: ActivityType;
  title: string;
  /** YYYY-MM-DD */
  dueAt: string | null;
  doneAt: string | null;
  createdBy: string | null;
  createdByName: string | null;
  createdAt: string | null;
}

const MAX_LEADS = 500;
const MAX_ACTIVITIES = 200;

function toLead(id: string, data: Record<string, unknown>): Lead {
  const str = (v: unknown) => (typeof v === "string" && v ? v : null);
  return {
    id,
    name: String(data.name ?? ""),
    phone: str(data.phone),
    email: str(data.email),
    company: str(data.company),
    source: (data.source as LeadSource) ?? "outro",
    stage: (data.stage as LeadStage) ?? "novo",
    estimatedValue: typeof data.estimatedValue === "number" ? data.estimatedValue : null,
    notes: str(data.notes),
    nextAction: str(data.nextAction),
    nextActionAt: str(data.nextActionAt),
    lostReason: str(data.lostReason),
    clientId: str(data.clientId),
    ownerId: str(data.ownerId),
    ownerName: str(data.ownerName),
    createdAt: str(data.createdAt),
    updatedAt: str(data.updatedAt),
  };
}

function toActivity(id: string, data: Record<string, unknown>): Activity {
  const str = (v: unknown) => (typeof v === "string" && v ? v : null);
  return {
    id,
    leadId: str(data.leadId),
    clientId: str(data.clientId),
    type: (data.type as ActivityType) ?? "nota",
    title: String(data.title ?? ""),
    dueAt: str(data.dueAt),
    doneAt: str(data.doneAt),
    createdBy: str(data.createdBy),
    createdByName: str(data.createdByName),
    createdAt: str(data.createdAt),
  };
}

const newestFirst = <T extends { createdAt: string | null }>(a: T, b: T) =>
  String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? ""));

/**
 * Leitura direta no Firestore, como o resto do CRM: assim a conta free lê o
 * tenant de demonstração (`tenantId` "demo"). A escrita passa sempre pela API,
 * que aplica permissão e plano.
 */
export const LeadsService = {
  async list(tenantId: string): Promise<Lead[]> {
    if (!tenantId) return [];
    const snap = await getDocs(
      query(collection(db, "leads"), where("tenantId", "==", tenantId), limit(MAX_LEADS)),
    );
    return snap.docs.map((d) => toLead(d.id, d.data())).sort(newestFirst);
  },

  async create(input: LeadInput): Promise<Lead> {
    const res = await callApi<{ lead: Lead }>("/v1/leads", "POST", input);
    return res.lead;
  },

  async update(id: string, input: Partial<LeadInput>): Promise<Lead> {
    const res = await callApi<{ lead: Lead }>(`/v1/leads/${id}`, "PUT", input);
    return res.lead;
  },

  async remove(id: string): Promise<void> {
    await callApi(`/v1/leads/${id}`, "DELETE");
  },

  /** Vira contato (ou reaproveita o já ligado) e devolve o id do contato. */
  async convert(id: string): Promise<{ clientId: string; created: boolean }> {
    return callApi<{ clientId: string; created: boolean }>(`/v1/leads/${id}/convert`, "POST");
  },
};

export const ActivitiesService = {
  async listByLead(tenantId: string, leadId: string): Promise<Activity[]> {
    if (!tenantId || !leadId) return [];
    const snap = await getDocs(
      query(
        collection(db, "activities"),
        where("tenantId", "==", tenantId),
        where("leadId", "==", leadId),
        limit(MAX_ACTIVITIES),
      ),
    );
    return snap.docs.map((d) => toActivity(d.id, d.data())).sort(newestFirst);
  },

  async create(input: {
    leadId?: string;
    clientId?: string;
    type: ActivityType;
    title: string;
    dueAt?: string | null;
  }): Promise<Activity> {
    const res = await callApi<{ activity: Activity }>("/v1/activities", "POST", input);
    return res.activity;
  },

  async setDone(id: string, done: boolean): Promise<Activity> {
    const res = await callApi<{ activity: Activity }>(`/v1/activities/${id}`, "PUT", { done });
    return res.activity;
  },

  async remove(id: string): Promise<void> {
    await callApi(`/v1/activities/${id}`, "DELETE");
  },
};
