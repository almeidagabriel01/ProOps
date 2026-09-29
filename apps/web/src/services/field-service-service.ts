"use client";

import {
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  query,
  where,
  type DocumentData,
  type QueryConstraint,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { callApi, callPublicApi } from "@/lib/api-client";
import type {
  CompleteServiceOrderInput,
  CompleteServiceOrderResult,
  CustomerEquipment,
  EquipmentInput,
  ServiceOrder,
  ServiceOrderInput,
  ServiceOrderPhoto,
  ServiceOrderStatus,
} from "@/types/field-service";

const EQUIPMENT = "customer_equipment";
const ORDERS = "service_orders";
const MAX_ITEMS = 300;

function str(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

function arr<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export function toEquipment(id: string, data: DocumentData): CustomerEquipment {
  return {
    id,
    tenantId: String(data.tenantId ?? ""),
    clientId: String(data.clientId ?? ""),
    clientName: String(data.clientName ?? ""),
    name: String(data.name ?? "Equipamento"),
    type: str(data.type),
    brand: str(data.brand),
    model: str(data.model),
    serialNumber: str(data.serialNumber),
    capacity: str(data.capacity),
    location: str(data.location),
    installedAt: str(data.installedAt),
    warrantyUntil: str(data.warrantyUntil),
    notes: str(data.notes),
    status: data.status === "inactive" ? "inactive" : "active",
    projectId: str(data.projectId),
    lastServiceAt: str(data.lastServiceAt),
    lastServiceOrderId: str(data.lastServiceOrderId),
    createdAt: str(data.createdAt),
  };
}

export function toServiceOrder(id: string, data: DocumentData): ServiceOrder {
  const totals = (data.totals ?? {}) as Partial<ServiceOrder["totals"]>;
  return {
    id,
    tenantId: String(data.tenantId ?? ""),
    number: Number(data.number ?? 0),
    code: String(data.code ?? ""),
    clientId: String(data.clientId ?? ""),
    clientName: String(data.clientName ?? ""),
    clientPhone: str(data.clientPhone),
    address: str(data.address),
    type: (data.type as ServiceOrder["type"]) ?? "corrective",
    priority: (data.priority as ServiceOrder["priority"]) ?? "normal",
    status: (data.status as ServiceOrderStatus) ?? "open",
    title: String(data.title ?? ""),
    description: str(data.description),
    equipmentIds: arr<string>(data.equipmentIds),
    equipmentLabels: arr<string>(data.equipmentLabels),
    projectId: str(data.projectId),
    technicianUids: arr<string>(data.technicianUids),
    technicianName: str(data.technicianName),
    scheduledStart: str(data.scheduledStart),
    scheduledEnd: str(data.scheduledEnd),
    checklist: arr(data.checklist),
    items: arr(data.items),
    totals: {
      products: Number(totals.products ?? 0),
      services: Number(totals.services ?? 0),
      total: Number(totals.total ?? 0),
    },
    photos: arr(data.photos),
    report: str(data.report),
    checkInAt: str(data.checkInAt),
    checkOutAt: str(data.checkOutAt),
    signature: data.signature ?? null,
    noSignatureReason: str(data.noSignatureReason),
    completedAt: str(data.completedAt),
    canceledAt: str(data.canceledAt),
    transactionId: str(data.transactionId),
    createdAt: str(data.createdAt),
    updatedAt: str(data.updatedAt),
  };
}

const byNewest = <T extends { createdAt: string | null }>(a: T, b: T) =>
  String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? ""));

/**
 * A consulta das OS. Quem enxerga a equipe inteira lê pelo tenant; o técnico
 * precisa filtrar por ele mesmo, senão as rules recusam a lista inteira (elas
 * só deixam passar a consulta que prova que cada documento é dele).
 */
export function serviceOrdersQuery(tenantId: string, scope: { seesAll: boolean; uid: string | null }) {
  const constraints: QueryConstraint[] = [where("tenantId", "==", tenantId)];
  if (!scope.seesAll) constraints.push(where("technicianUids", "array-contains", scope.uid ?? "-"));
  constraints.push(limit(MAX_ITEMS));
  return query(collection(db, ORDERS), ...constraints);
}

/**
 * Leitura direta no Firestore, como obras e CRM: é o que faz a conta de
 * demonstração enxergar os dados de exemplo. Toda escrita passa pela API, que
 * aplica permissão de membro e plano.
 */
export const FieldService = {
  subscribeOrders(
    tenantId: string,
    scope: { seesAll: boolean; uid: string | null },
    onChange: (orders: ServiceOrder[]) => void,
    onError: (error: Error) => void,
  ): () => void {
    return onSnapshot(
      serviceOrdersQuery(tenantId, scope),
      (snap) => onChange(snap.docs.map((d) => toServiceOrder(d.id, d.data())).sort(byNewest)),
      onError,
    );
  },

  subscribeOrder(
    id: string,
    onChange: (order: ServiceOrder | null) => void,
    onError: (error: Error) => void,
  ): () => void {
    return onSnapshot(
      doc(db, ORDERS, id),
      (snap) => onChange(snap.exists() ? toServiceOrder(snap.id, snap.data()) : null),
      onError,
    );
  },

  async listEquipment(tenantId: string, clientId?: string): Promise<CustomerEquipment[]> {
    if (!tenantId) return [];
    const constraints: QueryConstraint[] = [where("tenantId", "==", tenantId)];
    if (clientId) constraints.push(where("clientId", "==", clientId));
    const snap = await getDocs(query(collection(db, EQUIPMENT), ...constraints, limit(MAX_ITEMS)));
    return snap.docs
      .map((d) => toEquipment(d.id, d.data()))
      .sort((a, b) => a.clientName.localeCompare(b.clientName, "pt-BR") || a.name.localeCompare(b.name, "pt-BR"));
  },

  createEquipment: (input: EquipmentInput) => callApi<{ id: string }>("/v1/equipment", "POST", input),
  createEquipmentBatch: (input: {
    clientId: string;
    projectId?: string | null;
    items: Array<Omit<EquipmentInput, "clientId" | "status">>;
  }) => callApi<{ ids: string[] }>("/v1/equipment/batch", "POST", input),
  updateEquipment: (id: string, input: Partial<EquipmentInput>) => callApi(`/v1/equipment/${id}`, "PUT", input),
  removeEquipment: (id: string) => callApi(`/v1/equipment/${id}`, "DELETE"),

  listTechnicians: () =>
    callApi<{ technicians: { id: string; name: string }[] }>("/v1/service-orders/technicians", "GET"),

  createOrder: (input: ServiceOrderInput) =>
    callApi<{ id: string; code: string }>("/v1/service-orders", "POST", input),
  updateOrder: (id: string, input: Partial<ServiceOrderInput> & { report?: string | null }) =>
    callApi(`/v1/service-orders/${id}`, "PUT", input),
  removeOrder: (id: string) => callApi(`/v1/service-orders/${id}`, "DELETE"),
  changeStatus: (id: string, status: Exclude<ServiceOrderStatus, "completed">) =>
    callApi<{ status: ServiceOrderStatus }>(`/v1/service-orders/${id}/status`, "POST", { status }),
  complete: (id: string, input: CompleteServiceOrderInput) =>
    callApi<CompleteServiceOrderResult>(`/v1/service-orders/${id}/complete`, "POST", input),
  reopen: (id: string, reason: string) => callApi(`/v1/service-orders/${id}/reopen`, "POST", { reason }),
  uploadPhoto: (id: string, dataUrl: string, caption?: string) =>
    callApi<{ photo: ServiceOrderPhoto }>(`/v1/service-orders/${id}/photos`, "POST", { dataUrl, caption }),
  removePhoto: (id: string, photoId: string) => callApi(`/v1/service-orders/${id}/photos/${photoId}`, "DELETE"),
  shareLink: (id: string) => callApi<{ url: string }>(`/v1/service-orders/${id}/share-link`, "POST"),
  launchTransaction: (id: string, input: LaunchTransactionInput) =>
    callApi<{ transactionId: string }>(`/v1/service-orders/${id}/transaction`, "POST", input),
};

/** Como a OS concluída entra no financeiro: à vista ou parcelada, com ou sem entrada. */
export interface LaunchTransactionInput {
  wallet: string;
  status: "paid" | "pending";
  dueDate: string;
  installments?: number;
  downPayment?: { amount: number; dueDate: string; status: "paid" | "pending" };
}

/** O que o link público da OS mostra (`toClientOrderView` no backend). */
export interface SharedServiceOrderView {
  code: string;
  type: ServiceOrder["type"];
  status: ServiceOrderStatus;
  title: string;
  description: string | null;
  clientName: string | null;
  address: string | null;
  equipmentLabels: string[];
  technicianName: string | null;
  scheduledStart: string | null;
  checkInAt: string | null;
  checkOutAt: string | null;
  completedAt: string | null;
  checklist: { text: string; done: boolean }[];
  items: { name: string; kind: "product" | "service"; quantity: number; unitPrice: number }[];
  totals: { products: number; services: number; total: number };
  report: string | null;
  photos: { url: string; caption: string | null }[];
  signature: {
    name: string;
    document: string | null;
    imageUrl: string;
    signedAt: string;
    contentHash: string;
  } | null;
  noSignatureReason: string | null;
}

export interface SharedServiceOrderTenant {
  name: string | null;
  logoUrl: string | null;
  primaryColor: string | null;
}

export const SharedServiceOrderService = {
  get: (token: string) =>
    callPublicApi<{ order: SharedServiceOrderView; tenant: SharedServiceOrderTenant }>(
      `/v1/share/service-order/${token}`,
      "GET",
    ),
};
