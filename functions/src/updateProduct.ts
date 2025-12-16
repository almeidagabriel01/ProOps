/**
 * Cloud Function: Update Product
 * 
 * Updates an existing product in a multi-tenant ERP SaaS with:
 * - Permission verification (canEdit on products page)
 * - Ownership verification (product belongs to user's tenant)
 * 
 * SECURITY: All sensitive data validation happens server-side.
 */

import * as functions from "firebase-functions";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

interface UpdateProductInput {
  productId: string;
  name?: string;
  description?: string;
  price?: string;
  manufacturer?: string;
  category?: string;
  sku?: string;
  stock?: string;
  images?: string[];
  image?: string;
  status?: 'active' | 'inactive';
}

interface UserDoc {
  role: 'MASTER' | 'MEMBER';
  masterId: string | null;
  tenantId: string;
  companyId?: string;
  subscription?: { status: string };
}

export const updateProduct = functions
  .region("southamerica-east1")
  .https.onCall(async (data: UpdateProductInput, context) => {
    const db = getFirestore();

    // 1. Auth Check
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Login necessário.");
    }
    const userId = context.auth.uid;
    const { productId, ...updateData } = data;

    if (!productId) {
      throw new functions.https.HttpsError("invalid-argument", "ID do produto inválido.");
    }

    // 2. Fetch User
    const userRef = db.collection('users').doc(userId);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      throw new functions.https.HttpsError("not-found", "Usuário não encontrado.");
    }
    const userData = userSnap.data() as UserDoc;
    const tenantId = userData.tenantId || userData.companyId;

    if (!tenantId) {
      throw new functions.https.HttpsError("failed-precondition", "Usuário sem tenantId.");
    }

    // 3. Permission Check
    const role = (userData.role as string)?.toUpperCase();
    const isMaster = role === 'MASTER' || role === 'ADMIN' || role === 'WK' || (!userData.masterId && userData.subscription);

    if (!isMaster) {
      const permRef = userRef.collection('permissions').doc('products');
      const permSnap = await permRef.get();
      if (!permSnap.exists || !permSnap.data()?.canEdit) {
        throw new functions.https.HttpsError("permission-denied", "Sem permissão para editar produtos.");
      }
    }

    // 4. Fetch and Validate Product
    const productRef = db.collection('products').doc(productId);
    const productSnap = await productRef.get();

    if (!productSnap.exists) {
      throw new functions.https.HttpsError("not-found", "Produto não encontrado.");
    }

    const productData = productSnap.data();
    if (productData?.tenantId !== tenantId) {
      throw new functions.https.HttpsError("permission-denied", "Este produto não pertence a sua organização.");
    }

    // 5. Build Safe Update Object
    const safeUpdate: Record<string, any> = {
      updatedAt: Timestamp.now(),
    };

    if (updateData.name !== undefined) safeUpdate.name = updateData.name;
    if (updateData.description !== undefined) safeUpdate.description = updateData.description;
    if (updateData.price !== undefined) safeUpdate.price = updateData.price;
    if (updateData.manufacturer !== undefined) safeUpdate.manufacturer = updateData.manufacturer;
    if (updateData.category !== undefined) safeUpdate.category = updateData.category;
    if (updateData.sku !== undefined) safeUpdate.sku = updateData.sku;
    if (updateData.stock !== undefined) safeUpdate.stock = updateData.stock;
    if (updateData.images !== undefined) safeUpdate.images = updateData.images;
    if (updateData.image !== undefined) safeUpdate.image = updateData.image;
    if (updateData.status !== undefined) safeUpdate.status = updateData.status;

    // 6. Update Product
    try {
      await productRef.update(safeUpdate);
      return { success: true, message: "Produto atualizado com sucesso." };
    } catch (error) {
      console.error("Update Product Error:", error);
      throw new functions.https.HttpsError("internal", (error as Error).message);
    }
  });
