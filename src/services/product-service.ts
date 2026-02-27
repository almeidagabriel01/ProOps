import { db } from "@/lib/firebase";
import { callApi } from "@/lib/api-client";
import {
  collection,
  doc,
  getDocs,
  query,
  where,
  getDoc,
  orderBy,
  limit,
  startAfter,
  documentId,
  QueryDocumentSnapshot,
  DocumentData,
} from "firebase/firestore";
import { PaginatedResult } from "./client-service";

export type Product = {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  price: string;
  markup?: string; // Profit percentage over base price
  manufacturer: string;
  category: string;
  stock: number;
  images: string[]; // Changed from single image to array
  image?: string | null; // Kept for backward compatibility (optional)
  /** @deprecated Status is now contextual (System/Proposal), not global */
  status?: "active" | "inactive";
  createdAt?: string;
  updatedAt?: string;
  itemType?: "product";
};

const COLLECTION_NAME = "products";
const FIRESTORE_IN_LIMIT = 30;
const PRODUCT_CACHE_TTL_MS = 5 * 60 * 1000;

type TenantProductCache = {
  expiresAt: number;
  byId: Map<string, Product>;
  allLoaded: boolean;
};

const tenantProductCache = new Map<string, TenantProductCache>();
const allProductsInFlight = new Map<string, Promise<Product[]>>();
const productsByIdsInFlight = new Map<string, Promise<Product[]>>();

function getOrCreateTenantCache(tenantId: string): TenantProductCache {
  const now = Date.now();
  const existing = tenantProductCache.get(tenantId);
  if (existing && existing.expiresAt > now) {
    return existing;
  }

  const refreshed: TenantProductCache = {
    expiresAt: now + PRODUCT_CACHE_TTL_MS,
    byId: new Map<string, Product>(),
    allLoaded: false,
  };
  tenantProductCache.set(tenantId, refreshed);
  return refreshed;
}

function touchTenantCache(cache: TenantProductCache): void {
  cache.expiresAt = Date.now() + PRODUCT_CACHE_TTL_MS;
}

function cacheProducts(tenantId: string, products: Product[]): TenantProductCache {
  const cache = getOrCreateTenantCache(tenantId);
  products.forEach((product) => {
    cache.byId.set(product.id, product);
  });
  touchTenantCache(cache);
  return cache;
}

function mapProductSnapshot(
  docSnap: QueryDocumentSnapshot<DocumentData>,
): Product {
  const data = docSnap.data();
  return {
    id: docSnap.id,
    ...data,
    itemType: "product",
    stock:
      typeof data.stock === "number" ? data.stock : Number(data.stock || 0),
    createdAt: data.createdAt?.toDate
      ? data.createdAt.toDate().toISOString()
      : data.createdAt,
    updatedAt: data.updatedAt?.toDate
      ? data.updatedAt.toDate().toISOString()
      : data.updatedAt,
  } as Product;
}

function chunkArray<T>(items: T[], size: number): T[][] {
  if (items.length === 0) return [];
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function mapProductDoc(d: QueryDocumentSnapshot<DocumentData>): Product {
  const data = d.data();
  return {
    id: d.id,
    ...data,
    itemType: "product",
    // Coerce stock to number
    stock:
      typeof data.stock === "number" ? data.stock : Number(data.stock || 0),
    createdAt: data.createdAt?.toDate
      ? data.createdAt.toDate().toISOString()
      : data.createdAt,
    updatedAt: data.updatedAt?.toDate
      ? data.updatedAt.toDate().toISOString()
      : data.updatedAt,
  } as Product;
}

function compareProductsByField(
  a: QueryDocumentSnapshot<DocumentData>,
  b: QueryDocumentSnapshot<DocumentData>,
  sortField: string,
  sortDirection: "asc" | "desc",
): number {
  const dataA = a.data();
  const dataB = b.data();

  const rawA = dataA[sortField];
  const rawB = dataB[sortField];

  let valueA: unknown = rawA;
  let valueB: unknown = rawB;

  if (sortField === "stock") {
    valueA = typeof rawA === "number" ? rawA : Number(rawA ?? 0);
    valueB = typeof rawB === "number" ? rawB : Number(rawB ?? 0);
  }

  if (valueA === valueB) {
    return 0;
  }

  if (valueA === null || valueA === undefined) {
    return 1;
  }
  if (valueB === null || valueB === undefined) {
    return -1;
  }

  if (typeof valueA === "string" && typeof valueB === "string") {
    return sortDirection === "asc"
      ? valueA.localeCompare(valueB, undefined, { numeric: true })
      : valueB.localeCompare(valueA, undefined, { numeric: true });
  }

  if (valueA < valueB) return sortDirection === "asc" ? -1 : 1;
  if (valueA > valueB) return sortDirection === "asc" ? 1 : -1;

  return 0;
}

export const ProductService = {
  // Get all products for a specific tenant
  getProducts: async (tenantId: string): Promise<Product[]> => {
    const cache = getOrCreateTenantCache(tenantId);
    if (cache.allLoaded) {
      touchTenantCache(cache);
      return Array.from(cache.byId.values());
    }

    const inflight = allProductsInFlight.get(tenantId);
    if (inflight) {
      return inflight;
    }

    const requestPromise = (async () => {
      try {
        const q = query(
          collection(db, COLLECTION_NAME),
          where("tenantId", "==", tenantId),
        );

        const querySnapshot = await getDocs(q);
        const products = querySnapshot.docs.map(mapProductDoc);
        const updatedCache = cacheProducts(tenantId, products);
        updatedCache.allLoaded = true;
        return products;
      } catch (error) {
        console.error("Error fetching products:", error);
        throw error;
      }
    })();

    allProductsInFlight.set(tenantId, requestPromise);
    try {
      return await requestPromise;
    } finally {
      allProductsInFlight.delete(tenantId);
    }
  },

  getProductsByIds: async (
    tenantId: string,
    productIds: string[],
  ): Promise<Product[]> => {
    const uniqueIds = Array.from(
      new Set(
        productIds
          .filter((id): id is string => typeof id === "string")
          .map((id) => id.trim())
          .filter(Boolean),
      ),
    );

    if (!tenantId || uniqueIds.length === 0) {
      return [];
    }

    const cache = getOrCreateTenantCache(tenantId);
    const missingIds = uniqueIds.filter((id) => !cache.byId.has(id));
    if (missingIds.length === 0) {
      touchTenantCache(cache);
      return uniqueIds
        .map((id) => cache.byId.get(id))
        .filter((product): product is Product => Boolean(product));
    }

    const requestKey = `${tenantId}:${missingIds.slice().sort().join(",")}`;
    const inflight = productsByIdsInFlight.get(requestKey);
    if (inflight) {
      const pendingProducts = await inflight;
      const refreshedCache = cacheProducts(tenantId, pendingProducts);
      return uniqueIds
        .map((id) => refreshedCache.byId.get(id))
        .filter((product): product is Product => Boolean(product));
    }

    const requestPromise = (async () => {
      try {
        const idChunks = chunkArray(missingIds, FIRESTORE_IN_LIMIT);
        const snapshots = await Promise.all(
          idChunks.map((idsChunk) =>
            getDocs(
              query(
                collection(db, COLLECTION_NAME),
                where("tenantId", "==", tenantId),
                where(documentId(), "in", idsChunk),
              ),
            ),
          ),
        );

        return snapshots.flatMap((snapshot) =>
          snapshot.docs.map((docSnap) => mapProductSnapshot(docSnap)),
        );
      } catch (error) {
        console.error("Error fetching products by ids:", error);
        throw error;
      }
    })();

    productsByIdsInFlight.set(requestKey, requestPromise);
    try {
      const fetchedProducts = await requestPromise;
      const updatedCache = cacheProducts(tenantId, fetchedProducts);
      return uniqueIds
        .map((id) => updatedCache.byId.get(id))
        .filter((product): product is Product => Boolean(product));
    } finally {
      productsByIdsInFlight.delete(requestKey);
    }
  },

  getProductsPaginated: async (
    tenantId: string,
    pageSize: number = 12,
    cursor?: QueryDocumentSnapshot<DocumentData> | null,
    sortConfig?: { key: string; direction: "asc" | "desc" } | null,
  ): Promise<PaginatedResult<Product>> => {
    try {
      const sortField = sortConfig?.key || "createdAt";
      const sortDirection = sortConfig?.direction || "desc";

      const needsClientSort = sortField === "stock";

      if (needsClientSort) {
        const baseQuery = query(
          collection(db, COLLECTION_NAME),
          where("tenantId", "==", tenantId),
        );

        const allSnapshot = await getDocs(baseQuery);
        const sortedDocs = [...allSnapshot.docs].sort((a, b) =>
          compareProductsByField(a, b, sortField, sortDirection),
        );

        const startIndex = cursor
          ? sortedDocs.findIndex((doc) => doc.id === cursor.id) + 1
          : 0;

        const pageDocs = sortedDocs.slice(startIndex, startIndex + pageSize);
        const hasMore = startIndex + pageSize < sortedDocs.length;

        return {
          data: pageDocs.map(mapProductDoc),
          lastDoc: pageDocs.length > 0 ? pageDocs[pageDocs.length - 1] : null,
          hasMore,
        };
      }

      const q = cursor
        ? query(
            collection(db, COLLECTION_NAME),
            where("tenantId", "==", tenantId),
            orderBy(sortField, sortDirection),
            startAfter(cursor),
            limit(pageSize + 1),
          )
        : query(
            collection(db, COLLECTION_NAME),
            where("tenantId", "==", tenantId),
            orderBy(sortField, sortDirection),
            limit(pageSize + 1),
          );

      const querySnapshot = await getDocs(q);
      const docs = querySnapshot.docs;
      const hasMore = docs.length > pageSize;
      const pageDocs = hasMore ? docs.slice(0, pageSize) : docs;

      return {
        data: pageDocs.map(mapProductDoc),
        lastDoc: pageDocs.length > 0 ? pageDocs[pageDocs.length - 1] : null,
        hasMore,
      };
    } catch (error) {
      console.error("Error fetching products paginated:", error);
      throw error;
    }
  },

  // Get a single product by ID
  getProductById: async (id: string): Promise<Product | null> => {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          itemType: "product",
          createdAt: data.createdAt?.toDate
            ? data.createdAt.toDate().toISOString()
            : data.createdAt,
          updatedAt: data.updatedAt?.toDate
            ? data.updatedAt.toDate().toISOString()
            : data.updatedAt,
        } as Product;
      } else {
        return null;
      }
    } catch (error) {
      console.error("Error fetching product:", error);
      throw error;
    }
  },

  updateProduct: async (id: string, data: Partial<Product>): Promise<void> => {
    try {
      await callApi(`v1/products/${id}`, "PUT", data);
    } catch (error) {
      console.error("Error updating product:", error);
      throw error;
    }
  },
};
