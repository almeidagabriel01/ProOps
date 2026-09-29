/**
 * Assistência técnica: equipamentos do cliente e ordens de serviço. Espelha o
 * que `apps/functions/src/api/services/field-service/field-service-model.ts`
 * grava.
 */

export type EquipmentStatus = "active" | "inactive";

export interface CustomerEquipment {
  id: string;
  tenantId: string;
  clientId: string;
  clientName: string;
  name: string;
  type: string | null;
  brand: string | null;
  model: string | null;
  serialNumber: string | null;
  capacity: string | null;
  location: string | null;
  installedAt: string | null;
  warrantyUntil: string | null;
  notes: string | null;
  status: EquipmentStatus;
  projectId: string | null;
  lastServiceAt: string | null;
  lastServiceOrderId: string | null;
  createdAt: string | null;
}

export interface EquipmentInput {
  clientId: string;
  name: string;
  type?: string | null;
  brand?: string | null;
  model?: string | null;
  serialNumber?: string | null;
  capacity?: string | null;
  location?: string | null;
  installedAt?: string | null;
  warrantyUntil?: string | null;
  notes?: string | null;
  status?: EquipmentStatus;
}

export type ServiceOrderType = "corrective" | "preventive" | "installation" | "inspection";
export type ServiceOrderPriority = "low" | "normal" | "high" | "urgent";
export type ServiceOrderStatus = "open" | "scheduled" | "in_progress" | "completed" | "canceled";

export interface ServiceOrderChecklistItem {
  id: string;
  text: string;
  done: boolean;
  note: string | null;
}

export interface ServiceOrderItem {
  id: string;
  kind: "product" | "service";
  refId: string | null;
  name: string;
  quantity: number;
  unitPrice: number;
  fromStock: boolean;
}

export interface ServiceOrderPhoto {
  id: string;
  url: string;
  storagePath: string;
  caption: string | null;
  uploadedAt: string;
  uploadedBy: string;
}

export interface ServiceOrderSignature {
  name: string;
  document: string | null;
  imageUrl: string;
  signedAt: string;
  ip: string | null;
  contentHash: string;
}

export interface ServiceOrder {
  id: string;
  tenantId: string;
  number: number;
  code: string;
  clientId: string;
  clientName: string;
  clientPhone: string | null;
  address: string | null;
  type: ServiceOrderType;
  priority: ServiceOrderPriority;
  status: ServiceOrderStatus;
  title: string;
  description: string | null;
  equipmentIds: string[];
  equipmentLabels: string[];
  projectId: string | null;
  technicianUids: string[];
  technicianName: string | null;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  checklist: ServiceOrderChecklistItem[];
  items: ServiceOrderItem[];
  totals: { products: number; services: number; total: number };
  photos: ServiceOrderPhoto[];
  report: string | null;
  checkInAt: string | null;
  checkOutAt: string | null;
  signature: ServiceOrderSignature | null;
  noSignatureReason: string | null;
  completedAt: string | null;
  canceledAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface ServiceOrderInput {
  clientId: string;
  type: ServiceOrderType;
  priority?: ServiceOrderPriority;
  title: string;
  description?: string | null;
  equipmentIds?: string[];
  technicianId?: string | null;
  scheduledStart?: string | null;
  scheduledEnd?: string | null;
  address?: string | null;
  checklist?: ServiceOrderChecklistItem[];
  items?: ServiceOrderItem[];
}

export interface CompleteServiceOrderInput {
  signature?: { name: string; document?: string; imageDataUrl: string };
  noSignatureReason?: string;
}

export interface CompleteServiceOrderResult {
  completedAt: string;
  negative: { productId: string; name: string; balance: number }[];
}
