import { Request, Response } from "express";
import { db } from "../../init";

const COLLECTION = "kanban_statuses";
const MAX_COLUMNS_PER_TENANT = 20;

// Allowed Kanban Categories
const VALID_CATEGORIES = ["open", "won", "lost"];

// Allowed ProposalStatus values
const VALID_STATUSES = ["draft", "in_progress", "sent", "approved", "rejected"];

// Validate color hex format
function isValidHexColor(color: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(color);
}

/**
 * Create a kanban status column
 * POST /v1/kanban-statuses
 */
export async function createKanbanStatus(req: Request, res: Response) {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(403).json({ message: "Tenant não identificado." });
    }

    const { label, color, order, category, mappedStatus } = req.body;

    // Validate required fields
    if (!label || typeof label !== "string" || label.trim().length === 0) {
      return res.status(400).json({ message: "Nome da coluna é obrigatório." });
    }
    if (label.trim().length > 40) {
      return res
        .status(400)
        .json({ message: "Nome da coluna deve ter no máximo 40 caracteres." });
    }
    if (!color || !isValidHexColor(color)) {
      return res
        .status(400)
        .json({ message: "Cor inválida. Use formato hex (#RRGGBB)." });
    }
    if (typeof order !== "number" || order < 0) {
      return res.status(400).json({ message: "Ordem inválida." });
    }
    if (!category || !VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({
        message: `Categoria inválida. Valores permitidos: ${VALID_CATEGORIES.join(", ")}`,
      });
    }
    if (mappedStatus !== undefined && !VALID_STATUSES.includes(mappedStatus)) {
      return res.status(400).json({
        message: `Status mapeado inválido. Valores permitidos: ${VALID_STATUSES.join(", ")}`,
      });
    }

    // Check column count limit
    const existing = await db
      .collection(COLLECTION)
      .where("tenantId", "==", tenantId)
      .count()
      .get();

    if (existing.data().count >= MAX_COLUMNS_PER_TENANT) {
      return res.status(400).json({
        message: `Limite de ${MAX_COLUMNS_PER_TENANT} colunas atingido.`,
      });
    }

    const now = new Date().toISOString();
    const docRef = db.collection(COLLECTION).doc();
    const data = {
      tenantId,
      label: label.trim(),
      color,
      order,
      category,
      mappedStatus: mappedStatus || null,
      createdAt: now,
      updatedAt: now,
    };

    await docRef.set(data);

    return res.status(201).json({
      success: true,
      statusId: docRef.id,
    });
  } catch (error) {
    console.error("[KanbanController] Error creating status:", error);
    return res.status(500).json({ message: "Erro interno ao criar coluna." });
  }
}

/**
 * Update a kanban status column
 * PUT /v1/kanban-statuses/:id
 */
export async function updateKanbanStatus(req: Request, res: Response) {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(403).json({ message: "Tenant não identificado." });
    }

    const { id } = req.params;
    const docRef = db.collection(COLLECTION).doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ message: "Coluna não encontrada." });
    }

    // Verify tenant ownership
    if (doc.data()?.tenantId !== tenantId) {
      return res.status(403).json({ message: "Acesso negado." });
    }

    const updates: Record<string, unknown> = {};
    const { label, color, order, category, mappedStatus } = req.body;

    if (label !== undefined) {
      if (typeof label !== "string" || label.trim().length === 0) {
        return res
          .status(400)
          .json({ message: "Nome da coluna é obrigatório." });
      }
      if (label.trim().length > 40) {
        return res.status(400).json({
          message: "Nome da coluna deve ter no máximo 40 caracteres.",
        });
      }
      updates.label = label.trim();
    }

    if (color !== undefined) {
      if (!isValidHexColor(color)) {
        return res
          .status(400)
          .json({ message: "Cor inválida. Use formato hex (#RRGGBB)." });
      }
      updates.color = color;
    }

    if (order !== undefined) {
      if (typeof order !== "number" || order < 0) {
        return res.status(400).json({ message: "Ordem inválida." });
      }
      updates.order = order;
    }

    if (category !== undefined) {
      if (!VALID_CATEGORIES.includes(category)) {
        return res.status(400).json({
          message: `Categoria inválida. Valores permitidos: ${VALID_CATEGORIES.join(", ")}`,
        });
      }
      updates.category = category;
    }

    if (mappedStatus !== undefined) {
      if (mappedStatus !== null && !VALID_STATUSES.includes(mappedStatus)) {
        return res.status(400).json({
          message: `Status mapeado inválido. Valores permitidos: ${VALID_STATUSES.join(", ")}`,
        });
      }
      updates.mappedStatus = mappedStatus;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: "Nenhum campo para atualizar." });
    }

    updates.updatedAt = new Date().toISOString();
    await docRef.update(updates);

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("[KanbanController] Error updating status:", error);
    return res
      .status(500)
      .json({ message: "Erro interno ao atualizar coluna." });
  }
}

/**
 * Delete a kanban status column
 * DELETE /v1/kanban-statuses/:id
 */
export async function deleteKanbanStatus(req: Request, res: Response) {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(403).json({ message: "Tenant não identificado." });
    }

    const { id } = req.params;
    const docRef = db.collection(COLLECTION).doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ message: "Coluna não encontrada." });
    }

    // Verify tenant ownership
    if (doc.data()?.tenantId !== tenantId) {
      return res.status(403).json({ message: "Acesso negado." });
    }

    await docRef.delete();

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("[KanbanController] Error deleting status:", error);
    return res.status(500).json({ message: "Erro interno ao excluir coluna." });
  }
}

/**
 * Reorder kanban status columns
 * PUT /v1/kanban-statuses/reorder
 */
export async function reorderKanbanStatuses(req: Request, res: Response) {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(403).json({ message: "Tenant não identificado." });
    }

    const { statusIds } = req.body;
    if (!Array.isArray(statusIds) || statusIds.length === 0) {
      return res.status(400).json({ message: "Lista de IDs é obrigatória." });
    }

    // Batch update order
    const batch = db.batch();
    const now = new Date().toISOString();

    for (let i = 0; i < statusIds.length; i++) {
      const docRef = db.collection(COLLECTION).doc(statusIds[i]);
      batch.update(docRef, { order: i, updatedAt: now });
    }

    await batch.commit();

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("[KanbanController] Error reordering statuses:", error);
    return res
      .status(500)
      .json({ message: "Erro interno ao reordenar colunas." });
  }
}
