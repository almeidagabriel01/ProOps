import { db } from "@/lib/firebase";
import { callApi } from "@/lib/api-client";
import {
  collection,
  addDoc,
  doc,
  getDocs,
  getDoc,
} from "firebase/firestore";
import { Tenant } from "@/types"; // We can reuse the type or define a new one
import { createKeyedTTLCache } from "@/lib/service-cache";

const COLLECTION_NAME = "tenants";

const _tenantByIdCache = createKeyedTTLCache<Tenant | null>(10 * 1000);

export function invalidateTenantCache(id?: string): void {
  _tenantByIdCache.invalidate(id);
}

export const TenantService = {
  getTenants: async (): Promise<Tenant[]> => {
    const querySnapshot = await getDocs(collection(db, COLLECTION_NAME));
    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Tenant[];
  },

  getTenantById: async (id: string): Promise<Tenant | null> => {
    return _tenantByIdCache.get(id, async () => {
      const docRef = doc(db, COLLECTION_NAME, id);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as Tenant;
      } else {
        return null;
      }
    });
  },

  createTenant: async (tenant: Omit<Tenant, "id">): Promise<Tenant> => {
    const docRef = await addDoc(collection(db, COLLECTION_NAME), {
      ...tenant,
      createdAt: new Date().toISOString(),
    });
    return { id: docRef.id, ...tenant };
  },

  updateTenant: async (id: string, tenant: Partial<Tenant>): Promise<void> => {
    await callApi(`/v1/tenants/${id}`, "PUT", tenant);
  },

};
