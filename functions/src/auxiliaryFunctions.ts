/**
 * Cloud Functions: Auxiliary Services
 * 
 * Secure CRUD operations for auxiliary tenant configuration:
 * - Ambientes (Rooms/Areas for automation)
 * - Sistemas (Automation systems)
 * - Custom Fields
 * - Options (Dropdown values)
 * - Proposal Templates
 * 
 * All functions verify:
 * - Authentication
 * - Tenant ownership
 * - Basic permission (authenticated = allowed for config data)
 */

import * as functions from "firebase-functions";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

// ============================================
// TYPES
// ============================================

interface UserDoc {
  role: 'MASTER' | 'MEMBER';
  masterId: string | null;
  tenantId: string;
  companyId?: string;
  subscription?: { status: string };
}

// ============================================
// HELPER: Get Tenant ID
// ============================================

async function getTenantId(
  db: FirebaseFirestore.Firestore,
  userId: string
): Promise<string> {
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
  
  return tenantId;
}

// ============================================
// AMBIENTE FUNCTIONS
// ============================================

export const createAmbiente = functions
  .region("southamerica-east1")
  .https.onCall(async (data: { name: string; description?: string }, context) => {
    const db = getFirestore();
    if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Login necessário.");
    
    const tenantId = await getTenantId(db, context.auth.uid);
    
    if (!data.name) {
      throw new functions.https.HttpsError("invalid-argument", "Nome é obrigatório.");
    }

    const now = Timestamp.now();
    const docData: Record<string, any> = {
      tenantId,
      name: data.name.trim(),
      createdAt: now,
      updatedAt: now,
    };
    if (data.description) docData.description = data.description;

    try {
      const docRef = await db.collection('ambientes').add(docData);
      return { success: true, ambienteId: docRef.id, message: "Ambiente criado com sucesso." };
    } catch (error) {
      throw new functions.https.HttpsError("internal", (error as Error).message);
    }
  });

export const updateAmbiente = functions
  .region("southamerica-east1")
  .https.onCall(async (data: { ambienteId: string; name?: string; description?: string }, context) => {
    const db = getFirestore();
    if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Login necessário.");
    
    const tenantId = await getTenantId(db, context.auth.uid);
    const { ambienteId, ...updateData } = data;

    if (!ambienteId) throw new functions.https.HttpsError("invalid-argument", "ID do ambiente inválido.");

    const docRef = db.collection('ambientes').doc(ambienteId);
    const docSnap = await docRef.get();
    
    if (!docSnap.exists) throw new functions.https.HttpsError("not-found", "Ambiente não encontrado.");
    if (docSnap.data()?.tenantId !== tenantId) throw new functions.https.HttpsError("permission-denied", "Este ambiente não pertence a sua organização.");

    const safeUpdate: Record<string, any> = { updatedAt: Timestamp.now() };
    if (updateData.name !== undefined) safeUpdate.name = updateData.name;
    if (updateData.description !== undefined) safeUpdate.description = updateData.description;

    await docRef.update(safeUpdate);
    return { success: true, message: "Ambiente atualizado com sucesso." };
  });

export const deleteAmbiente = functions
  .region("southamerica-east1")
  .https.onCall(async (data: { ambienteId: string }, context) => {
    const db = getFirestore();
    if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Login necessário.");
    
    const tenantId = await getTenantId(db, context.auth.uid);

    if (!data.ambienteId) throw new functions.https.HttpsError("invalid-argument", "ID do ambiente inválido.");

    const docRef = db.collection('ambientes').doc(data.ambienteId);
    const docSnap = await docRef.get();
    
    if (!docSnap.exists) throw new functions.https.HttpsError("not-found", "Ambiente não encontrado.");
    if (docSnap.data()?.tenantId !== tenantId) throw new functions.https.HttpsError("permission-denied", "Este ambiente não pertence a sua organização.");

    await docRef.delete();
    return { success: true, message: "Ambiente excluído com sucesso." };
  });

// ============================================
// SISTEMA FUNCTIONS
// ============================================

export const createSistema = functions
  .region("southamerica-east1")
  .https.onCall(async (data: { name: string; description?: string; productIds?: string[] }, context) => {
    const db = getFirestore();
    if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Login necessário.");
    
    const tenantId = await getTenantId(db, context.auth.uid);
    
    if (!data.name) throw new functions.https.HttpsError("invalid-argument", "Nome é obrigatório.");

    const now = Timestamp.now();
    const docData: Record<string, any> = {
      tenantId,
      name: data.name.trim(),
      productIds: data.productIds || [],
      createdAt: now,
      updatedAt: now,
    };
    if (data.description) docData.description = data.description;

    const docRef = await db.collection('sistemas').add(docData);
    return { success: true, sistemaId: docRef.id, message: "Sistema criado com sucesso." };
  });

export const updateSistema = functions
  .region("southamerica-east1")
  .https.onCall(async (data: { sistemaId: string; name?: string; description?: string; productIds?: string[] }, context) => {
    const db = getFirestore();
    if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Login necessário.");
    
    const tenantId = await getTenantId(db, context.auth.uid);
    const { sistemaId, ...updateData } = data;

    if (!sistemaId) throw new functions.https.HttpsError("invalid-argument", "ID do sistema inválido.");

    const docRef = db.collection('sistemas').doc(sistemaId);
    const docSnap = await docRef.get();
    
    if (!docSnap.exists) throw new functions.https.HttpsError("not-found", "Sistema não encontrado.");
    if (docSnap.data()?.tenantId !== tenantId) throw new functions.https.HttpsError("permission-denied", "Este sistema não pertence a sua organização.");

    const safeUpdate: Record<string, any> = { updatedAt: Timestamp.now() };
    if (updateData.name !== undefined) safeUpdate.name = updateData.name;
    if (updateData.description !== undefined) safeUpdate.description = updateData.description;
    if (updateData.productIds !== undefined) safeUpdate.productIds = updateData.productIds;

    await docRef.update(safeUpdate);
    return { success: true, message: "Sistema atualizado com sucesso." };
  });

export const deleteSistema = functions
  .region("southamerica-east1")
  .https.onCall(async (data: { sistemaId: string }, context) => {
    const db = getFirestore();
    if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Login necessário.");
    
    const tenantId = await getTenantId(db, context.auth.uid);

    if (!data.sistemaId) throw new functions.https.HttpsError("invalid-argument", "ID do sistema inválido.");

    const docRef = db.collection('sistemas').doc(data.sistemaId);
    const docSnap = await docRef.get();
    
    if (!docSnap.exists) throw new functions.https.HttpsError("not-found", "Sistema não encontrado.");
    if (docSnap.data()?.tenantId !== tenantId) throw new functions.https.HttpsError("permission-denied", "Este sistema não pertence a sua organização.");

    await docRef.delete();
    return { success: true, message: "Sistema excluído com sucesso." };
  });

// ============================================
// CUSTOM FIELD FUNCTIONS
// ============================================

export const createCustomField = functions
  .region("southamerica-east1")
  .https.onCall(async (data: { name: string; type: string; entity: string; required?: boolean; options?: string[] }, context) => {
    const db = getFirestore();
    if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Login necessário.");
    
    const tenantId = await getTenantId(db, context.auth.uid);
    
    if (!data.name || !data.type || !data.entity) {
      throw new functions.https.HttpsError("invalid-argument", "Nome, tipo e entidade são obrigatórios.");
    }

    const now = Timestamp.now();
    const docData: Record<string, any> = {
      tenantId,
      name: data.name.trim(),
      type: data.type,
      entity: data.entity,
      required: data.required || false,
      createdAt: now,
      updatedAt: now,
    };
    if (data.options) docData.options = data.options;

    const docRef = await db.collection('customFields').add(docData);
    return { success: true, customFieldId: docRef.id, message: "Campo personalizado criado com sucesso." };
  });

export const updateCustomField = functions
  .region("southamerica-east1")
  .https.onCall(async (data: { customFieldId: string; name?: string; type?: string; required?: boolean; options?: string[] }, context) => {
    const db = getFirestore();
    if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Login necessário.");
    
    const tenantId = await getTenantId(db, context.auth.uid);
    const { customFieldId, ...updateData } = data;

    if (!customFieldId) throw new functions.https.HttpsError("invalid-argument", "ID do campo inválido.");

    const docRef = db.collection('customFields').doc(customFieldId);
    const docSnap = await docRef.get();
    
    if (!docSnap.exists) throw new functions.https.HttpsError("not-found", "Campo não encontrado.");
    if (docSnap.data()?.tenantId !== tenantId) throw new functions.https.HttpsError("permission-denied", "Este campo não pertence a sua organização.");

    const safeUpdate: Record<string, any> = { updatedAt: Timestamp.now() };
    if (updateData.name !== undefined) safeUpdate.name = updateData.name;
    if (updateData.type !== undefined) safeUpdate.type = updateData.type;
    if (updateData.required !== undefined) safeUpdate.required = updateData.required;
    if (updateData.options !== undefined) safeUpdate.options = updateData.options;

    await docRef.update(safeUpdate);
    return { success: true, message: "Campo atualizado com sucesso." };
  });

export const deleteCustomField = functions
  .region("southamerica-east1")
  .https.onCall(async (data: { customFieldId: string }, context) => {
    const db = getFirestore();
    if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Login necessário.");
    
    const tenantId = await getTenantId(db, context.auth.uid);

    if (!data.customFieldId) throw new functions.https.HttpsError("invalid-argument", "ID do campo inválido.");

    const docRef = db.collection('customFields').doc(data.customFieldId);
    const docSnap = await docRef.get();
    
    if (!docSnap.exists) throw new functions.https.HttpsError("not-found", "Campo não encontrado.");
    if (docSnap.data()?.tenantId !== tenantId) throw new functions.https.HttpsError("permission-denied", "Este campo não pertence a sua organização.");

    await docRef.delete();
    return { success: true, message: "Campo excluído com sucesso." };
  });

// ============================================
// OPTION FUNCTIONS (for dropdowns)
// ============================================

export const createOption = functions
  .region("southamerica-east1")
  .https.onCall(async (data: { fieldType: string; label: string }, context) => {
    const db = getFirestore();
    if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Login necessário.");
    
    const tenantId = await getTenantId(db, context.auth.uid);
    
    if (!data.fieldType || !data.label) {
      throw new functions.https.HttpsError("invalid-argument", "Tipo de campo e label são obrigatórios.");
    }

    const now = Timestamp.now();
    const docData = {
      tenantId,
      fieldType: data.fieldType,
      label: data.label.trim(),
      createdAt: now,
    };

    const docRef = await db.collection('options').add(docData);
    return { success: true, optionId: docRef.id, message: "Opção criada com sucesso." };
  });

export const updateOption = functions
  .region("southamerica-east1")
  .https.onCall(async (data: { optionId: string; label: string }, context) => {
    const db = getFirestore();
    if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Login necessário.");
    
    const tenantId = await getTenantId(db, context.auth.uid);

    if (!data.optionId) throw new functions.https.HttpsError("invalid-argument", "ID da opção inválido.");

    const docRef = db.collection('options').doc(data.optionId);
    const docSnap = await docRef.get();
    
    if (!docSnap.exists) throw new functions.https.HttpsError("not-found", "Opção não encontrada.");
    if (docSnap.data()?.tenantId !== tenantId) throw new functions.https.HttpsError("permission-denied", "Esta opção não pertence a sua organização.");

    await docRef.update({ label: data.label });
    return { success: true, message: "Opção atualizada com sucesso." };
  });

export const deleteOption = functions
  .region("southamerica-east1")
  .https.onCall(async (data: { optionId: string }, context) => {
    const db = getFirestore();
    if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Login necessário.");
    
    const tenantId = await getTenantId(db, context.auth.uid);

    if (!data.optionId) throw new functions.https.HttpsError("invalid-argument", "ID da opção inválido.");

    const docRef = db.collection('options').doc(data.optionId);
    const docSnap = await docRef.get();
    
    if (!docSnap.exists) throw new functions.https.HttpsError("not-found", "Opção não encontrada.");
    if (docSnap.data()?.tenantId !== tenantId) throw new functions.https.HttpsError("permission-denied", "Esta opção não pertence a sua organização.");

    await docRef.delete();
    return { success: true, message: "Opção excluída com sucesso." };
  });

// ============================================
// PROPOSAL TEMPLATE FUNCTIONS
// ============================================

export const createProposalTemplate = functions
  .region("southamerica-east1")
  .https.onCall(async (data: { name: string; content?: any; isDefault?: boolean }, context) => {
    const db = getFirestore();
    if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Login necessário.");
    
    const tenantId = await getTenantId(db, context.auth.uid);
    
    if (!data.name) throw new functions.https.HttpsError("invalid-argument", "Nome é obrigatório.");

    const now = Timestamp.now();
    const docData: Record<string, any> = {
      tenantId,
      name: data.name.trim(),
      isDefault: data.isDefault || false,
      createdAt: now,
      updatedAt: now,
    };
    if (data.content) docData.content = data.content;

    const docRef = await db.collection('proposalTemplates').add(docData);
    return { success: true, templateId: docRef.id, message: "Template criado com sucesso." };
  });

export const updateProposalTemplate = functions
  .region("southamerica-east1")
  .https.onCall(async (data: { templateId: string; name?: string; content?: any; isDefault?: boolean }, context) => {
    const db = getFirestore();
    if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Login necessário.");
    
    const tenantId = await getTenantId(db, context.auth.uid);
    const { templateId, ...updateData } = data;

    if (!templateId) throw new functions.https.HttpsError("invalid-argument", "ID do template inválido.");

    const docRef = db.collection('proposalTemplates').doc(templateId);
    const docSnap = await docRef.get();
    
    if (!docSnap.exists) throw new functions.https.HttpsError("not-found", "Template não encontrado.");
    if (docSnap.data()?.tenantId !== tenantId) throw new functions.https.HttpsError("permission-denied", "Este template não pertence a sua organização.");

    const safeUpdate: Record<string, any> = { updatedAt: Timestamp.now() };
    if (updateData.name !== undefined) safeUpdate.name = updateData.name;
    if (updateData.content !== undefined) safeUpdate.content = updateData.content;
    if (updateData.isDefault !== undefined) safeUpdate.isDefault = updateData.isDefault;

    await docRef.update(safeUpdate);
    return { success: true, message: "Template atualizado com sucesso." };
  });

export const deleteProposalTemplate = functions
  .region("southamerica-east1")
  .https.onCall(async (data: { templateId: string }, context) => {
    const db = getFirestore();
    if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Login necessário.");
    
    const tenantId = await getTenantId(db, context.auth.uid);

    if (!data.templateId) throw new functions.https.HttpsError("invalid-argument", "ID do template inválido.");

    const docRef = db.collection('proposalTemplates').doc(data.templateId);
    const docSnap = await docRef.get();
    
    if (!docSnap.exists) throw new functions.https.HttpsError("not-found", "Template não encontrado.");
    if (docSnap.data()?.tenantId !== tenantId) throw new functions.https.HttpsError("permission-denied", "Este template não pertence a sua organização.");

    await docRef.delete();
    return { success: true, message: "Template excluído com sucesso." };
  });
