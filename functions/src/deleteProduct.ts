/**
 * Cloud Function: Delete Product
 */

import * as functions from "firebase-functions";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { db } from "./init";

/**
 * Helper function to delete images from Firebase Storage
 * Handles both Storage URLs and paths
 */
async function deleteProductImages(
  images: string[] | undefined
): Promise<void> {
  if (!images || images.length === 0) return;

  const bucket = getStorage().bucket();

  for (const imageUrl of images) {
    try {
      // Skip Base64 images (legacy)
      if (imageUrl.startsWith("data:")) {
        continue;
      }

      let filePath: string | null = null;

      // Extract path from Firebase Storage URL
      if (imageUrl.includes("firebasestorage.googleapis.com")) {
        const decodedUrl = decodeURIComponent(imageUrl);
        const match = decodedUrl.match(/\/o\/(.+?)\?/);
        if (match) {
          filePath = match[1];
        }
      } else if (imageUrl.includes("storage.googleapis.com")) {
        // Format: https://storage.googleapis.com/bucket/path/to/file
        const urlParts = imageUrl.split("/");
        const bucketIndex = urlParts.findIndex(
          (p) => p.includes(".appspot.com") || p.includes("firebasestorage.app")
        );
        if (bucketIndex >= 0) {
          filePath = urlParts.slice(bucketIndex + 1).join("/");
        }
      } else if (imageUrl.startsWith("tenants/")) {
        // Already a path
        filePath = imageUrl;
      }

      if (filePath) {
        await bucket.file(filePath).delete();
        console.log(`[deleteProduct] Deleted image: ${filePath}`);
      }
    } catch (error) {
      // Don't fail if image doesn't exist
      const err = error as { code?: number | string; message?: string };
      if (err.code === 404 || err.message?.includes("No such object")) {
        console.warn(
          `[deleteProduct] Image not found (already deleted?): ${imageUrl}`
        );
      } else {
        console.error(
          `[deleteProduct] Error deleting image: ${imageUrl}`,
          error
        );
      }
    }
  }
}

export const deleteProduct = functions
  .region("southamerica-east1")
  .https.onCall(async (data: { productId: string }, context) => {
    // const db = getFirestore();

    if (!context.auth)
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Login necessário."
      );
    const userId = context.auth.uid;
    const { productId } = data;

    if (!productId)
      throw new functions.https.HttpsError(
        "invalid-argument",
        "ID do produto obrigatório."
      );

    // 1. Parallel Fetch (User, Product, Permission)
    const userRef = db.collection("users").doc(userId);
    const productRef = db.collection("products").doc(productId);
    const permRef = userRef.collection("permissions").doc("products");

    const [userSnap, productSnap, permSnap] = await Promise.all([
      userRef.get(),
      productRef.get(),
      permRef.get(),
    ]);

    if (!userSnap.exists)
      throw new functions.https.HttpsError(
        "not-found",
        "Usuário não encontrado."
      );
    if (!productSnap.exists)
      throw new functions.https.HttpsError(
        "not-found",
        "Produto não encontrado."
      );

    interface LocalUserDoc {
      role: string;
      masterId?: string | null;
      masterID?: string | null;
      ownerId?: string | null;
      tenantId?: string;
      companyId?: string;
      subscription?: Record<string, unknown>;
    }
    const userData = userSnap.data() as LocalUserDoc;
    const productData = productSnap.data();
    const isSuperAdmin = (userData.role as string)?.toLowerCase() === "superadmin";

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
      if (!masterId)
        throw new functions.https.HttpsError(
          "failed-precondition",
          "Configuração de conta inválida: masterId ausente."
        );
      masterRef = db.collection("users").doc(masterId);
    }

    const userCompanyId = userData.companyId || userData.tenantId;
    if (!userCompanyId && !isSuperAdmin) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "Configuração de conta inválida: companyId/tenantId ausente."
      );
    }

    // Super admin can delete any product
    if (!isSuperAdmin && productData?.tenantId !== userCompanyId) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Acesso negado (Tenant Mismatch)."
      );
    }

    // Permission Check
    if (role === "MEMBER") {
      if (!permSnap.exists || !permSnap.data()?.canDelete) {
        throw new functions.https.HttpsError(
          "permission-denied",
          "Sem permissão para deletar produtos."
        );
      }
    }

    // Deletion Transaction
    try {
      // Delete images from Storage BEFORE deleting the document
      // (Using productData fetched above)
      const images = productData?.images as string[] | undefined;
      await deleteProductImages(images);
      console.log(
        `[deleteProduct] Deleted ${images?.length || 0} images for product ${productId}`
      );

      // Now run the transaction to delete the Firestore document
      await db.runTransaction(async (transaction) => {
        const companyRef = userCompanyId ? db.collection("companies").doc(userCompanyId) : null;
        const companySnap = companyRef ? await transaction.get(companyRef) : null;

        // WRITES
        transaction.delete(productRef);

        transaction.update(masterRef, {
          "usage.products": FieldValue.increment(-1),
          updatedAt: Timestamp.now(),
        });

        if (companySnap && companySnap.exists && companyRef) {
          transaction.update(companyRef, {
            "usage.products": FieldValue.increment(-1),
            updatedAt: Timestamp.now(),
          });
        } else {
          console.warn(
            `[deleteProduct] Company ${userCompanyId} not found. Skipping usage update.`
          );
        }
      });

      return { success: true, message: "Produto e imagens removidos." };
    } catch (error) {
      console.error("Delete Product Error:", error);
      if (error instanceof functions.https.HttpsError) throw error;
      throw new functions.https.HttpsError(
        "internal",
        `Erro ao deletar produto: ${(error as Error).message}`
      );
    }
  });
