import * as functions from "firebase-functions";

import { FieldValue } from "firebase-admin/firestore";
import { canManageTeam } from "./authUtils";
import { db, auth } from "./init";

interface DeleteMemberInput {
  memberId: string;
}

export const deleteMember = functions
  .region("southamerica-east1")
  .https.onCall(async (data: DeleteMemberInput, context) => {
    // 1. Auth Check
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Você precisa estar logado."
      );
    }

    const { memberId } = data;
    if (!memberId) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "ID do membro é obrigatório."
      );
    }

    // 2. Parallel Fetch (Master, Member)
    const masterId = context.auth.uid;
    const masterRef = db.collection("users").doc(masterId);
    const memberRef = db.collection("users").doc(memberId);

    const [masterSnap, memberSnap] = await Promise.all([
      masterRef.get(),
      memberRef.get(),
    ]);

    // 3. Validation
    if (!masterSnap.exists) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Usuário master não encontrado"
      );
    }
    if (!memberSnap.exists) {
      throw new functions.https.HttpsError(
        "not-found",
        "Membro não encontrado."
      );
    }

    const masterData = masterSnap.data();
    const role = masterData?.role;

    if (!canManageTeam(role) || !masterData) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Apenas administradores podem remover membros."
      );
    }

    const memberData = memberSnap.data();
    if (memberData?.masterId !== masterId) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Você não tem permissão para remover este membro."
      );
    }

    try {
      // 4. Delete from Firebase Auth
      await auth.deleteUser(memberId);
      console.log(`[deleteMember] Auth user ${memberId} deleted`);
    } catch (err) {
      const error = err as { code?: string };
      if (error.code === "auth/user-not-found") {
        console.warn(
          `[deleteMember] Auth user ${memberId} already missing, proceeding with DB cleanup.`
        );
      } else {
        console.error(`[deleteMember] Failed to delete auth user`, err);
        throw new functions.https.HttpsError(
          "internal",
          "Erro ao remover acesso do usuário."
        );
      }
    }

    // 5. Delete from Firestore + Decrement Usage (Transaction)
    try {
      await db.runTransaction(async (transaction) => {
        // Read company doc for usage update
        const companyRef = db.collection("companies").doc(masterData.tenantId);
        const companySnap = await transaction.get(companyRef);

        // Delete member doc
        transaction.delete(memberRef);

        // Delete permissions subcollection (Note: This is shallow delete.
        // In production with large subcollections, use recursive delete tool.
        // For simple permissions, we might leave them or delete known IDs if feasible.
        // Since we can't easily list collections in transaction, we skip deep delete for now
        // or rely on a separate cleanup trigger.
        // However, typical permission docs are small.)

        // Decrement Master Usage
        const masterRef = db.collection("users").doc(masterId);
        transaction.update(masterRef, {
          "usage.users": FieldValue.increment(-1),
        });

        // Decrement Company Usage
        if (companySnap.exists) {
          transaction.update(companyRef, {
            "usage.users": FieldValue.increment(-1),
          });
        } else {
          console.warn(
            `[deleteMember] Company ${masterData.tenantId} not found, skipping usage decrement.`
          );
        }
      });

      console.log(`[deleteMember] Firestore cleanup complete for ${memberId}`);
    } catch (err) {
      console.error(`[deleteMember] Transaction failed`, err);
      throw new functions.https.HttpsError(
        "internal",
        "Erro ao remover dados do membro."
      );
    }

    return { success: true, message: "Membro removido com sucesso." };
  });
