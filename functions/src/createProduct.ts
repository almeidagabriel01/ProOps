/**
 * Cloud Function: Create Product
 *
 * Creates a product in a multi-tenant ERP SaaS with:
 * - Permission verification
 * - Plan limit enforcement (maxProducts)
 * - Atomic writes with usage counter increment
 */

import * as functions from "firebase-functions";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";

if (getApps().length === 0) {
  initializeApp();
}

interface CreateProductInput {
  name: string;
  description: string;
  price: string;
  manufacturer: string;
  category: string;
  sku: string;
  stock: string;
  status?: string;
  images: string[];
}

interface UserDoc {
  role: "MASTER" | "MEMBER" | "ADMIN" | "WK";
  masterId: string | null;
  masterID?: string; // Legacy support
  ownerId?: string; // Legacy support
  tenantId: string;
  companyId?: string;
  planId?: string;
  companyName?: string;
  subscription?: {
    limits: {
      maxProducts: number;
    };
    status: string;
  };
  usage?: {
    products: number;
  };
}

export const createProduct = functions
  .region("southamerica-east1")
  .https.onCall(async (data: CreateProductInput, context) => {
    const db = getFirestore();

    // 1. Authentication
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Login necessário."
      );
    }

    const userId = context.auth.uid;
    const input = data;

    // 2. Input Validation
    if (!input.name || input.name.trim().length < 2) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Nome inválido."
      );
    }

    // 3. Data Fetching
    const userRef = db.collection("users").doc(userId);
    const userSnap = await userRef.get();
    if (!userSnap.exists)
      throw new functions.https.HttpsError(
        "not-found",
        "Usuário não encontrado."
      );

    const userData = userSnap.data() as UserDoc;
    const userCompanyId = userData.tenantId || userData.companyId;

    if (!userCompanyId) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "Usuário sem tenantId/companyId vinculado."
      );
    }

    let effectiveMasterId: string;
    let masterData: UserDoc;
    let masterRef: FirebaseFirestore.DocumentReference;

    const role = (userData.role as string)?.toUpperCase();
    const isMaster =
      role === "MASTER" ||
      role === "ADMIN" ||
      role === "WK" ||
      (!userData.masterId && !userData.masterID && userData.subscription);

    if (isMaster) {
      effectiveMasterId = userId;
      masterData = userData;
      masterRef = userRef;
    } else {
      const masterId =
        userData.masterId || userData.masterID || userData.ownerId;
      if (!masterId)
        throw new functions.https.HttpsError(
          "failed-precondition",
          "Erro de configuração."
        );
      effectiveMasterId = masterId;
      masterRef = db.collection("users").doc(effectiveMasterId);
      const masterSnap = await masterRef.get();
      if (!masterSnap.exists)
        throw new functions.https.HttpsError(
          "not-found",
          "Conta principal 404."
        );
      masterData = masterSnap.data() as UserDoc;
    }

    const targetCompanyId = masterData.companyId || masterData.tenantId;

    if (!targetCompanyId) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "Configuração de conta inválida: companyId/tenantId ausente."
      );
    }

    const companyRef = db.collection("companies").doc(targetCompanyId);
    const companySnap = await companyRef.get();

    // 4. Permission Check
    if (userData.role === "MEMBER") {
      const permRef = userRef.collection("permissions").doc("products");
      const permSnap = await permRef.get();
      if (!permSnap.exists || !permSnap.data()?.canCreate) {
        throw new functions.https.HttpsError(
          "permission-denied",
          "Sem permissão para criar produtos."
        );
      }
    }

    // 5. Plan Limit Enforcement
    const maxProducts = masterData.subscription?.limits?.maxProducts;
    const currentProducts = masterData.usage?.products || 0;

    if (maxProducts !== undefined && currentProducts >= maxProducts) {
      throw new functions.https.HttpsError(
        "resource-exhausted",
        "Limite de produtos atingido para o seu plano."
      );
    }

    // 6. Atomic Write with Usage Counter Increment
    const now = Timestamp.now();
    let productId: string;

    try {
      productId = await db.runTransaction(async (transaction) => {
        const newProductRef = db.collection("products").doc(); // Auto-generate ID

        transaction.set(newProductRef, {
          tenantId: targetCompanyId,
          name: input.name.trim(),
          description: input.description || "",
          price: input.price, // string or number? Input says string, but ideally value
          manufacturer: input.manufacturer || "",
          category: input.category || "",
          sku: input.sku || "",
          stock: input.stock || "0",
          status: input.status || "active",
          images: input.images || [],
          createdAt: now,
          updatedAt: now,
        });

        transaction.update(masterRef, {
          "usage.products": FieldValue.increment(1),
          updatedAt: now,
        });

        if (companySnap.exists) {
          transaction.update(companyRef, {
            "usage.products": FieldValue.increment(1),
            updatedAt: now,
          });
        } else {
          console.warn(
            `[createProduct] Company ${targetCompanyId} not found. Skipping usage increment.`
          );
        }

        return newProductRef.id;
      });

      return {
        success: true,
        productId,
        message: "Produto criado com sucesso!",
      };
    } catch (error) {
      console.error("Create Product Error:", error);
      if (error instanceof functions.https.HttpsError) throw error;
      throw new functions.https.HttpsError(
        "internal",
        `Erro ao criar produto: ${(error as Error).message}`
      );
    }
  });
