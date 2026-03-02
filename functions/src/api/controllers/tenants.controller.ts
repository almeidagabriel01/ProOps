import { Request, Response } from "express";
import { db } from "../../init";
import { Timestamp } from "firebase-admin/firestore";
import { resolveUserAndTenant } from "../../lib/auth-helpers";

// Update Tenant
export const updateTenant = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.uid;
    const { id } = req.params;
    const updateData = req.body;

    if (!id) {
      return res.status(400).json({ message: "ID do tenant é obrigatório." });
    }

    const { tenantId, isMaster, isSuperAdmin } = await resolveUserAndTenant(
      userId,
      req.user,
    );

    // Check authorization: only master of the tenant or super admin can update
    if (!isSuperAdmin && !isMaster) {
      return res.status(403).json({
        message: "Apenas administradores podem editar dados da organização.",
      });
    }

    // For masters, ensure they can only edit their own tenant
    if (!isSuperAdmin && tenantId !== id) {
      return res.status(403).json({
        message: "Você só pode editar sua própria organização.",
      });
    }

    const tenantRef = db.collection("tenants").doc(id);
    const tenantSnap = await tenantRef.get();

    if (!tenantSnap.exists) {
      return res.status(404).json({ message: "Organização não encontrada." });
    }

    // Only allow safe fields to be updated
    const allowedFields = [
      "name",
      "niche",
      "primaryColor",
      "logoUrl",
      "proposalDefaults",
      "transactionStatusOrder",
    ];

    if (isSuperAdmin) {
      allowedFields.push("whatsappEnabled");
    }
    const safeUpdate: Record<string, unknown> = {
      updatedAt: Timestamp.now(),
    };

    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        safeUpdate[field] = updateData[field];
      }
    }

    await tenantRef.update(safeUpdate);

    return res.json({
      success: true,
      message: "Organização atualizada com sucesso.",
    });
  } catch (error: unknown) {
    console.error("updateTenant Error:", error);
    const message =
      error instanceof Error ? error.message : "Erro ao atualizar organização.";
    return res.status(500).json({ message });
  }
};
