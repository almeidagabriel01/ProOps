/**
 * Cloud Function: Update Client
 *
 * Updates an existing client in a multi-tenant ERP SaaS with:
 * - Permission verification (canEdit on customers page)
 * - Ownership verification (client belongs to user's tenant)
 *
 * SECURITY: All sensitive data validation happens server-side.
 */

import * as functions from "firebase-functions";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

interface UpdateClientInput {
  clientId: string;
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
}

interface UserDoc {
  role: "MASTER" | "MEMBER";
  masterId: string | null;
  tenantId: string;
  companyId?: string;
  subscription?: { status: string };
}

export const updateClient = functions
  .region("southamerica-east1")
  .https.onCall(async (data: UpdateClientInput, context) => {
    const db = getFirestore();

    // 1. Auth Check
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Login necessário."
      );
    }
    const userId = context.auth.uid;
    const { clientId, ...updateData } = data;

    if (!clientId) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "ID do cliente inválido."
      );
    }

    // 2. Parallel Fetch (User, Client, Permission)
    const userRef = db.collection("users").doc(userId);
    const clientRef = db.collection("clients").doc(clientId);
    const permRef = userRef.collection("permissions").doc("customers");

    const [userSnap, clientSnap, permSnap] = await Promise.all([
      userRef.get(),
      clientRef.get(),
      permRef.get(),
    ]);

    // 3. Validation
    if (!userSnap.exists) {
      throw new functions.https.HttpsError(
        "not-found",
        "Usuário não encontrado."
      );
    }
    if (!clientSnap.exists) {
      throw new functions.https.HttpsError(
        "not-found",
        "Cliente não encontrado."
      );
    }

    const userData = userSnap.data() as UserDoc;
    const clientData = clientSnap.data();
    const tenantId = userData.tenantId || userData.companyId;

    if (!tenantId) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "Usuário sem tenantId."
      );
    }

    if (clientData?.tenantId !== tenantId) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Este cliente não pertence a sua organização."
      );
    }

    // 4. Permission Check
    const role = (userData.role as string)?.toUpperCase();
    const isMaster =
      role === "MASTER" ||
      role === "ADMIN" ||
      role === "WK" ||
      (!userData.masterId && userData.subscription);

    if (!isMaster) {
      if (!permSnap.exists || !permSnap.data()?.canEdit) {
        throw new functions.https.HttpsError(
          "permission-denied",
          "Sem permissão para editar clientes."
        );
      }
    }

    // 5. Build Safe Update Object
    const safeUpdate: Record<string, unknown> = {
      updatedAt: Timestamp.now(),
    };

    if (updateData.name !== undefined) safeUpdate.name = updateData.name;
    if (updateData.email !== undefined) safeUpdate.email = updateData.email;
    if (updateData.phone !== undefined) safeUpdate.phone = updateData.phone;
    if (updateData.address !== undefined)
      safeUpdate.address = updateData.address;
    if (updateData.notes !== undefined) safeUpdate.notes = updateData.notes;

    // 6. Update Client
    try {
      await clientRef.update(safeUpdate);
      return { success: true, message: "Cliente atualizado com sucesso." };
    } catch (error) {
      console.error("Update Client Error:", error);
      throw new functions.https.HttpsError(
        "internal",
        (error as Error).message
      );
    }
  });
