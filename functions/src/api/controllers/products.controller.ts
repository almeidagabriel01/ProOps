import { Request, Response } from "express";
import { db } from "../../init";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import {
  resolveUserAndTenant,
  checkPermission,
  UserDoc,
} from "../../lib/auth-helpers";
import { deleteProductImages } from "../../lib/storage-helpers";

const parseInventoryValue = (value: unknown): number => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === "string") {
    const normalized = Number.parseFloat(value.replace(",", "."));
    return Number.isFinite(normalized) ? normalized : 0;
  }

  return 0;
};

const MAX_HEIGHT_TIERS = 30;

type SanitizedHeightTier = {
  id: string;
  maxHeight: number;
  basePrice: number;
  markup: number;
};

function sanitizeHeightTier(input: unknown, index: number): SanitizedHeightTier | null {
  const source =
    input && typeof input === "object"
      ? (input as Record<string, unknown>)
      : null;

  if (!source) return null;

  const maxHeight = parseInventoryValue(source.maxHeight);
  const basePrice = parseInventoryValue(source.basePrice);
  const markup = parseInventoryValue(source.markup);

  if (maxHeight <= 0 || basePrice <= 0 || markup < 0 || markup > 1000) {
    return null;
  }

  return {
    id:
      typeof source.id === "string" && source.id.trim()
        ? source.id.trim().slice(0, 120)
        : `tier-${index + 1}`,
    maxHeight,
    basePrice,
    markup,
  };
}

function sanitizePricingModel(input: unknown) {
  const source =
    input && typeof input === "object"
      ? (input as Record<string, unknown>)
      : null;

  const rawMode = typeof source?.mode === "string" ? source.mode.trim() : "";
  if (rawMode === "curtain_meter") {
    return { mode: "curtain_meter" as const };
  }

  if (rawMode === "curtain_height") {
    const rawTiers = Array.isArray(source?.tiers) ? source.tiers : [];
    const tiers = rawTiers
      .slice(0, MAX_HEIGHT_TIERS)
      .map((tier, index) => sanitizeHeightTier(tier, index))
      .filter((tier): tier is SanitizedHeightTier => Boolean(tier))
      .sort((left, right) => left.maxHeight - right.maxHeight);

    return {
      mode: "curtain_height" as const,
      tiers,
    };
  }

  return { mode: "standard" as const };
}

// Create Product
export const createProduct = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.uid;
    const input = req.body;
    const inventoryValue = parseInventoryValue(
      input.inventoryValue ?? input.stock,
    );
    const inventoryUnit =
      input.inventoryUnit === "meter" ? "meter" : "unit";
    const pricingModel = sanitizePricingModel(input.pricingModel);

    if (
      pricingModel.mode === "curtain_height" &&
      pricingModel.tiers.length === 0
    ) {
      return res.status(400).json({
        message: "Cadastre pelo menos uma faixa de altura valida.",
      });
    }

    if (!input.name || input.name.trim().length < 2) {
      return res.status(400).json({ message: "Nome inválido." });
    }

    const { masterData, masterRef, tenantId, isMaster, isSuperAdmin } =
      await resolveUserAndTenant(userId, req.user);

    // Permission Check
    if (!isMaster && !isSuperAdmin) {
      const canCreate = await checkPermission(userId, "products", "canCreate");
      if (!canCreate) {
        return res
          .status(403)
          .json({ message: "Sem permissão para criar produtos." });
      }
    }

    const targetTenantId =
      input.targetTenantId && isSuperAdmin ? input.targetTenantId : tenantId;

    // Adjust masterRef and masterData if Super Admin is acting on behalf of another tenant
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

    // Plan Limits
    const maxProducts = targetMasterData.subscription?.limits?.maxProducts;
    const currentProducts = targetMasterData.usage?.products || 0;

    if (maxProducts !== undefined && currentProducts >= maxProducts) {
      // If Super Admin, allow proceeding
      if (!isSuperAdmin) {
        return res.status(402).json({
          message: "Limite de produtos atingido para o seu plano.",
          code: "resource-exhausted",
        });
      }
    }

    // Transaction
    const productId = await db.runTransaction(async (transaction) => {
      const companyRef = db.collection("companies").doc(targetTenantId);
      const companySnap = await transaction.get(companyRef);
      const newProductRef = db.collection("products").doc();
      const now = Timestamp.now();

      transaction.set(newProductRef, {
        tenantId: targetTenantId,
        name: input.name.trim(),
        description: input.description || "",
        price: input.price,
        markup: input.markup || "0",
        pricingModel,
        manufacturer: input.manufacturer || "",
        category: input.category || "",
        inventoryValue,
        inventoryUnit,
        stock: inventoryValue,
        status: input.status || "active",
        images: input.images || [],
        createdAt: now,
        updatedAt: now,
      });

      // Increment Usage
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

      return newProductRef.id;
    });

    return res.status(201).json({
      success: true,
      productId,
      message: "Produto criado com sucesso!",
    });
  } catch (error: unknown) {
    console.error("createProduct Error:", error);
    const message =
      error instanceof Error ? error.message : "Erro interno ao criar produto.";
    return res.status(500).json({ message });
  }
};

// Update Product
export const updateProduct = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.uid;
    const { id } = req.params;
    const updateData = req.body;

    if (!id)
      return res.status(400).json({ message: "ID do produto inválido." });

    const { tenantId, isMaster, isSuperAdmin } =
      await resolveUserAndTenant(userId, req.user);

    const productRef = db.collection("products").doc(id);
    const productSnap = await productRef.get();

    if (!productSnap.exists) {
      return res.status(404).json({ message: "Produto não encontrado." });
    }

    const productData = productSnap.data();

    // Tenant ownership check
    if (!isSuperAdmin && productData?.tenantId !== tenantId) {
      return res
        .status(403)
        .json({ message: "Este produto não pertence a sua organização." });
    }

    // Permission Check
    if (!isMaster && !isSuperAdmin) {
      const canEdit = await checkPermission(userId, "products", "canEdit");
      if (!canEdit) {
        return res
          .status(403)
          .json({ message: "Sem permissão para editar produtos." });
      }
    }

    // Safe Update
    const safeUpdate: Record<string, unknown> = {
      updatedAt: Timestamp.now(),
    };
    const normalizedInventoryValue = parseInventoryValue(
      updateData.inventoryValue ?? updateData.stock,
    );
    const pricingModel =
      updateData.pricingModel !== undefined
        ? sanitizePricingModel(updateData.pricingModel)
        : undefined;

    const allowedFields = [
      "name",
      "description",
      "price",
      "markup",
      "pricingModel",
      "manufacturer",
      "category",
      "images",
      "image",
      "status",
      "inventoryUnit",
    ];
    for (const field of allowedFields) {
      if (updateData[field] !== undefined)
        safeUpdate[field] = updateData[field];
    }

    if (updateData.inventoryUnit !== undefined) {
      safeUpdate.inventoryUnit =
        updateData.inventoryUnit === "meter" ? "meter" : "unit";
    }

    if (pricingModel) {
      if (
        pricingModel.mode === "curtain_height" &&
        pricingModel.tiers.length === 0
      ) {
        return res.status(400).json({
          message: "Cadastre pelo menos uma faixa de altura valida.",
        });
      }

      safeUpdate.pricingModel = pricingModel;
    }

    if (
      updateData.inventoryValue !== undefined ||
      updateData.stock !== undefined
    ) {
      safeUpdate.inventoryValue = normalizedInventoryValue;
      safeUpdate.stock = normalizedInventoryValue;
    }

    await productRef.update(safeUpdate);

    return res.json({
      success: true,
      message: "Produto atualizado com sucesso.",
    });
  } catch (error: unknown) {
    console.error("updateProduct Error:", error);
    const message =
      error instanceof Error ? error.message : "Erro ao atualizar produto.";
    return res.status(500).json({ message });
  }
};

// Delete Product
export const deleteProduct = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.uid;
    const { id } = req.params;

    if (!id)
      return res.status(400).json({ message: "ID do produto obrigatório." });

    const { tenantId, isMaster, isSuperAdmin, masterRef } =
      await resolveUserAndTenant(userId, req.user);

    const productRef = db.collection("products").doc(id);
    const productSnap = await productRef.get();

    if (!productSnap.exists) {
      return res.status(404).json({ message: "Produto não encontrado." });
    }

    const productData = productSnap.data();

    // Tenant Check
    if (!isSuperAdmin && productData?.tenantId !== tenantId) {
      return res
        .status(403)
        .json({ message: "Acesso negado (Tenant Mismatch)." });
    }

    // Permission Check
    if (!isMaster && !isSuperAdmin) {
      const canDelete = await checkPermission(userId, "products", "canDelete");
      if (!canDelete) {
        return res
          .status(403)
          .json({ message: "Sem permissão para deletar produtos." });
      }
    }

    // Delete Images
    const images = productData?.images as string[] | undefined;
    await deleteProductImages(images, productData?.tenantId);

    // Determine correct masterRef for usage decrement
    let targetMasterRef = masterRef;

    if (
      isSuperAdmin &&
      productData?.tenantId &&
      productData.tenantId !== tenantId
    ) {
      const ownerQuery = await db
        .collection("users")
        .where("tenantId", "==", productData.tenantId)
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

    // Transaction Delete
    await db.runTransaction(async (transaction) => {
      const companyRef = db
        .collection("companies")
        .doc(productData?.tenantId || tenantId);
      const companySnap = await transaction.get(companyRef); // Optimistic read

      transaction.delete(productRef);

      // Decrement Master Usage
      transaction.update(targetMasterRef, {
        "usage.products": FieldValue.increment(-1),
        updatedAt: Timestamp.now(),
      });

      // Decrement Company Usage
      if (companySnap.exists) {
        transaction.update(companyRef, {
          "usage.products": FieldValue.increment(-1),
          updatedAt: Timestamp.now(),
        });
      }
    });

    return res.json({ success: true, message: "Produto e imagens removidos." });
  } catch (error: unknown) {
    console.error("deleteProduct Error:", error);
    const message =
      error instanceof Error ? error.message : "Erro ao deletar produto.";
    return res.status(500).json({ message });
  }
};
