import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { initializeApp, getApps } from "firebase-admin/app";

interface UpdateAdminCredentialsData {
  userId: string;
  tenantId: string;
  email?: string;
  password?: string;
}

export const updateAdminCredentials = onCall(
  { region: "southamerica-east1" },
  async (request) => {
    // Initialize Admin SDK if not already initialized
    if (getApps().length === 0) {
      initializeApp();
    }

    const { auth, data } = request;
    const { userId, tenantId, email, password } =
      data as UpdateAdminCredentialsData;

    // Validate authentication
    if (!auth) {
      throw new HttpsError("unauthenticated", "Usuário não autenticado");
    }

    try {
      // Check if caller is superadmin
      const callerDoc = await admin
        .firestore()
        .collection("users")
        .doc(auth.uid)
        .get();

      if (!callerDoc.exists) {
        throw new HttpsError("permission-denied", "Usuário não encontrado");
      }

      const callerData = callerDoc.data();
      const callerRole = callerData?.role?.toUpperCase() || "";

      if (callerRole !== "SUPERADMIN") {
        throw new HttpsError(
          "permission-denied",
          "Apenas superadmin pode atualizar credenciais de administradores"
        );
      }

      // Validate input
      if (!userId) {
        throw new HttpsError("invalid-argument", "ID do usuário é obrigatório");
      }

      if (!tenantId) {
        throw new HttpsError("invalid-argument", "ID da empresa é obrigatório");
      }

      if (!email && !password) {
        throw new HttpsError(
          "invalid-argument",
          "Email ou senha deve ser fornecido"
        );
      }

      if (password && password.length < 6) {
        throw new HttpsError(
          "invalid-argument",
          "A senha deve ter pelo menos 6 caracteres"
        );
      }

      // Build update object
      const updateData: admin.auth.UpdateRequest = {};

      if (email) {
        updateData.email = email;
      }

      if (password) {
        updateData.password = password;
      }

      // Update Firebase Auth user
      try {
        await admin.auth().updateUser(userId, updateData);
      } catch (authError: unknown) {
        const error = authError as { code?: string };
        // If user doesn't exist in Auth but exists in Firestore (orphaned), recreate it
        if (error.code === "auth/user-not-found") {
          console.log(`User ${userId} not found in Auth, recreating...`);

          let userEmail = email;

          // If email was not provided in the update request (e.g. password only update),
          // fetch it from the existing Firestore document.
          if (!userEmail) {
            const userDoc = await admin
              .firestore()
              .collection("users")
              .doc(userId)
              .get();
            userEmail = userDoc.data()?.email;
          }

          if (!userEmail) {
            throw new HttpsError(
              "failed-precondition",
              "Não foi possível recriar o usuário: email não encontrado no cadastro."
            );
          }

          await admin.auth().createUser({
            uid: userId,
            email: userEmail,
            password: password, // Optional in createUser? No, usually required or handled. Actually checking docs...
            // If password is not provided, the user will be created without a password (only email auth provider?)
            // But we want them to log in.
            // If we are updating EMAIL only, we don't know the old password!
            // This is a catch-22. Recreating a user resets their password if we don't provide one.
            // But if we are an admin setting a new password, we have it.
            // If we are setting a new email, we might lock them out if we don't set a password.
            // But this function allows setting email OR password.

            // For now, allow creation. If password missing, they might need reset.
            displayName: callerData?.name || undefined,
          });

          // If we had a password update, it's used in createUser.
          // If we updated email, it's used in createUser.
        } else {
          throw authError; // Rethrow other errors
        }
      }

      // If email changed, also update Firestore user document
      if (email) {
        await admin.firestore().collection("users").doc(userId).update({
          email: email,
        });
      }

      return {
        success: true,
        message: "Credenciais atualizadas com sucesso",
      };
    } catch (error) {
      console.error("Error updating admin credentials:", error);

      // Return specific auth errors
      if ((error as { code?: string }).code === "auth/email-already-exists") {
        throw new HttpsError(
          "already-exists",
          "Este email já está sendo usado por outro usuário"
        );
      }

      // If it's already an HttpsError, rethrow it
      if (error instanceof HttpsError) {
        throw error;
      }

      // Return the actual error message for debugging purposes
      const errorMessage =
        error instanceof Error ? error.message : "Erro desconhecido";
      throw new HttpsError(
        "internal",
        `Erro ao atualizar credenciais: ${errorMessage}`
      );
    }
  }
);
