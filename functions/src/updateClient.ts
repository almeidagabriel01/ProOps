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
import { Timestamp } from "firebase-admin/firestore";
import { db } from "./init";

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
    console.log("updateClient v2: Function started", { data, auth: context.auth?.uid });

    try {
      // 1. Auth Check
      if (!context.auth) {
        console.warn("updateClient: Unauthenticated attempt");
        throw new functions.https.HttpsError(
          "unauthenticated",
          "Login necessário."
        );
      }
      const userId = context.auth.uid;
      const { clientId, ...updateData } = data;

      if (!clientId) {
        console.warn("updateClient: Missing clientId");
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
        console.error(`updateClient: User ${userId} not found`);
        throw new functions.https.HttpsError(
          "not-found",
          "Usuário não encontrado."
        );
      }
      if (!clientSnap.exists) {
        console.error(`updateClient: Client ${clientId} not found`);
        throw new functions.https.HttpsError(
          "not-found",
          "Cliente não encontrado."
        );
      }

      const userData = userSnap.data() as UserDoc;
      const clientData = clientSnap.data();
      const tenantId = userData.tenantId || userData.companyId;
      const isSuperAdmin = (userData.role as string)?.toLowerCase() === "superadmin";

      if (!tenantId && !isSuperAdmin) {
        console.error(`updateClient: User ${userId} has no tenantId`);
        throw new functions.https.HttpsError(
          "failed-precondition",
          "Usuário sem tenantId."
        );
      }

      // Super admin can update any client
      if (!isSuperAdmin && clientData?.tenantId !== tenantId) {
        console.warn(`updateClient: Tenant mismatch. User: ${tenantId}, Client: ${clientData?.tenantId}`);
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
          console.warn(`updateClient: User ${userId} lacks permission`);
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
      await clientRef.update(safeUpdate);
      console.log(`updateClient: Successfully updated client ${clientId}`);
      return { success: true, message: "Cliente atualizado com sucesso." };

    } catch (error) {
      console.error("updateClient: Critical Error", error);
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      throw new functions.https.HttpsError(
        "internal",
        `Erro interno ao atualizar cliente: ${(error as Error).message}`
      );
    }
  });
