import { db } from "../../init";
import { Timestamp } from "firebase-admin/firestore";
import { sanitizeText, sanitizeRichText } from "../../utils/sanitize";

// ===== Interfaces =====

export interface ProductListItem {
  id: string;
  name: string;
  price: number;
  category: string;
}

export interface ProductDoc {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  price?: number;
  category?: string;
  manufacturer?: string;
  status: string;
  images?: string[];
  createdAt: FirebaseFirestore.Timestamp;
  updatedAt: FirebaseFirestore.Timestamp;
  createdById?: string;
}

export interface CreateProductParams {
  name: string;
  description?: string;
  price?: number;
  category?: string;
  manufacturer?: string;
}

export interface UpdateProductParams {
  name?: string;
  description?: string;
  price?: number;
  category?: string;
  manufacturer?: string;
  status?: string;
}

// ===== Service Functions =====

export async function listProducts(
  tenantId: string,
  opts?: {
    search?: string;
    limit?: number;
    category?: string;
    orderBy?: "createdAt" | "name" | "price" | "updatedAt";
    direction?: "asc" | "desc";
  },
): Promise<ProductListItem[]> {
  const maxLimit = Math.min(opts?.limit || 10, 50);
  const orderField = opts?.orderBy ?? "createdAt";
  const orderDir = opts?.direction ?? "desc";

  let query: FirebaseFirestore.Query = db
    .collection("products")
    .where("tenantId", "==", tenantId)
    .orderBy(orderField, orderDir)
    .limit(maxLimit);

  if (opts?.category) {
    query = db
      .collection("products")
      .where("tenantId", "==", tenantId)
      .where("category", "==", opts.category)
      .orderBy(orderField, orderDir)
      .limit(maxLimit);
  }

  const snap = await query.get();

  let results: ProductListItem[] = snap.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      name: data.name || "",
      price: data.price || 0,
      category: data.category || "",
    };
  });

  if (opts?.search) {
    const search = opts.search.toLowerCase();
    results = results.filter((p) => p.name.toLowerCase().includes(search));
  }

  return results;
}

export async function getProduct(
  productId: string,
  tenantId: string,
): Promise<ProductDoc> {
  const snap = await db.collection("products").doc(productId).get();

  if (!snap.exists) {
    throw new Error("Produto não encontrado.");
  }

  const data = snap.data()!;

  if (data.tenantId !== tenantId) {
    throw new Error("Produto não pertence a este tenant.");
  }

  return { id: snap.id, ...data } as ProductDoc;
}

export async function createProduct(
  params: CreateProductParams,
  tenantId: string,
  uid: string,
): Promise<{ id: string; name: string }> {
  const name = sanitizeText(params.name);
  const now = Timestamp.now();
  const productRef = db.collection("products").doc();

  const productData: Record<string, unknown> = {
    tenantId,
    name,
    description: params.description ? sanitizeRichText(params.description) : "",
    price: params.price || 0,
    category: params.category ? sanitizeText(params.category) : "",
    manufacturer: params.manufacturer ? sanitizeText(params.manufacturer) : "",
    status: "active",
    images: [],
    markup: "0",
    pricingModel: { mode: "standard" },
    inventoryValue: 0,
    inventoryUnit: "unit",
    stock: 0,
    createdById: uid,
    createdAt: now,
    updatedAt: now,
  };

  await productRef.set(productData);

  return { id: productRef.id, name };
}

export async function updateProduct(
  productId: string,
  updates: UpdateProductParams,
  tenantId: string,
): Promise<{ id: string; updated: boolean }> {
  const snap = await db.collection("products").doc(productId).get();

  if (!snap.exists) {
    throw new Error("Produto não encontrado.");
  }

  const data = snap.data()!;

  if (data.tenantId !== tenantId) {
    throw new Error("Produto não pertence a este tenant.");
  }

  const safeUpdate: Record<string, unknown> = {
    updatedAt: Timestamp.now(),
  };

  if (updates.name !== undefined) safeUpdate.name = sanitizeText(updates.name);
  if (updates.description !== undefined) safeUpdate.description = sanitizeRichText(updates.description);
  if (updates.price !== undefined) safeUpdate.price = updates.price;
  if (updates.category !== undefined) safeUpdate.category = sanitizeText(updates.category);
  if (updates.manufacturer !== undefined) safeUpdate.manufacturer = sanitizeText(updates.manufacturer);
  if (updates.status !== undefined) safeUpdate.status = updates.status;

  await db.collection("products").doc(productId).update(safeUpdate);

  return { id: productId, updated: true };
}

export async function deleteProduct(
  productId: string,
  tenantId: string,
): Promise<{ id: string; name: string; deleted: boolean }> {
  const snap = await db.collection("products").doc(productId).get();

  if (!snap.exists) {
    throw new Error("Produto não encontrado.");
  }

  const data = snap.data()!;

  if (data.tenantId !== tenantId) {
    throw new Error("Produto não pertence a este tenant.");
  }

  const name = data.name || "";

  await db.collection("products").doc(productId).delete();

  return { id: productId, name, deleted: true };
}
