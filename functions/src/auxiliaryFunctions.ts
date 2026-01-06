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
import {
  onCall,
  HttpsError,
  CallableRequest,
} from "firebase-functions/v2/https";
import { Timestamp } from "firebase-admin/firestore";
import { db } from "./init";

// CORS configuration - allow all origins for callable functions
const CORS_OPTIONS = {
  cors: true, // Allow all origins
  region: "southamerica-east1",
};

// ============================================
// TYPES
// ============================================

interface UserDoc {
  role: "MASTER" | "MEMBER";
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
  const userRef = db.collection("users").doc(userId);
  const userSnap = await userRef.get();

  if (!userSnap.exists) {
    throw new functions.https.HttpsError(
      "not-found",
      "Usuário não encontrado."
    );
  }

  const userData = userSnap.data() as UserDoc;
  const tenantId = userData.tenantId || userData.companyId;

  if (!tenantId) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "Usuário sem tenantId."
    );
  }

  return tenantId;
}

// ============================================
// HELPER: Check Auth & Doc Ownership (Parallelized)
// ============================================
async function checkAuthAndDoc(
  db: FirebaseFirestore.Firestore,
  userId: string,
  collectionName: string,
  docId: string
): Promise<{
  tenantId: string;
  docRef: FirebaseFirestore.DocumentReference;
  docSnap: FirebaseFirestore.DocumentSnapshot;
  isSuperAdmin: boolean;
}> {
  if (!docId)
    throw new functions.https.HttpsError("invalid-argument", "ID inválido.");

  const docRef = db.collection(collectionName).doc(docId);
  const userRef = db.collection("users").doc(userId);

  // Parallel Fetch - get user data to check role
  const [userSnap, docSnap] = await Promise.all([userRef.get(), docRef.get()]);

  if (!userSnap.exists) {
    throw new functions.https.HttpsError(
      "not-found",
      "Usuário não encontrado."
    );
  }

  const userData = userSnap.data() as UserDoc;
  const isSuperAdmin =
    (userData.role as string)?.toLowerCase() === "superadmin";
  const tenantId = userData.tenantId || userData.companyId || "";

  if (!tenantId && !isSuperAdmin) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "Usuário sem tenantId."
    );
  }

  if (!docSnap.exists)
    throw new functions.https.HttpsError(
      "not-found",
      "Documento não encontrado."
    );

  // Super admin can access any document
  if (!isSuperAdmin && docSnap.data()?.tenantId !== tenantId)
    throw new functions.https.HttpsError(
      "permission-denied",
      "Este documento não pertence a sua organização."
    );

  return { tenantId, docRef, docSnap, isSuperAdmin };
}

// ============================================
// AMBIENTE FUNCTIONS
// ============================================

export const createAmbiente = onCall(
  CORS_OPTIONS,
  async (request: CallableRequest<{ name: string; description?: string }>) => {
    const { data, auth } = request;
    if (!auth) throw new HttpsError("unauthenticated", "Login necessário.");

    const tenantId = await getTenantId(db, auth.uid);

    if (!data.name) {
      throw new HttpsError("invalid-argument", "Nome é obrigatório.");
    }

    const now = Timestamp.now();
    const docData: Record<string, unknown> = {
      tenantId,
      name: data.name.trim(),
      createdAt: now,
      updatedAt: now,
    };
    if (data.description) docData.description = data.description;

    try {
      const docRef = await db.collection("ambientes").add(docData);
      return {
        success: true,
        ambienteId: docRef.id,
        message: "Ambiente criado com sucesso.",
      };
    } catch (error) {
      throw new HttpsError("internal", (error as Error).message);
    }
  }
);

export const updateAmbiente = onCall(
  CORS_OPTIONS,
  async (
    request: CallableRequest<{
      ambienteId: string;
      name?: string;
      description?: string;
    }>
  ) => {
    const { data, auth } = request;
    if (!auth) throw new HttpsError("unauthenticated", "Login necessário.");

    const { ambienteId, ...updateData } = data;
    const { docRef } = await checkAuthAndDoc(
      db,
      auth.uid,
      "ambientes",
      ambienteId
    );

    const safeUpdate: Record<string, unknown> = {
      updatedAt: Timestamp.now(),
    };
    if (updateData.name !== undefined) safeUpdate.name = updateData.name;
    if (updateData.description !== undefined)
      safeUpdate.description = updateData.description;

    await docRef.update(safeUpdate);
    return { success: true, message: "Ambiente atualizado com sucesso." };
  }
);

export const deleteAmbiente = onCall(
  CORS_OPTIONS,
  async (request: CallableRequest<{ ambienteId: string }>) => {
    const { data, auth } = request;
    if (!auth) throw new HttpsError("unauthenticated", "Login necessário.");

    const { docRef } = await checkAuthAndDoc(
      db,
      auth.uid,
      "ambientes",
      data.ambienteId
    );
    await docRef.delete();
    return { success: true, message: "Ambiente excluído com sucesso." };
  }
);

// ============================================
// SISTEMA FUNCTIONS
// ============================================

interface SistemaProduct {
  productId: string;
  productName: string;
  quantity: number;
  notes?: string;
}

type CreateSistemaData = {
  name: string;
  description?: string;
  icon?: string;
  ambienteIds?: string[];
  defaultProducts?: SistemaProduct[];
};

type UpdateSistemaData = {
  sistemaId: string;
  name?: string;
  description?: string;
  icon?: string;
  ambienteIds?: string[];
  defaultProducts?: SistemaProduct[];
};

export const createSistema = onCall(
  CORS_OPTIONS,
  async (request: CallableRequest<CreateSistemaData>) => {
    const { data, auth } = request;
    if (!auth) throw new HttpsError("unauthenticated", "Login necessário.");

    const tenantId = await getTenantId(db, auth.uid);

    if (!data.name)
      throw new HttpsError("invalid-argument", "Nome é obrigatório.");

    const now = Timestamp.now();
    const docData: Record<string, unknown> = {
      tenantId,
      name: data.name.trim(),
      ambienteIds: data.ambienteIds || [],
      defaultProducts: data.defaultProducts || [],
      createdAt: now,
      updatedAt: now,
    };
    if (data.description) docData.description = data.description;
    if (data.icon) docData.icon = data.icon;

    const docRef = await db.collection("sistemas").add(docData);
    return {
      success: true,
      sistemaId: docRef.id,
      message: "Sistema criado com sucesso.",
    };
  }
);

export const updateSistema = onCall(
  CORS_OPTIONS,
  async (request: CallableRequest<UpdateSistemaData>) => {
    const { data, auth } = request;
    if (!auth) throw new HttpsError("unauthenticated", "Login necessário.");

    const { sistemaId, ...updateData } = data;
    const { docRef } = await checkAuthAndDoc(
      db,
      auth.uid,
      "sistemas",
      sistemaId
    );

    const safeUpdate: Record<string, unknown> = {
      updatedAt: Timestamp.now(),
    };
    if (updateData.name !== undefined) safeUpdate.name = updateData.name;
    if (updateData.description !== undefined)
      safeUpdate.description = updateData.description;
    if (updateData.icon !== undefined) safeUpdate.icon = updateData.icon;
    if (updateData.ambienteIds !== undefined)
      safeUpdate.ambienteIds = updateData.ambienteIds;
    if (updateData.defaultProducts !== undefined)
      safeUpdate.defaultProducts = updateData.defaultProducts;

    await docRef.update(safeUpdate);
    return { success: true, message: "Sistema atualizado com sucesso." };
  }
);

export const deleteSistema = onCall(
  CORS_OPTIONS,
  async (request: CallableRequest<{ sistemaId: string }>) => {
    const { data, auth } = request;
    if (!auth) throw new HttpsError("unauthenticated", "Login necessário.");

    const { docRef } = await checkAuthAndDoc(
      db,
      auth.uid,
      "sistemas",
      data.sistemaId
    );
    await docRef.delete();
    return { success: true, message: "Sistema excluído com sucesso." };
  }
);

// ============================================
// CUSTOM FIELD FUNCTIONS
// ============================================

type CreateCustomFieldData = {
  name: string;
  type: string;
  entity: string;
  required?: boolean;
  options?: string[];
};

type UpdateCustomFieldData = {
  customFieldId: string;
  name?: string;
  type?: string;
  required?: boolean;
  options?: string[];
};

export const createCustomField = onCall(
  CORS_OPTIONS,
  async (request: CallableRequest<CreateCustomFieldData>) => {
    const { data, auth } = request;
    if (!auth) throw new HttpsError("unauthenticated", "Login necessário.");

    const tenantId = await getTenantId(db, auth.uid);

    if (!data.name || !data.type || !data.entity) {
      throw new HttpsError(
        "invalid-argument",
        "Nome, tipo e entidade são obrigatórios."
      );
    }

    const now = Timestamp.now();
    const docData: Record<string, unknown> = {
      tenantId,
      name: data.name.trim(),
      type: data.type,
      entity: data.entity,
      required: data.required || false,
      createdAt: now,
      updatedAt: now,
    };
    if (data.options) docData.options = data.options;

    const docRef = await db.collection("customFields").add(docData);
    return {
      success: true,
      customFieldId: docRef.id,
      message: "Campo personalizado criado com sucesso.",
    };
  }
);

export const updateCustomField = onCall(
  CORS_OPTIONS,
  async (request: CallableRequest<UpdateCustomFieldData>) => {
    const { data, auth } = request;
    if (!auth) throw new HttpsError("unauthenticated", "Login necessário.");

    const { customFieldId, ...updateData } = data;
    const { docRef } = await checkAuthAndDoc(
      db,
      auth.uid,
      "customFields",
      customFieldId
    );

    const safeUpdate: Record<string, unknown> = {
      updatedAt: Timestamp.now(),
    };
    if (updateData.name !== undefined) safeUpdate.name = updateData.name;
    if (updateData.type !== undefined) safeUpdate.type = updateData.type;
    if (updateData.required !== undefined)
      safeUpdate.required = updateData.required;
    if (updateData.options !== undefined)
      safeUpdate.options = updateData.options;

    await docRef.update(safeUpdate);
    return { success: true, message: "Campo atualizado com sucesso." };
  }
);

export const deleteCustomField = onCall(
  CORS_OPTIONS,
  async (request: CallableRequest<{ customFieldId: string }>) => {
    const { data, auth } = request;
    if (!auth) throw new HttpsError("unauthenticated", "Login necessário.");

    const { docRef } = await checkAuthAndDoc(
      db,
      auth.uid,
      "customFields",
      data.customFieldId
    );
    await docRef.delete();
    return { success: true, message: "Campo excluído com sucesso." };
  }
);

// ============================================
// OPTION FUNCTIONS (for dropdowns)
// ============================================

export const createOption = onCall(
  CORS_OPTIONS,
  async (
    request: CallableRequest<{
      fieldType: string;
      label: string;
      tenantId?: string;
    }>
  ) => {
    const { data, auth } = request;
    console.log("createOption v3: Started", {
      data,
      auth: auth?.uid,
    });
    try {
      if (!auth) {
        console.warn("createOption: Unauthenticated");
        throw new HttpsError("unauthenticated", "Login necessário.");
      }

      // Get user data to check role
      const userRef = db.collection("users").doc(auth.uid);
      const userSnap = await userRef.get();

      if (!userSnap.exists) {
        throw new HttpsError("not-found", "Usuário não encontrado.");
      }

      const userData = userSnap.data() as {
        role?: string;
        tenantId?: string;
        companyId?: string;
      };
      const isSuperAdmin =
        (userData.role as string)?.toLowerCase() === "superadmin";

      // Determine tenantId: super admin can use provided tenantId, others must use their own
      let tenantId: string;
      if (isSuperAdmin && data.tenantId) {
        tenantId = data.tenantId;
        console.log(
          "createOption: Super admin creating option for tenant:",
          tenantId
        );
      } else {
        tenantId = userData.tenantId || userData.companyId || "";
        if (!tenantId) {
          throw new HttpsError("failed-precondition", "Usuário sem tenantId.");
        }
      }

      if (!data.fieldType || !data.label) {
        console.warn("createOption: Missing fields");
        throw new HttpsError(
          "invalid-argument",
          "Tipo de campo e label são obrigatórios."
        );
      }

      const now = Timestamp.now();
      const docData = {
        tenantId,
        fieldType: data.fieldType,
        label: data.label.trim(),
        createdAt: now,
      };

      const docRef = await db.collection("options").add(docData);
      console.log(`createOption: Success. ID: ${docRef.id}`);
      return {
        success: true,
        optionId: docRef.id,
        message: "Opção criada com sucesso.",
      };
    } catch (error) {
      console.error("createOption: Error", error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", `Erro: ${(error as Error).message}`);
    }
  }
);

export const updateOption = onCall(
  CORS_OPTIONS,
  async (request: CallableRequest<{ optionId: string; label: string }>) => {
    const { data, auth } = request;
    console.log("updateOption v3: Started", { data, auth: auth?.uid });
    try {
      if (!auth) {
        console.warn("updateOption: Unauthenticated");
        throw new HttpsError("unauthenticated", "Login necessário.");
      }

      const { docRef } = await checkAuthAndDoc(
        db,
        auth.uid,
        "options",
        data.optionId
      );
      await docRef.update({ label: data.label });
      console.log(`updateOption: Success for ${data.optionId}`);
      return { success: true, message: "Opção atualizada com sucesso." };
    } catch (error) {
      console.error("updateOption: Error", error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", `Erro: ${(error as Error).message}`);
    }
  }
);

export const deleteOption = onCall(
  CORS_OPTIONS,
  async (request: CallableRequest<{ optionId: string }>) => {
    const { data, auth } = request;
    console.log("deleteOption v3: Started", { data, auth: auth?.uid });
    try {
      if (!auth) {
        console.warn("deleteOption: Unauthenticated");
        throw new HttpsError("unauthenticated", "Login necessário.");
      }

      const { docRef } = await checkAuthAndDoc(
        db,
        auth.uid,
        "options",
        data.optionId
      );
      await docRef.delete();
      console.log(`deleteOption: Success for ${data.optionId}`);
      return { success: true, message: "Opção excluída com sucesso." };
    } catch (error) {
      console.error("deleteOption: Error", error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", `Erro: ${(error as Error).message}`);
    }
  }
);

// ============================================
// PROPOSAL TEMPLATE FUNCTIONS
// ============================================

type CreateProposalTemplateData = {
  name: string;
  content?: unknown;
  isDefault?: boolean;
};

type UpdateProposalTemplateData = {
  templateId: string;
  name?: string;
  content?: unknown;
  isDefault?: boolean;
};

export const createProposalTemplate = onCall(
  CORS_OPTIONS,
  async (request: CallableRequest<CreateProposalTemplateData>) => {
    const { data, auth } = request;
    if (!auth) throw new HttpsError("unauthenticated", "Login necessário.");

    const tenantId = await getTenantId(db, auth.uid);

    if (!data.name)
      throw new HttpsError("invalid-argument", "Nome é obrigatório.");

    const now = Timestamp.now();
    const docData: Record<string, unknown> = {
      tenantId,
      name: data.name.trim(),
      isDefault: data.isDefault || false,
      createdAt: now,
      updatedAt: now,
    };
    if (data.content) docData.content = data.content;

    const docRef = await db.collection("proposalTemplates").add(docData);
    return {
      success: true,
      templateId: docRef.id,
      message: "Template criado com sucesso.",
    };
  }
);

export const updateProposalTemplate = onCall(
  CORS_OPTIONS,
  async (request: CallableRequest<UpdateProposalTemplateData>) => {
    const { data, auth } = request;
    if (!auth) throw new HttpsError("unauthenticated", "Login necessário.");

    const { templateId, ...updateData } = data;
    const { docRef } = await checkAuthAndDoc(
      db,
      auth.uid,
      "proposalTemplates",
      templateId
    );

    const safeUpdate: Record<string, unknown> = {
      updatedAt: Timestamp.now(),
    };
    if (updateData.name !== undefined) safeUpdate.name = updateData.name;
    if (updateData.content !== undefined)
      safeUpdate.content = updateData.content;
    if (updateData.isDefault !== undefined)
      safeUpdate.isDefault = updateData.isDefault;

    await docRef.update(safeUpdate);
    return { success: true, message: "Template atualizado com sucesso." };
  }
);

export const deleteProposalTemplate = onCall(
  CORS_OPTIONS,
  async (request: CallableRequest<{ templateId: string }>) => {
    const { data, auth } = request;
    if (!auth) throw new HttpsError("unauthenticated", "Login necessário.");

    const { docRef } = await checkAuthAndDoc(
      db,
      auth.uid,
      "proposalTemplates",
      data.templateId
    );
    await docRef.delete();
    return { success: true, message: "Template excluído com sucesso." };
  }
);
