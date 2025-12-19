/**
 * Cloud Function: Delete Product
 */

import * as functions from "firebase-functions";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

if (getApps().length === 0) {
  initializeApp();
}

/**
 * Helper function to delete images from Firebase Storage
 * Handles both Storage URLs and paths
 */
async function deleteProductImages(images: string[] | undefined): Promise<void> {
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
        const bucketIndex = urlParts.findIndex((p) => p.includes(".appspot.com") || p.includes("firebasestorage.app"));
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
    } catch (error: any) {
      // Don't fail if image doesn't exist
      if (error.code === 404 || error.message?.includes("No such object")) {
        console.warn(`[deleteProduct] Image not found (already deleted?): ${imageUrl}`);
      } else {
        console.error(`[deleteProduct] Error deleting image: ${imageUrl}`, error);
      }
    }
  }
}

export const deleteProduct = functions
  .region("southamerica-east1")
  .https.onCall(async (data: { productId: string }, context) => {
    const db = getFirestore();
    
    if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Login necessário.");
    const userId = context.auth.uid;
    const { productId } = data;
    
    if (!productId) throw new functions.https.HttpsError("invalid-argument", "ID do produto obrigatório.");
    
    // Fetch User
    const userRef = db.collection('users').doc(userId);
    const userSnap = await userRef.get();
    if (!userSnap.exists) throw new functions.https.HttpsError("not-found", "Usuário não encontrado.");
    const userData = userSnap.data() as any;
    console.log(`[deleteProduct] User ${userId} data:`, JSON.stringify(userData));

    // Resolve Master
    let masterRef: FirebaseFirestore.DocumentReference;
    const role = userData.role?.toUpperCase();
    const isMaster = role === 'MASTER' || role === 'ADMIN' || role === 'WK' || (!userData.masterId && !userData.masterID && userData.subscription);

    if (isMaster) {
       masterRef = userRef;
    } else {
       const masterId = userData.masterId || userData.masterID || userData.ownerId;
       if (!masterId) throw new functions.https.HttpsError("failed-precondition", "Configuração de conta inválida: masterId ausente.");
       masterRef = db.collection('users').doc(masterId);
    }

    const userCompanyId = userData.companyId || userData.tenantId;
    if (!userCompanyId) {
        throw new functions.https.HttpsError("failed-precondition", "Configuração de conta inválida: companyId/tenantId ausente.");
    }
    
    // Permission
    if (userData.role === 'MEMBER') {
       const permRef = userRef.collection('permissions').doc('products');
       const permSnap = await permRef.get();
       if (!permSnap.exists || !permSnap.data()?.canDelete) {
          throw new functions.https.HttpsError("permission-denied", "Sem permissão para deletar produtos.");
       }
    }
    
    // Deletion Transaction
    try {
      // First, get the product to extract image URLs (outside transaction for Storage ops)
      const productRef = db.collection('products').doc(productId);
      const productSnap = await productRef.get();
      
      if (!productSnap.exists) {
        throw new functions.https.HttpsError("not-found", "Produto não encontrado.");
      }
      
      const productData = productSnap.data();
      if (productData?.tenantId !== userCompanyId) {
        throw new functions.https.HttpsError("permission-denied", "Acesso negado.");
      }
      
      // Delete images from Storage BEFORE deleting the document
      const images = productData?.images as string[] | undefined;
      await deleteProductImages(images);
      console.log(`[deleteProduct] Deleted ${images?.length || 0} images for product ${productId}`);
      
      // Now run the transaction to delete the Firestore document
      await db.runTransaction(async (transaction) => {
         const companyRef = db.collection('companies').doc(userCompanyId);
         const companySnap = await transaction.get(companyRef);
         
         // WRITES
         transaction.delete(productRef);
         
         transaction.update(masterRef, {
            'usage.products': FieldValue.increment(-1),
            updatedAt: Timestamp.now()
         });
         
         if (companySnap.exists) {
            transaction.update(companyRef, {
                'usage.products': FieldValue.increment(-1),
                updatedAt: Timestamp.now()
            });
         } else {
            console.warn(`[deleteProduct] Company ${userCompanyId} not found. Skipping usage update.`);
         }
      });
      
      return { success: true, message: "Produto e imagens removidos." };
    } catch (error) {
       console.error("Delete Product Error:", error);
       if (error instanceof functions.https.HttpsError) throw error;
       throw new functions.https.HttpsError("internal", `Erro ao deletar produto: ${(error as Error).message}`);
    }
  });

