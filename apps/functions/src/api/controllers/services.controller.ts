import { Request, Response } from "express";
import { db } from "../../init";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import {
  resolveUserAndTenant,
  checkPermission,
  UserDoc,
} from "../../lib/auth-helpers";
import { deleteProductImages } from "../../lib/storage-helpers";

const sanitizeServicePayload = (input: Record<string, unknown>) => ({
  name: typeof input.name === "string" ? input.name.trim() : "",
  description: typeof input.description === "string" ? input.description : "",
  price: typeof input.price === "string" ? input.price : "",
  category: typeof input.category === "string" ? input.category : "",
  status: input.status === "inactive" ? "inactive" : "active",
  images: Array.isArray(input.images)
    ? input.images.filter((value): value is string => typeof value === "string")
    : [],
});

export const createService = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.uid;
    const input = req.body as Record<string, unknown>;
    const sanitizedInput = sanitizeServicePayload(input);

    if (!sanitizedInput.name || sanitizedInput.name.length < 2) {
      return res.status(400).json({ message: "Nome inválido." });
    }

    if (!sanitizedInput.price) {
      return res.status(400).json({ message: "Preço do serviço inválido." });
    }

    const { masterData, masterRef, tenantId, isMaster, isSuperAdmin } =
      await resolveUserAndTenant(userId, req.user);

    if (!isMaster && !isSuperAdmin) {
      const canCreate = await checkPermission(userId, "services", "canCreate");
      if (!canCreate) {
        return res
          .status(403)
          .json({ message: "Sem permissão para criar serviços." });
      }
    }

    const targetTenantId =
      typeof input.targetTenantId === "string" && isSuperAdmin
        ? input.targetTenantId
        : tenantId;

    let targetMasterRef = masterRef;
    let targetMasterData = masterData;

    if (isSuperAdmin && targetTenantId && targetTenantId !== tenantId) {
      const ownerQuery = await db
        .collection("users")
        .where("tenantId", "==", targetTenantId)
        .limit(10)
        .get();

      let ownerDoc = ownerQuery.docs.find((d) => !d.data().masterId);
      if (!ownerDoc && !ownerQuery.empty) {
        ownerDoc = ownerQuery.docs.find((d) =>
          ["MASTER", "master", "ADMIN", "admin"].includes(d.data().role),
        );
        if (!ownerDoc) ownerDoc = ownerQuery.docs[0];
      }

      if (ownerDoc) {
        targetMasterRef = db.collection("users").doc(ownerDoc.id);
        targetMasterData = ownerDoc.data() as UserDoc;
      }
    }

    const maxProducts = targetMasterData.subscription?.limits?.maxProducts;
    const currentProducts = targetMasterData.usage?.products || 0;

    if (maxProducts !== undefined && currentProducts >= maxProducts) {
      if (!isSuperAdmin) {
        return res.status(402).json({
          message: "Limite de serviços/produtos atingido para o seu plano.",
          code: "resource-exhausted",
        });
      }
    }

    const serviceId = await db.runTransaction(async (transaction) => {
      const companyRef = db.collection("companies").doc(targetTenantId);
      const companySnap = await transaction.get(companyRef);
      const newServiceRef = db.collection("services").doc();
      const now = Timestamp.now();

      transaction.set(newServiceRef, {
        tenantId: targetTenantId,
        ...sanitizedInput,
        createdAt: now,
        updatedAt: now,
      });

      transaction.update(targetMasterRef, {
        "usage.products": FieldValue.increment(1),
        updatedAt: now,
      });

      if (companySnap.exists) {
        transaction.update(companyRef, {
          "usage.products": FieldValue.increment(1),
          updatedAt: now,
        });
      }

      return newServiceRef.id;
    });

    return res.status(201).json({
      success: true,
      serviceId,
      message: "Serviço criado com sucesso!",
    });
  } catch (error: unknown) {
    console.error("createService Error:", error);
    const message =
      error instanceof Error ? error.message : "Erro interno ao criar serviço.";
    return res.status(500).json({ message });
  }
};

export const updateService = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.uid;
    const { id } = req.params;
    const updateData = req.body as Record<string, unknown>;

    if (!id) {
      return res.status(400).json({ message: "ID do serviço inválido." });
    }

    const { tenantId, isMaster, isSuperAdmin } = await resolveUserAndTenant(
      userId,
      req.user,
    );

    const serviceRef = db.collection("services").doc(id);
    const serviceSnap = await serviceRef.get();

    if (!serviceSnap.exists) {
      return res.status(404).json({ message: "Serviço não encontrado." });
    }

    const serviceData = serviceSnap.data();

    if (!isSuperAdmin && serviceData?.tenantId !== tenantId) {
      return res
        .status(403)
        .json({ message: "Este serviço não pertence a sua organização." });
    }

    if (!isMaster && !isSuperAdmin) {
      const canEdit = await checkPermission(userId, "services", "canEdit");
      if (!canEdit) {
        return res
          .status(403)
          .json({ message: "Sem permissão para editar serviços." });
      }
    }

    const sanitizedInput = sanitizeServicePayload(updateData);
    const safeUpdate: Record<string, unknown> = {
      updatedAt: Timestamp.now(),
      markup: FieldValue.delete(),
      manufacturer: FieldValue.delete(),
      stock: FieldValue.delete(),
    };

    if (updateData.name !== undefined) safeUpdate.name = sanitizedInput.name;
    if (updateData.description !== undefined) {
      safeUpdate.description = sanitizedInput.description;
    }
    if (updateData.price !== undefined) safeUpdate.price = sanitizedInput.price;
    if (updateData.category !== undefined) {
      safeUpdate.category = sanitizedInput.category;
    }
    if (updateData.images !== undefined) safeUpdate.images = sanitizedInput.images;
    if (updateData.image !== undefined) {
      safeUpdate.image =
        typeof updateData.image === "string" ? updateData.image : null;
    }
    if (updateData.status !== undefined) safeUpdate.status = sanitizedInput.status;

    await serviceRef.update(safeUpdate);

    return res.json({
      success: true,
      message: "Serviço atualizado com sucesso.",
    });
  } catch (error: unknown) {
    console.error("updateService Error:", error);
    const message =
      error instanceof Error ? error.message : "Erro ao atualizar serviço.";
    return res.status(500).json({ message });
  }
};

export const deleteService = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.uid;
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ message: "ID do serviço obrigatório." });
    }

    const { tenantId, isMaster, isSuperAdmin, masterRef } =
      await resolveUserAndTenant(userId, req.user);

    const serviceRef = db.collection("services").doc(id);
    const serviceSnap = await serviceRef.get();

    if (!serviceSnap.exists) {
      return res.status(404).json({ message: "Serviço não encontrado." });
    }

    const serviceData = serviceSnap.data();

    if (!isSuperAdmin && serviceData?.tenantId !== tenantId) {
      return res
        .status(403)
        .json({ message: "Acesso negado (Tenant Mismatch)." });
    }

    if (!isMaster && !isSuperAdmin) {
      const canDelete = await checkPermission(userId, "services", "canDelete");
      if (!canDelete) {
        return res
          .status(403)
          .json({ message: "Sem permissão para deletar serviços." });
      }
    }

    const images = serviceData?.images as string[] | undefined;
    await deleteProductImages(images, serviceData?.tenantId);

    let targetMasterRef = masterRef;

    if (
      isSuperAdmin &&
      serviceData?.tenantId &&
      serviceData.tenantId !== tenantId
    ) {
      const ownerQuery = await db
        .collection("users")
        .where("tenantId", "==", serviceData.tenantId)
        .limit(10)
        .get();

      let ownerDoc = ownerQuery.docs.find((d) => !d.data().masterId);
      if (!ownerDoc && !ownerQuery.empty) {
        ownerDoc = ownerQuery.docs.find((d) =>
          ["MASTER", "master", "ADMIN", "admin"].includes(d.data().role),
        );
        if (!ownerDoc) ownerDoc = ownerQuery.docs[0];
      }

      if (ownerDoc) {
        targetMasterRef = db.collection("users").doc(ownerDoc.id);
      }
    }

    await db.runTransaction(async (transaction) => {
      const companyRef = db
        .collection("companies")
        .doc(serviceData?.tenantId || tenantId);
      const companySnap = await transaction.get(companyRef);

      transaction.delete(serviceRef);

      transaction.update(targetMasterRef, {
        "usage.products": FieldValue.increment(-1),
        updatedAt: Timestamp.now(),
      });

      if (companySnap.exists) {
        transaction.update(companyRef, {
          "usage.products": FieldValue.increment(-1),
          updatedAt: Timestamp.now(),
        });
      }
    });

    return res.json({ success: true, message: "Serviço e imagens removidos." });
  } catch (error: unknown) {
    console.error("deleteService Error:", error);
    const message =
      error instanceof Error ? error.message : "Erro ao deletar serviço.";
    return res.status(500).json({ message });
  }
};
