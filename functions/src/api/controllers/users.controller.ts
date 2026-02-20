import { Request, Response } from "express";
import { db, auth } from "../../init";
import { Timestamp } from "firebase-admin/firestore";
import {
  upsertPhoneNumberIndexTx,
  normalizePhoneNumber,
} from "./admin.controller";

export const updateProfile = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.uid;
    const { name, phoneNumber } = req.body;

    const userRef = db.collection("users").doc(userId);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      return res.status(404).json({ message: "Usuário não encontrado" });
    }

    const userData = userSnap.data();

    // Ensure we run in transaction if we are updating the phone number index
    const now = Timestamp.now();
    const updateData: Record<string, any> = { updatedAt: now };

    if (name !== undefined) updateData.name = name;

    // Auth display name update
    const authUpdates: { displayName?: string } = {};
    if (name && name !== userData?.name) {
      authUpdates.displayName = name;
    }

    if (Object.keys(authUpdates).length > 0) {
      try {
        await auth.updateUser(userId, authUpdates);
      } catch (err: unknown) {
        console.error("Error updating auth user profile", err);
        // Continue, not fatal usually
      }
    }

    if (phoneNumber !== undefined) {
      // Normalize inside the tx function
      updateData.phoneNumber = normalizePhoneNumber(phoneNumber) || null;

      try {
        await db.runTransaction(async (transaction) => {
          await upsertPhoneNumberIndexTx(transaction, {
            userId,
            tenantId: userData?.tenantId || userData?.companyId || "", // Needed for whatsapp limits mapping
            newPhoneNumber: phoneNumber,
            previousPhoneNumber: userData?.phoneNumber,
            now,
          });

          transaction.update(userRef, updateData);
        });
      } catch (err: unknown) {
        if (err instanceof Error && err.message === "PHONE_ALREADY_LINKED") {
          return res.status(409).json({
            message: "Este telefone já está vinculado a outro usuário.",
          });
        }
        throw err;
      }
    } else {
      // Just update user doc if no phone change requested
      await userRef.update(updateData);
    }

    return res.json({
      success: true,
      message: "Perfil atualizado com sucesso.",
    });
  } catch (error: unknown) {
    console.error("updateProfile Error:", error);
    const message =
      error instanceof Error
        ? error.message
        : "Erro interno ao atualizar perfil.";
    return res.status(500).json({ message });
  }
};
