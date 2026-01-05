import * as functions from "firebase-functions";
import { Timestamp } from "firebase-admin/firestore";
import { canManageTeam } from "./authUtils";
import { db, auth } from "./init";

interface UpdateMemberInput {
  memberId: string;
  name?: string;
  email?: string;
  password?: string;
}

export const updateMember = functions
  .region("southamerica-east1")
  .https.onCall(async (data: UpdateMemberInput, context) => {
    // 1. Auth Check
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Você precisa estar logado."
      );
    }

    const { memberId, name, email, password } = data;
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
    const memberData = memberSnap.data();

    if (!canManageTeam(masterData?.role)) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Apenas administradores podem editar membros."
      );
    }

    if (memberData?.masterId !== masterId) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Você não tem permissão para editar este membro."
      );
    }

    // 4. Update Firebase Auth (if email or password changed)
    const authUpdates: {
      email?: string;
      password?: string;
      displayName?: string;
    } = {};
    if (email && email !== memberData?.email) authUpdates.email = email;
    if (password && password.length >= 6) authUpdates.password = password;
    if (name) authUpdates.displayName = name;

    if (Object.keys(authUpdates).length > 0) {
      try {
        await auth.updateUser(memberId, authUpdates);
        console.log(`[updateMember] Auth updated for ${memberId}`);
      } catch (err) {
        console.error(`[updateMember] Auth update failed`, err);
        const error = err as { code?: string; message?: string };
        if (error.code === "auth/email-already-exists") {
          throw new functions.https.HttpsError(
            "already-exists",
            "Este email já está em uso."
          );
        }
        throw new functions.https.HttpsError(
          "internal",
          "Erro ao atualizar credenciais."
        );
      }
    }

    // 5. Update Firestore
    const firestoreUpdates: Record<string, unknown> = {
      updatedAt: Timestamp.now(),
    };
    if (name) firestoreUpdates.name = name;
    if (email) firestoreUpdates.email = email;

    try {
      await memberRef.update(firestoreUpdates);
      console.log(`[updateMember] Firestore updated for ${memberId}`);
    } catch (err) {
      console.error(`[updateMember] Firestore update failed`, err);
      throw new functions.https.HttpsError(
        "internal",
        "Erro ao salvar alterações."
      );
    }

    return { success: true, message: "Membro atualizado com sucesso." };
  });
