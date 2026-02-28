"use client";

import { db } from "@/lib/firebase";
import { callApi } from "@/lib/api-client";
import { collection, getDocs, query, where, orderBy } from "firebase/firestore";
import { ProposalStatus } from "@/types/proposal";

// ============================================
// TYPES
// ============================================

export interface KanbanStatusColumn {
  id: string;
  tenantId: string;
  label: string;
  color: string;
  order: number;
  mappedStatus: ProposalStatus;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// DEFAULT COLUMNS
// ============================================

const STATUS_COLORS: Record<ProposalStatus, string> = {
  draft: "#94a3b8", // slate-400
  in_progress: "#3b82f6", // blue-500
  sent: "#f59e0b", // amber-500
  approved: "#22c55e", // green-500
  rejected: "#ef4444", // red-500
};

const STATUS_LABELS: Record<ProposalStatus, string> = {
  draft: "Rascunho",
  in_progress: "Em Aberto",
  sent: "Enviada",
  approved: "Aprovada",
  rejected: "Rejeitada",
};

export function getDefaultProposalColumns(): Omit<
  KanbanStatusColumn,
  "id" | "tenantId" | "createdAt" | "updatedAt"
>[] {
  const statuses: ProposalStatus[] = [
    "in_progress",
    "sent",
    "approved",
    "rejected",
  ];
  return statuses.map((status, index) => ({
    label: STATUS_LABELS[status],
    color: STATUS_COLORS[status],
    order: index,
    mappedStatus: status,
  }));
}

// ============================================
// COLLECTION
// ============================================

const COLLECTION_NAME = "kanban_statuses";

// ============================================
// SERVICE
// ============================================

export const KanbanService = {
  /**
   * Get all kanban status columns for a tenant, ordered by `order`
   */
  async getStatuses(tenantId: string): Promise<KanbanStatusColumn[]> {
    if (!tenantId) return [];

    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where("tenantId", "==", tenantId),
        orderBy("order", "asc"),
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as KanbanStatusColumn[];
    } catch (error) {
      // If collection doesn't exist yet or rules haven't been deployed,
      // return empty array so the UI falls back to default columns
      const isPermissionError =
        error instanceof Error &&
        error.message.includes("Missing or insufficient permissions");
      if (isPermissionError) {
        console.warn(
          "[KanbanService] Permission denied reading kanban_statuses — falling back to defaults.",
        );
        return [];
      }
      console.error("[KanbanService] Error fetching statuses:", error);
      throw error;
    }
  },

  /**
   * Create a new kanban status column
   */
  async createStatus(
    data: Omit<KanbanStatusColumn, "id" | "createdAt" | "updatedAt">,
  ): Promise<KanbanStatusColumn> {
    const result = await callApi<{ success: boolean; statusId: string }>(
      "v1/kanban-statuses",
      "POST",
      data,
    );
    return {
      id: result.statusId,
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  },

  /**
   * Update an existing kanban status column
   */
  async updateStatus(
    id: string,
    data: Partial<Omit<KanbanStatusColumn, "id" | "tenantId" | "createdAt">>,
  ): Promise<void> {
    await callApi(`v1/kanban-statuses/${id}`, "PUT", data);
  },

  /**
   * Delete a kanban status column
   */
  async deleteStatus(id: string): Promise<void> {
    await callApi(`v1/kanban-statuses/${id}`, "DELETE");
  },

  /**
   * Reorder kanban status columns
   */
  async reorderStatuses(statusIds: string[]): Promise<void> {
    await callApi("v1/kanban-statuses/reorder", "PUT", { statusIds });
  },
};
