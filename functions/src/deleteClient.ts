/**
 * Cloud Function: Delete Client
 */

import * as functions from "firebase-functions";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { db } from "./init";

export const deleteClient = functions
  .region("southamerica-east1")
  .https.onCall(async (data: { clientId: string }, context) => {
    // const db = getFirestore();

    if (!context.auth)
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Login necessário."
      );
    const userId = context.auth.uid;
    const { clientId } = data;

    if (!clientId)
      throw new functions.https.HttpsError(
        "invalid-argument",
        "ID do cliente obrigatório."
      );

    // 1. Parallel Fetch (User & Permission)
    const userRef = db.collection("users").doc(userId);
    const permRef = userRef.collection("permissions").doc("clients");

    const [userSnap, permSnap] = await Promise.all([
      userRef.get(),
      permRef.get(),
    ]);

    if (!userSnap.exists)
      throw new functions.https.HttpsError(
        "not-found",
        "Usuário não encontrado."
      );

    // Type definition for local use (or imported if shared)
    interface LocalUserDoc {
      role: string;
      masterId?: string | null;
      masterID?: string | null; // Legacy
      ownerId?: string | null; // Legacy
      tenantId?: string;
      companyId?: string;
      subscription?: Record<string, unknown>;
    }

    const userData = userSnap.data() as LocalUserDoc;
    const isSuperAdmin = (userData.role as string)?.toLowerCase() === "superadmin";
    // console.log(`[deleteClient] User ${userId} data:`, JSON.stringify(userData)); // Debug if needed

    // Resolve Master
    let masterRef: FirebaseFirestore.DocumentReference;
    const role = (userData.role as string)?.toUpperCase();
    const isMaster =
      role === "MASTER" ||
      role === "ADMIN" ||
      role === "WK" ||
      (!userData.masterId && !userData.masterID && userData.subscription);

    if (isMaster || isSuperAdmin) {
      masterRef = userRef;
    } else {
      const masterId =
        userData.masterId || userData.masterID || userData.ownerId;
      if (!masterId) {
        throw new functions.https.HttpsError(
          "failed-precondition",
          "Configuração de conta inválida: masterId ausente."
        );
      }
      masterRef = db.collection("users").doc(masterId);
    }

    const userCompanyId = userData.companyId || userData.tenantId;
    if (!userCompanyId && !isSuperAdmin) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "Configuração de conta inválida: companyId/tenantId ausente."
      );
    }

    // Permission Check
    if (role === "MEMBER") {
      if (!permSnap.exists || !permSnap.data()?.canDelete) {
        throw new functions.https.HttpsError(
          "permission-denied",
          "Sem permissão para deletar clientes."
        );
      }
    }

    // Deletion Transaction
    try {
      await db.runTransaction(async (transaction) => {
        const clientRef = db.collection("clients").doc(clientId);
        const companyRef = userCompanyId ? db.collection("companies").doc(userCompanyId) : null;

        // READS
        const clientSnap = await transaction.get(clientRef);
        const companySnap = companyRef ? await transaction.get(companyRef) : null;

        // CHECKS
        if (!clientSnap.exists)
          throw new functions.https.HttpsError(
            "not-found",
            "Cliente não encontrado."
          );

        const clientData = clientSnap.data();
        // Super admin can delete any client
        if (!isSuperAdmin && clientData?.tenantId !== userCompanyId) {
          console.warn(
            `[deleteClient] Access denied. Client tenant: ${clientData?.tenantId}, User tenant: ${userCompanyId}`
          );
          throw new functions.https.HttpsError(
            "permission-denied",
            "Acesso negado."
          );
        }

        // WRITES
        transaction.delete(clientRef);

        transaction.update(masterRef, {
          "usage.clients": FieldValue.increment(-1),
          updatedAt: Timestamp.now(),
        });

        if (companySnap && companySnap.exists && companyRef) {
          transaction.update(companyRef, {
            "usage.clients": FieldValue.increment(-1),
            updatedAt: Timestamp.now(),
          });
        } else {
          console.warn(
            `[deleteClient] Company/Tenant ${userCompanyId} not found. Skipping usage update.`
          );
        }
      });

      return { success: true, message: "Cliente removido." };
    } catch (error) {
      console.error("Delete Client Error:", error);
      if (error instanceof functions.https.HttpsError) throw error;
      // Unmasking error for debugging
      throw new functions.https.HttpsError(
        "internal",
        `Erro ao deletar cliente: ${(error as Error).message}`
      );
    }
  });
