import { db } from "@/lib/firebase";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  getDoc,
  query,
  where,
} from "firebase/firestore";
import { Tenant } from "@/types"; // We can reuse the type or define a new one

const COLLECTION_NAME = "tenants";

export const TenantService = {
  getTenants: async (): Promise<Tenant[]> => {
    const querySnapshot = await getDocs(collection(db, COLLECTION_NAME));
    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Tenant[];
  },

  getTenantById: async (id: string): Promise<Tenant | null> => {
    const docRef = doc(db, COLLECTION_NAME, id);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as Tenant;
    } else {
      return null;
    }
  },

  createTenant: async (tenant: Omit<Tenant, "id">): Promise<Tenant> => {
    const docRef = await addDoc(collection(db, COLLECTION_NAME), {
      ...tenant,
      createdAt: new Date().toISOString(),
    });
    return { id: docRef.id, ...tenant };
  },

  updateTenant: async (id: string, tenant: Partial<Tenant>): Promise<void> => {
    const docRef = doc(db, COLLECTION_NAME, id);
    await updateDoc(docRef, tenant);
  },

  deleteTenant: async (id: string): Promise<void> => {
    const errors: string[] = [];

    // Helper function to safely delete documents
    const safeDeleteDocs = async (collectionName: string) => {
      try {
        const q = query(
          collection(db, collectionName),
          where("tenantId", "==", id)
        );
        const snap = await getDocs(q);
        if (snap.empty) return;

        const deletions = snap.docs.map(async (docRef) => {
          try {
            await deleteDoc(docRef.ref);
          } catch (e) {
            console.warn(`Failed to delete ${collectionName}/${docRef.id}:`, e);
          }
        });
        await Promise.all(deletions);
      } catch (e) {
        console.warn(`Failed to query ${collectionName} for tenant ${id}:`, e);
        errors.push(`${collectionName}: query failed`);
      }
    };

    try {
      // 1. Delete all Products related to this tenant
      await safeDeleteDocs("products");

      // 2. Delete all Proposals related to this tenant
      await safeDeleteDocs("proposals");

      // 3. Delete all Custom Options related to this tenant
      await safeDeleteDocs("custom_options");

      // 4. Delete all Clients related to this tenant
      await safeDeleteDocs("clients");

      // 5. Delete all Users related to this tenant
      try {
        const usersQ = query(
          collection(db, "users"),
          where("tenantId", "==", id)
        );
        const usersSnap = await getDocs(usersQ);

        if (!usersSnap.empty) {
          const { deleteAuthUser } = await import("@/app/actions/auth");

          const userDeletions = usersSnap.docs.map(async (docRef) => {
            try {
              // Try to delete Auth User
              const result = await deleteAuthUser(docRef.id);
              if (!result.success) {
                console.warn(
                  `Failed to delete Auth User ${docRef.id}:`,
                  result.error
                );
              }
            } catch (e) {
              console.warn(`Error deleting Auth User ${docRef.id}:`, e);
            }

            // Delete Firestore doc regardless of Auth result
            try {
              await deleteDoc(docRef.ref);
            } catch (e) {
              console.warn(`Failed to delete user doc ${docRef.id}:`, e);
            }
          });
          await Promise.all(userDeletions);
        }
      } catch (e) {
        console.warn(`Failed to process users for tenant ${id}:`, e);
        errors.push("users: processing failed");
      }

      // 6. Finally, delete the Tenant itself
      try {
        const tenantRef = doc(db, COLLECTION_NAME, id);
        const tenantSnap = await getDoc(tenantRef);

        if (tenantSnap.exists()) {
          await deleteDoc(tenantRef);
        } else {
          console.log(`Tenant ${id} already deleted or doesn't exist`);
        }
      } catch (e) {
        console.error(`Failed to delete tenant document ${id}:`, e);
        throw e; // Rethrow for tenant deletion errors
      }

      if (errors.length > 0) {
        console.warn(`Tenant ${id} deleted with some issues:`, errors);
      }
    } catch (error) {
      console.error("Error performing cascading delete for tenant:", error);
      throw error;
    }
  },
};
