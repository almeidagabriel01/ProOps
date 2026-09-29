import { db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
  updateDoc,
} from "firebase/firestore";
import { AddonType, PurchasedAddon, AddonDefinition, PlanTier } from "@/types";
import { createKeyedTTLCache } from "@/lib/service-cache";
import {
  ADDON_DEFINITIONS,
  FISCAL_ADDON_MONTHLY_INVOICES,
  applyAddonsToFeatures,
} from "@/lib/plans/addon-definitions";

const _addonsCache = createKeyedTTLCache<PurchasedAddon[]>(60 * 1000);
const _addonsWithPastDueCache = createKeyedTTLCache<PurchasedAddon[]>(60 * 1000);

const COLLECTION_NAME = "addons";

export { ADDON_DEFINITIONS, FISCAL_ADDON_MONTHLY_INVOICES };

export const AddonService = {
  /**
   * Get all add-ons purchased by a tenant
   */
  async getAddonsForTenant(tenantId: string): Promise<PurchasedAddon[]> {
    if (!tenantId) {
      return [];
    }

    return _addonsCache.get(tenantId, async () => {
      try {
        const q = query(
          collection(db, COLLECTION_NAME),
          where("tenantId", "==", tenantId),
          where("status", "==", "active")
        );

        const snapshot = await getDocs(q);

        const addons = snapshot.docs.map((doc) => {
          const data = doc.data();

          return {
            id: doc.id,
            ...data,
          };
        }) as PurchasedAddon[];

        return addons;
      } catch (error) {
        console.error("[AddonService] Error querying addons:", error);
        // If it's an index error, Firestore will provide a link to create it
        throw error;
      }
    });
  },
  /**
   * Get all add-ons including past_due (for grace period handling)
   * Uses two separate queries to avoid needing a composite index
   */
  async getAddonsWithPastDue(tenantId: string): Promise<PurchasedAddon[]> {
    if (!tenantId) {
      return [];
    }

    return _addonsWithPastDueCache.get(tenantId, async () => {
      try {
        // Query active addons
        const activeQuery = query(
          collection(db, COLLECTION_NAME),
          where("tenantId", "==", tenantId),
          where("status", "==", "active")
        );

        // Query past_due addons
        const pastDueQuery = query(
          collection(db, COLLECTION_NAME),
          where("tenantId", "==", tenantId),
          where("status", "==", "past_due")
        );

        // Execute both queries in parallel
        const [activeSnapshot, pastDueSnapshot] = await Promise.all([
          getDocs(activeQuery),
          getDocs(pastDueQuery),
        ]);

        const addons: PurchasedAddon[] = [];

        activeSnapshot.docs.forEach((doc) => {
          addons.push({ id: doc.id, ...doc.data() } as PurchasedAddon);
        });

        pastDueSnapshot.docs.forEach((doc) => {
          addons.push({ id: doc.id, ...doc.data() } as PurchasedAddon);
        });

        return addons;
      } catch (error) {
        console.error(
          "[AddonService] Error querying addons with past_due:",
          error
        );
        throw error;
      }
    });
  },

  /**
   * Check if tenant has a specific add-on
   */
  async hasAddon(tenantId: string, addonType: AddonType): Promise<boolean> {
    if (!tenantId) return false;

    const q = query(
      collection(db, COLLECTION_NAME),
      where("tenantId", "==", tenantId),
      where("addonType", "==", addonType),
      where("status", "==", "active")
    );

    const snapshot = await getDocs(q);
    return !snapshot.empty;
  },

  /**
   * Get add-on definition by type
   */
  getAddonDefinition(addonType: AddonType): AddonDefinition | undefined {
    return ADDON_DEFINITIONS.find((a) => a.id === addonType);
  },

  /**
   * Get available add-ons for a specific plan tier
   */
  getAvailableAddonsForTier(tier: PlanTier): AddonDefinition[] {
    // Normalize tier to lowercase for comparison
    const normalizedTier = tier?.toLowerCase() as PlanTier;
    return ADDON_DEFINITIONS.filter((addon) =>
      addon.availableForTiers.includes(normalizedTier)
    );
  },

  /**
   * Save a purchased add-on (called after Stripe webhook confirms payment)
   */
  async savePurchasedAddon(addon: Omit<PurchasedAddon, "id">): Promise<string> {
    const addonId = `${addon.tenantId}_${addon.addonType}`;

    await setDoc(doc(db, COLLECTION_NAME, addonId), {
      ...addon,
      purchasedAt: addon.purchasedAt || new Date().toISOString(),
    });

    return addonId;
  },

  /**
   * Update add-on status (e.g., cancel, reactivate)
   */
  async updateAddonStatus(
    tenantId: string,
    addonType: AddonType,
    status: PurchasedAddon["status"]
  ): Promise<void> {
    const addonId = `${tenantId}_${addonType}`;

    await updateDoc(doc(db, COLLECTION_NAME, addonId), {
      status,
      ...(status === "cancelled"
        ? { expiresAt: new Date().toISOString() }
        : {}),
    });
  },

  /**
   * Invalidate the in-memory addon caches for a tenant.
   * Call after any mutation (cancel, reactivate) to ensure the next read fetches
   * fresh state from Firestore instead of returning stale cached data.
   */
  invalidateCache(tenantId: string): void {
    _addonsCache.invalidate(tenantId);
    _addonsWithPastDueCache.invalidate(tenantId);
  },

  /**
   * Delete an add-on (hard delete, use only for cleanup)
   */
  async deleteAddon(tenantId: string, addonType: AddonType): Promise<void> {
    const addonId = `${tenantId}_${addonType}`;
    await deleteDoc(doc(db, COLLECTION_NAME, addonId));
  },

  /**
   * Get effective feature value considering add-ons
   * This merges base plan features with purchased add-ons
   */
  applyAddonsToFeatures,
};
