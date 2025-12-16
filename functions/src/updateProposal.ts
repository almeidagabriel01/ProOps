/**
 * Cloud Function: Update Proposal
 * 
 * Updates an existing proposal in a multi-tenant ERP SaaS with:
 * - Permission verification (canEdit on proposals page)
 * - Ownership verification (proposal belongs to user's tenant)
 * - Secure field updates (only allow safe fields, not tenantId/companyId)
 * 
 * SECURITY: All sensitive data validation happens server-side.
 */

import * as functions from "firebase-functions";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

// ============================================
// TYPES
// ============================================

interface UpdateProposalInput {
  proposalId: string;
  title?: string;
  clientId?: string;
  clientName?: string;
  clientEmail?: string;
  clientPhone?: string;
  clientAddress?: string;
  validUntil?: string;
  status?: string;
  products?: ProposalProduct[];
  sistemas?: ProposalSistema[];
  discount?: number;
  notes?: string;
  customNotes?: string;
  sections?: any[];
  pdfSettings?: any;
}

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

interface ProposalSistema {
  sistemaId: string;
  sistemaName: string;
  ambienteId: string;
  ambienteName: string;
  description?: string;
  productIds?: string[];
}

interface UserDoc {
  role: 'MASTER' | 'MEMBER';
  masterId: string | null;
  tenantId: string;
  companyId?: string;
}

// ============================================
// CLOUD FUNCTION
// ============================================

export const updateProposal = functions
  .region("southamerica-east1")
  .https.onCall(async (data: UpdateProposalInput, context) => {
    const db = getFirestore();

    // 1. Auth Check
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Login necessário.");
    }
    const userId = context.auth.uid;
    const { proposalId, ...updateData } = data;

    if (!proposalId) {
      throw new functions.https.HttpsError("invalid-argument", "ID da proposta inválido.");
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
    const isMaster = role === 'MASTER' || role === 'ADMIN' || role === 'WK' || (!userData.masterId && userSnap.data()?.subscription);

    if (!isMaster) {
      // Check permissions for MEMBER
      const permRef = userRef.collection('permissions').doc('proposals');
      const permSnap = await permRef.get();
      if (!permSnap.exists || !permSnap.data()?.canEdit) {
        throw new functions.https.HttpsError("permission-denied", "Sem permissão para editar propostas.");
      }
    }

    // 4. Fetch and Validate Proposal
    const proposalRef = db.collection('proposals').doc(proposalId);
    const proposalSnap = await proposalRef.get();

    if (!proposalSnap.exists) {
      throw new functions.https.HttpsError("not-found", "Proposta não encontrada.");
    }

    const proposalData = proposalSnap.data();
    if (proposalData?.tenantId !== tenantId) {
      throw new functions.https.HttpsError("permission-denied", "Esta proposta não pertence a sua organização.");
    }

    // 5. Build Safe Update Object (only allowed fields)
    const safeUpdate: Record<string, any> = {
      updatedAt: Timestamp.now(),
    };

    // Only include fields that were explicitly provided
    if (updateData.title !== undefined) safeUpdate.title = updateData.title;
    if (updateData.clientId !== undefined) safeUpdate.clientId = updateData.clientId;
    if (updateData.clientName !== undefined) safeUpdate.clientName = updateData.clientName;
    if (updateData.clientEmail !== undefined) safeUpdate.clientEmail = updateData.clientEmail;
    if (updateData.clientPhone !== undefined) safeUpdate.clientPhone = updateData.clientPhone;
    if (updateData.clientAddress !== undefined) safeUpdate.clientAddress = updateData.clientAddress;
    if (updateData.validUntil !== undefined) safeUpdate.validUntil = updateData.validUntil;
    if (updateData.status !== undefined) safeUpdate.status = updateData.status;
    if (updateData.products !== undefined) safeUpdate.products = updateData.products;
    if (updateData.sistemas !== undefined) safeUpdate.sistemas = updateData.sistemas;
    if (updateData.discount !== undefined) safeUpdate.discount = updateData.discount;
    if (updateData.notes !== undefined) safeUpdate.notes = updateData.notes;
    if (updateData.customNotes !== undefined) safeUpdate.customNotes = updateData.customNotes;
    if (updateData.sections !== undefined) safeUpdate.sections = updateData.sections;
    if (updateData.pdfSettings !== undefined) safeUpdate.pdfSettings = updateData.pdfSettings;

    // Calculate totalValue if products changed
    if (updateData.products) {
      const subtotal = updateData.products.reduce((sum, p) => sum + (p.total || 0), 0);
      const discountAmount = (subtotal * (updateData.discount || proposalData?.discount || 0)) / 100;
      safeUpdate.totalValue = subtotal - discountAmount;
    }

    // 6. Update Proposal
    try {
      await proposalRef.update(safeUpdate);
      return { success: true, message: "Proposta atualizada com sucesso." };
    } catch (error) {
      console.error("Update Proposal Error:", error);
      throw new functions.https.HttpsError("internal", (error as Error).message);
    }
  });
