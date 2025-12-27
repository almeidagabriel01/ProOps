/**
 * Cloud Function: Create Proposal
 *
 * Creates a proposal in a multi-tenant ERP SaaS with:
 * - Permission verification (canView + canCreate on proposals page)
 * - Plan limit enforcement (maxProposals)
 * - Automatic MASTER resolution (for both MASTER and MEMBER users)
 * - Atomic writes with usage counter increment
 *
 * SECURITY: All sensitive data (createdById, companyId) is derived from
 * the authenticated user - NEVER trusted from frontend input.
 *
 * DEPLOYMENT:
 * 1. Copy to functions/src/createProposal.ts
 * 2. Export from functions/src/index.ts
 * 3. Deploy: firebase deploy --only functions
 *
 * MIGRATED TO V1: Uses firebase-functions (v1) for full httpsCallable compatibility
 */

import * as functions from "firebase-functions";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";

// Initialize Firebase Admin (only once)
if (getApps().length === 0) {
  initializeApp();
}

// ============================================
// TYPES
// ============================================

/** Proposal section structure */
interface ProposalSection {
  id: string;
  type: string;
  title: string;
  content: string;
  order: number;
}

/** Input from frontend - only business data, NO sensitive fields */
interface CreateProposalInput {
  title: string;
  clientId: string;
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  clientAddress?: string;
  validUntil?: string;
  status?: string;
  sections?: ProposalSection[];
  products?: ProposalProduct[];
  sistemas?: ProposalSistema[];
  totalValue: number;
  discount?: number;
  notes?: string;
  customNotes?: string;
}

/** Product structure for proposal */
interface ProposalProduct {
  productId: string;
  productName: string;
  productImage?: string;
  productImages?: string[];
  productDescription?: string;
  quantity: number;
  unitPrice: number;
  total: number;
  manufacturer?: string;
  category?: string;
  systemInstanceId?: string;
  isExtra?: boolean;
}

/** Sistema structure for automation niche */
interface ProposalSistema {
  sistemaId: string;
  sistemaName: string;
  ambienteId: string;
  ambienteName: string;
  description?: string;
  productIds?: string[];
}

/** User document structure */
interface UserDoc {
  name: string;
  role: "MASTER" | "MEMBER";
  masterId: string | null; // null for MASTER, userId for MEMBER
  tenantId: string;
  companyId?: string; // Legacy/Optional
  planId?: string;
  companyName: string;
  masterID?: string; // Legacy
  ownerId?: string; // Legacy
  subscription?: {
    limits: {
      maxProposals: number;
      maxUsers: number;
      maxClients: number;
      maxProducts: number;
    };
    status: "ACTIVE" | "TRIALING" | "PAST_DUE" | "CANCELED";
  };
  usage?: {
    proposals: number;
    users: number;
    clients: number;
    products: number;
  };
}

/** Permission document structure */
interface PermissionDoc {
  pageSlug: string;
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

// ============================================
// CLOUD FUNCTION (Firebase Functions v1)
// ============================================

/**
 * Firebase Callable Function to create a Proposal.
 *
 * Both MASTER and MEMBER users can create proposals if they have permission.
 * Usage always counts against the MASTER's plan limits.
 *
 * @example Frontend call:
 * ```typescript
 * import { getFunctions, httpsCallable } from 'firebase/functions';
 *
 * const functions = getFunctions(app, 'southamerica-east1');
 * const createProposal = httpsCallable(functions, 'createProposal');
 *
 * const result = await createProposal({
 *   title: "Proposta Comercial",
 *   clientId: "abc123",
 *   clientName: "Empresa Cliente",
 *   sections: [...],
 *   totalValue: 15000
 * });
 *
 * console.log(result.data.proposalId);
 * ```
 */
export const createProposal = functions
  .region("southamerica-east1")
  .https.onCall(async (data: CreateProposalInput, context) => {
    const db = getFirestore();

    // ============================================
    // STEP 1: Validate Authentication
    // ============================================

    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Você precisa estar logado para criar propostas"
      );
    }

    const userId = context.auth.uid;
    const input = data;

    // ============================================
    // STEP 2: Validate Input
    // ============================================

    if (!input.title || input.title.trim().length < 3) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Título da proposta deve ter pelo menos 3 caracteres"
      );
    }

    if (!input.clientId || !input.clientName) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Cliente é obrigatório"
      );
    }

    if (typeof input.totalValue !== "number" || input.totalValue < 0) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Valor total deve ser um número válido"
      );
    }

    // ============================================
    // STEP 3: Fetch User Data
    // ============================================

    const userRef = db.collection("users").doc(userId);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      throw new functions.https.HttpsError(
        "not-found",
        "Usuário não encontrado"
      );
    }

    const userData = userSnap.data() as UserDoc;

    // Fallback to companyId if tenantId is missing (backward compatibility)
    const userCompanyId = userData.tenantId || userData.companyId;

    if (!userCompanyId) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "Erro de consistência: Usuário sem tenantId/companyId vinculado."
      );
    }

    // ============================================
    // STEP 4 & 5: Check Permission & Resolve Master (Parallelized)
    // ============================================

    // ============================================
    // STEP 4 & 5: Check Permission & Resolve Master (Parallelized)
    // ============================================

    let masterData: UserDoc;
    let masterRef: FirebaseFirestore.DocumentReference;

    const role = (userData.role as string)?.toUpperCase();
    const isMasterOrAdmin =
      role === "MASTER" ||
      role === "ADMIN" ||
      role === "WK" ||
      (!userData.masterId && userData.subscription);

    if (isMasterOrAdmin) {
      // User IS the master
      masterData = userData;
      masterRef = userRef;
    } else {
      // User is MEMBER - Parallelize Permission and Master fetch
      // Use extended interface or safe access
      const masterId =
        userData.masterId || userData.masterID || userData.ownerId;
      if (!masterId) {
        throw new functions.https.HttpsError(
          "failed-precondition",
          "Erro na configuração da conta. Contate o administrador."
        );
      }

      const permissionId = "proposals";
      const permRef = userRef.collection("permissions").doc(permissionId);
      masterRef = db.collection("users").doc(masterId);

      const [permSnap, masterSnap] = await Promise.all([
        permRef.get(),
        masterRef.get(),
      ]);

      // Check Permission
      if (!permSnap.exists) {
        throw new functions.https.HttpsError(
          "permission-denied",
          "Você não tem permissão para acessar propostas"
        );
      }
      const permission = permSnap.data() as PermissionDoc;
      if (!permission.canView)
        throw new functions.https.HttpsError(
          "permission-denied",
          "Você não tem permissão para visualizar propostas"
        );
      if (!permission.canCreate)
        throw new functions.https.HttpsError(
          "permission-denied",
          "Você não tem permissão para criar propostas"
        );

      // Check Master
      if (!masterSnap.exists) {
        throw new functions.https.HttpsError(
          "failed-precondition",
          "Conta principal não encontrada. Contate o administrador."
        );
      }

      masterData = masterSnap.data() as UserDoc;
    }

    // ============================================
    // STEP 6: Check Subscription Status (Relaxed/Robust)
    // ============================================
    // We skipping strict checks here because Step 7 handles missing subscriptions via Default/Legacy plans.
    // However, if a subscription object EXISTS but is invalid, we might want to flag it.
    // But for now, since Admin users might not have a subscription object at all, we proceed.

    if (masterData.subscription) {
      const subscriptionStatus = masterData.subscription.status;
      if (
        subscriptionStatus !== "ACTIVE" &&
        subscriptionStatus !== "TRIALING"
      ) {
        throw new functions.https.HttpsError(
          "failed-precondition",
          "O plano está inativo. Regularize a assinatura para continuar."
        );
      }
    }

    // ============================================
    // STEP 7: Check Plan Limits (maxProposals) - Robust Resolution
    // ============================================

    let maxProposalsVal = 5; // Default Free Limit
    const planId = masterData.planId || "free";

    const LEGACY_LIMITS: Record<string, number> = {
      free: 5,
      starter: 80,
      pro: -1,
      enterprise: -1,
    };

    if (LEGACY_LIMITS[planId] !== undefined) {
      maxProposalsVal = LEGACY_LIMITS[planId];
    } else {
      if (masterData.subscription?.limits?.maxProposals !== undefined) {
        maxProposalsVal = masterData.subscription.limits.maxProposals;
      } else {
        console.log(`[createProposal] Fetching dynamic plan: ${planId}`);
        const planRef = db.collection("plans").doc(planId); // Correct ref usage
        const planSnap = await planRef.get();
        if (planSnap.exists) {
          maxProposalsVal = planSnap.data()?.features?.maxProposals ?? 5;
        }
      }
    }

    const maxProposals = Number(maxProposalsVal);
    const currentProposals = Number(masterData.usage?.proposals ?? 0);

    // -1 means unlimited. Use >= 0 to check if limit exists.
    if (maxProposals >= 0 && currentProposals >= maxProposals) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        `Limite de propostas atingido (${currentProposals}/${maxProposals}). ` +
          `Faça upgrade do plano para criar mais propostas.`
      );
    }

    // ============================================
    // STEP 8: Create Proposal (Atomic Transaction)
    // ============================================

    let proposalId: string;

    try {
      proposalId = await db.runTransaction(async (transaction) => {
        const now = Timestamp.now();

        // 8a. Re-read MASTER's usage inside transaction for consistency
        const freshMasterSnap = await transaction.get(masterRef);
        // Use resolved ID
        const companyRef = db.collection("companies").doc(userCompanyId);
        const companySnap = await transaction.get(companyRef);

        const freshMasterData = freshMasterSnap.data() as UserDoc;
        const freshCurrentProposals = Number(
          freshMasterData.usage?.proposals ?? 0
        );

        // Double-check limit inside transaction (prevents race conditions)
        if (maxProposals >= 0 && freshCurrentProposals >= maxProposals) {
          throw new functions.https.HttpsError(
            "failed-precondition",
            `Limite de propostas atingido. Tente novamente.`
          );
        }

        // 8b. Create new proposal document
        const proposalsRef = db.collection("proposals"); // Changed to root collection directly
        const newProposalRef = proposalsRef.doc(); // Auto-generate ID

        transaction.set(newProposalRef, {
          // Business data from input
          title: input.title.trim(),
          status: input.status || "draft",
          totalValue: input.totalValue,
          notes: input.notes?.trim() || null,
          customNotes: input.customNotes?.trim() || null,
          discount: input.discount || 0,
          validUntil: input.validUntil || null,

          // Client info (from input, but validated)
          clientId: input.clientId,
          clientName: input.clientName,
          clientEmail: input.clientEmail || null,
          clientPhone: input.clientPhone || null,
          clientAddress: input.clientAddress || null,

          // Products
          products: input.products || [],

          // Sistemas (for automation niche)
          sistemas: input.sistemas || [],

          // Sections (optional)
          sections: input.sections || [],

          // ===== SECURITY: DERIVED FROM BACKEND, NOT FRONTEND =====
          // Creator info - derived from authenticated user
          createdById: userId,
          createdByName: userData.name,

          // Company - derived from user's company
          companyId: userCompanyId, // Using tenantId/companyId consistent var
          tenantId: userCompanyId, // Redundant but safe

          // Timestamps
          createdAt: now,
          updatedAt: now,
        });

        // 8c. Increment MASTER's usage.proposals
        transaction.update(masterRef, {
          "usage.proposals": FieldValue.increment(1),
          updatedAt: now,
        });

        // 8d. Increment Company's usage.proposals
        if (companySnap.exists) {
          transaction.update(companyRef, {
            "usage.proposals": FieldValue.increment(1),
            updatedAt: now,
          });
        }

        return newProposalRef.id;
      });
    } catch (err) {
      // If it's already an HttpsError, re-throw as-is
      if (err instanceof functions.https.HttpsError) {
        throw err;
      }

      console.error("Transaction failed:", err);
      throw new functions.https.HttpsError(
        "internal",
        `Erro ao criar proposta: ${(err as Error).message}`
      );
    }

    // ============================================
    // STEP 9: Return Success
    // ============================================

    return {
      success: true,
      proposalId: proposalId,
      message: `Proposta "${input.title}" criada com sucesso!`,
    };
  });
