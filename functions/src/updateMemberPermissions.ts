/**
 * Firebase Cloud Function: Update Member Permissions
 *
 * Allows MASTER to update permissions of their MEMBER users.
 *
 * DEPLOYMENT:
 * firebase deploy --only functions:updateMemberPermissions
 *
 * MIGRATED TO V1: Uses firebase-functions (v1) for full httpsCallable compatibility
 */

import * as functions from "firebase-functions";
import { db } from "./init";
import { canEditPermissions } from "./authUtils";

// ============================================
// TYPES
// ============================================

interface UpdatePermissionsInput {
  memberId: string;
  permissions: {
    [pageId: string]: {
      canView: boolean;
      canCreate?: boolean;
      canEdit?: boolean;
      canDelete?: boolean;
    };
  };
}

// ============================================
// CLOUD FUNCTION (Firebase Functions v1)
// ============================================

export const updateMemberPermissions = functions
  .region("southamerica-east1")
  .https.onCall(async (data: UpdatePermissionsInput, context) => {
    // const db = getFirestore();

    // ========================================
    // 1. AUTHENTICATION CHECK
    // ========================================

    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Você precisa estar logado."
      );
    }

    const masterId = context.auth.uid;
    const { memberId, permissions } = data;

    // ========================================
    // DEBUG LOG - VALIDATE DEPLOYMENT
    // ========================================
    console.log("[updateMemberPermissions] called", {
      callerUid: masterId,
      memberId: memberId,
      permissionKeys: permissions ? Object.keys(permissions) : [],
      timestamp: new Date().toISOString(),
    });

    // ========================================
    // 2. INPUT VALIDATION
    // ========================================

    if (!memberId || typeof memberId !== "string") {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "ID do membro é obrigatório."
      );
    }

    if (!permissions || typeof permissions !== "object") {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Permissões são obrigatórias."
      );
    }

    // ========================================
    // 3. VERIFY MASTER ROLE
    // ========================================

    // Parallel Fetch (Master, Member)
    const masterRef = db.collection("users").doc(masterId);
    const memberRef = db.collection("users").doc(memberId);

    const [masterDoc, memberDoc] = await Promise.all([
      masterRef.get(),
      memberRef.get(),
    ]);

    // Validation (Master)
    if (!masterDoc.exists) {
      throw new functions.https.HttpsError(
        "not-found",
        "Usuário não encontrado."
      );
    }
    const masterData = masterDoc.data();
    if (!canEditPermissions(masterData?.role)) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Apenas administradores podem editar permissões."
      );
    }
    console.log(
      "[updateMemberPermissions] role verified - NO subscription check",
      {
        role: masterData?.role,
        callerUid: masterId,
      }
    );

    // Validation (Member)
    if (!memberDoc.exists) {
      throw new functions.https.HttpsError(
        "not-found",
        "Membro não encontrado."
      );
    }
    const memberData = memberDoc.data();
    if (memberData?.masterId !== masterId) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Você não pode editar permissões deste usuário."
      );
    }

    // ========================================
    // 5. UPDATE PERMISSIONS
    // ========================================

    const batch = db.batch();
    const permissionsRef = db
      .collection("users")
      .doc(memberId)
      .collection("permissions");

    for (const [pageId, perms] of Object.entries(permissions)) {
      const permDoc = permissionsRef.doc(pageId);

      batch.set(permDoc, {
        pageId,
        pageSlug: `/${pageId}`,
        canView: perms.canView ?? false,
        canCreate: perms.canCreate ?? false,
        canEdit: perms.canEdit ?? false,
        canDelete: perms.canDelete ?? false,
        updatedAt: new Date().toISOString(),
        updatedBy: masterId,
      });
    }

    await batch.commit();

    return {
      success: true,
      message: "Permissões atualizadas com sucesso!",
      memberId,
    };
  });
