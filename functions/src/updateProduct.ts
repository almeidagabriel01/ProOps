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
import { Timestamp } from "firebase-admin/firestore";
import { db } from "./init";

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
  status?: "active" | "inactive";
}

interface UserDoc {
  role: "MASTER" | "MEMBER";
  masterId: string | null;
  tenantId: string;
  companyId?: string;
  subscription?: { status: string };
}

export const updateProduct = functions
  .region("southamerica-east1")
  .https.onCall(async (data: UpdateProductInput, context) => {
    console.log("updateProduct: Function started", { data, auth: context.auth?.uid });

    try {
      // 1. Auth Check
      if (!context.auth) {
        console.warn("updateProduct: Unauthenticated");
        throw new functions.https.HttpsError(
          "unauthenticated",
          "Login necessário."
        );
      }
      const userId = context.auth.uid;
      const { productId, ...updateData } = data;

      if (!productId) {
        throw new functions.https.HttpsError(
          "invalid-argument",
          "ID do produto inválido."
        );
      }

      // 2. Parallel Fetch (User, Product, Permission)
      const userRef = db.collection("users").doc(userId);
      const productRef = db.collection("products").doc(productId);
      const permRef = userRef.collection("permissions").doc("products");

      const [userSnap, productSnap, permSnap] = await Promise.all([
        userRef.get(),
        productRef.get(),
        permRef.get(),
      ]);

      // 3. Validate Existences
      if (!userSnap.exists) {
        throw new functions.https.HttpsError(
          "not-found",
          "Usuário não encontrado."
        );
      }
      if (!productSnap.exists) {
        throw new functions.https.HttpsError(
          "not-found",
          "Produto não encontrado."
        );
      }

      const userData = userSnap.data() as UserDoc;
      const productData = productSnap.data();
      const tenantId = userData.tenantId || userData.companyId;
      const isSuperAdmin = (userData.role as string)?.toLowerCase() === "superadmin";

      if (!tenantId && !isSuperAdmin) {
        throw new functions.https.HttpsError(
          "failed-precondition",
          "Usuário sem tenantId."
        );
      }

      // Super admin can update any product
      if (!isSuperAdmin && productData?.tenantId !== tenantId) {
        throw new functions.https.HttpsError(
          "permission-denied",
          "Este produto não pertence a sua organização."
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
            "Sem permissão para editar produtos."
          );
        }
      }

      // 5. Build Safe Update Object
      const safeUpdate: Record<string, unknown> = {
        updatedAt: Timestamp.now(),
      };

      if (updateData.name !== undefined) safeUpdate.name = updateData.name;
      if (updateData.description !== undefined)
        safeUpdate.description = updateData.description;
      if (updateData.price !== undefined) safeUpdate.price = updateData.price;
      if (updateData.manufacturer !== undefined)
        safeUpdate.manufacturer = updateData.manufacturer;
      if (updateData.category !== undefined)
        safeUpdate.category = updateData.category;
      if (updateData.sku !== undefined) safeUpdate.sku = updateData.sku;
      if (updateData.stock !== undefined) safeUpdate.stock = updateData.stock;
      if (updateData.images !== undefined) safeUpdate.images = updateData.images;
      if (updateData.image !== undefined) safeUpdate.image = updateData.image;
      if (updateData.status !== undefined) safeUpdate.status = updateData.status;

      // 6. Update Product
      await productRef.update(safeUpdate);
      console.log(`updateProduct: Success for ${productId}`);
      return { success: true, message: "Produto atualizado com sucesso." };
    } catch (error) {
       console.error("updateProduct: Critical Error", error);
       if (error instanceof functions.https.HttpsError) throw error;
       throw new functions.https.HttpsError(
         "internal",
         `Erro ao atualizar produto: ${(error as Error).message}`
       );
    }
  });
