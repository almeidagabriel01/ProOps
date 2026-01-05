/**
 * Cloud Function: Create Client
 *
 * Creates a client in a multi-tenant ERP SaaS with:
 * - Permission verification (canManageTeam/MASTER role)
 * - Plan limit enforcement (maxClients)
 * - Atomic writes with usage counter increment
 *
 * SECURITY: All sensitive data (companyId) is derived from
 * the authenticated user - NEVER trusted from frontend input.
 */

import * as functions from "firebase-functions";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { db } from "./init";

// ============================================
// TYPES
// ============================================

interface CreateClientInput {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
  source: "manual" | "proposal" | "financial";
  sourceId?: string;
}

interface UserDoc {
  role: "MASTER" | "MEMBER";
  masterId: string | null;
  tenantId: string;
  companyId?: string;
  planId?: string; // Added planId
  companyName: string;
  masterID?: string; // Legacy
  ownerId?: string; // Legacy
  subscription?: {
    limits: {
      maxClients: number;
    };
    status: string;
  };
  usage?: {
    clients: number;
  };
}

// ============================================
// CLOUD FUNCTION
// ============================================

export const createClient = functions
  .region("southamerica-east1")
  .https.onCall(async (data: CreateClientInput, context) => {
    console.log("createClient v2: Started", { data, auth: context.auth?.uid });
    
    try {
      // 1. Authentication
      if (!context.auth) {
        console.warn("createClient: Unauthenticated");
        throw new functions.https.HttpsError(
          "unauthenticated",
          "Você precisa estar logado para criar clientes"
        );
      }

      const userId = context.auth.uid;
      const input = data;

      // 2. Input Validation
      if (!input.name || input.name.trim().length < 2) {
        throw new functions.https.HttpsError(
          "invalid-argument",
          "Nome deve ter pelo menos 2 caracteres"
        );
      }

      // 3. Fetch User & Master Data
      const userRef = db.collection("users").doc(userId);
      const userSnap = await userRef.get();

      if (!userSnap.exists) {
        throw new functions.https.HttpsError(
          "not-found",
          "Usuário não encontrado"
        );
      }

      const userData = (userSnap.data() || {}) as UserDoc;
      // Fallback
      const userCompanyId = userData.tenantId || userData.companyId;

      if (!userCompanyId) {
        throw new functions.https.HttpsError(
          "failed-precondition",
          "Usuário sem tenantId/companyId vinculado."
        );
      }

      // Resolve Master
      let masterData: UserDoc;
      let masterRef: FirebaseFirestore.DocumentReference;

      const role = (userData.role as string)?.toUpperCase();
      const isMaster =
        role === "MASTER" ||
        role === "ADMIN" ||
        role === "WK" ||
        (!userData.masterId && !userData.masterID && userData.subscription);

      if (isMaster) {
        masterData = userData;
        masterRef = userRef;
      } else {
        const masterId =
          userData.masterId || userData.masterID || userData.ownerId;
        if (!masterId)
          throw new functions.https.HttpsError(
            "failed-precondition",
            "Erro de configuração de conta."
          );

        const permRef = userRef.collection("permissions").doc("clients");
        const masterDocRef = db.collection("users").doc(masterId);

        // Parallel Fetch for Optimization
        const [permSnap, masterSnap] = await Promise.all([
          permRef.get(),
          masterDocRef.get(),
        ]);

        // Check Permission
        if (!permSnap.exists || !permSnap.data()?.canCreate) {
          throw new functions.https.HttpsError(
            "permission-denied",
            "Sem permissão para criar clientes."
          );
        }

        if (!masterSnap.exists)
          throw new functions.https.HttpsError(
            "not-found",
            "Conta principal não encontrada."
          );

        masterData = masterSnap.data() as UserDoc;
        masterRef = masterDocRef;
      }

      const targetCompanyId =
        masterData.companyId ||
        masterData.tenantId ||
        userData.companyId ||
        userData.tenantId;

      if (!targetCompanyId) {
        throw new functions.https.HttpsError(
          "failed-precondition",
          "Configuração de conta inválida: companyId/tenantId ausente."
        );
      }

      // 5. Check Limits (Robust Resolution)
      let maxClientsVal = 10; // Default Free Limit
      const planId = masterData.planId || "free";

      // 1. Check legacy/hardcoded limits (optimization)
      const LEGACY_LIMITS: Record<string, number> = {
        free: 10,
        starter: 120,
        pro: -1,
        enterprise: -1,
      };

      if (LEGACY_LIMITS[planId] !== undefined) {
        maxClientsVal = LEGACY_LIMITS[planId];
      } else {
        // 2. Fetch from Firestore if not known legacy plan
        // Try masterData.subscription first (fastest)
        if (masterData.subscription?.limits?.maxClients !== undefined) {
          maxClientsVal = masterData.subscription.limits.maxClients;
        } else {
          // 3. Fetch plan document
          console.log(`[createClient] Fetching dynamic plan: ${planId}`);
          const planSnap = await db.collection("plans").doc(planId).get();
          if (planSnap.exists) {
            maxClientsVal = planSnap.data()?.features?.maxClients ?? 10;
          }
        }
      }

      const maxClients = Number(maxClientsVal);
      const currentClients = Number(masterData.usage?.clients ?? 0);

      console.log(
        `[createClient] Limit: ${maxClients}, Usage: ${currentClients}`
      );
      if (maxClients >= 0 && currentClients >= maxClients) {
        throw new functions.https.HttpsError(
          "resource-exhausted",
          `Limite de clientes atingido (${currentClients}/${maxClients}). Faça upgrade do plano.`
        );
      }

      // 6. Create Transaction
      const clientId = await db.runTransaction(async (transaction) => {
        const companyRef = db.collection("companies").doc(targetCompanyId);

        // READS
        const freshMasterSnap = await transaction.get(masterRef);
        const companySnap = await transaction.get(companyRef);

        // CHECKS
        const freshUsage = Number(freshMasterSnap.data()?.usage?.clients ?? 0);

        if (maxClients >= 0 && freshUsage >= maxClients) {
          throw new functions.https.HttpsError(
            "resource-exhausted",
            "Limite de clientes atingido."
          );
        }

        // WRITES
        const newClientRef = db.collection("clients").doc();
        const now = Timestamp.now();

        const clientData: Record<string, unknown> = {
          tenantId: targetCompanyId,
          name: input.name.trim(),
          source: input.source || "manual",
          sourceId: input.sourceId || null,
          createdAt: now,
          updatedAt: now,
        };

        if (input.email) clientData.email = input.email.toLowerCase().trim();
        if (input.phone) clientData.phone = input.phone;
        if (input.address) clientData.address = input.address;
        if (input.notes) clientData.notes = input.notes;

        transaction.set(newClientRef, clientData);

        transaction.update(masterRef, {
          "usage.clients": FieldValue.increment(1),
          updatedAt: now,
        });

        if (companySnap.exists) {
          transaction.update(companyRef, {
            "usage.clients": FieldValue.increment(1),
            updatedAt: now,
          });
        } else {
          console.warn(
            `[createClient] Company ${targetCompanyId} not found. Skipping usage increment.`
          );
        }

        return newClientRef.id;
      });

      console.log(`createClient: Success. ID: ${clientId}`);
      return {
        success: true,
        clientId,
        message: "Cliente criado com sucesso!",
      };
    } catch (error) {
      console.error("createClient: Critical Error", error);
      if (error instanceof functions.https.HttpsError) throw error;
      throw new functions.https.HttpsError(
        "internal",
        `Erro ao criar cliente: ${(error as Error).message}`
      );
    }
  });
