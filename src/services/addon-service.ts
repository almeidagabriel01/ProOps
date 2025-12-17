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

const COLLECTION_NAME = "addons";

// Add-on definitions with pricing and feature mappings
export const ADDON_DEFINITIONS: AddonDefinition[] = [
  {
    id: "financial",
    name: "Módulo Financeiro",
    description: "Controle de receitas, despesas e fluxo de caixa completo",
    featureKey: "hasFinancial",
    featureValue: true,
    pricing: {
      monthly: 29,
      yearly: 296, // ~15% discount
    },
    stripePriceIds: {
      monthly: "price_1SeyQtGrkF9UfsqcfBbA4bVG",
      yearly: "price_1SeySnGrkF9UfsqcU0wYFJm3",
    },
    icon: "DollarSign",
    availableForTiers: ["starter"],
  },
  {
    id: "pdf_editor_partial",
    name: "Editor PDF Parcial",
    description: "Acesse 3 templates do editor de PDF (sem edição de conteúdo)",
    featureKey: "maxPdfTemplates",
    featureValue: 3, // 3 templates, like Pro plan
    pricing: {
      monthly: 19,
      yearly: 194, // ~15% discount
    },
    stripePriceIds: {
      monthly: "price_1SeyW5GrkF9UfsqcWcaAne7e",
      yearly: "price_1SeyWOGrkF9UfsqcYHrTww0e",
    },
    icon: "Layout",
    availableForTiers: ["starter"],
  },
  {
    id: "pdf_editor_full",
    name: "Editor PDF Completo",
    description: "Acesso total ao editor: todos os templates + edição de conteúdo",
    featureKey: "canEditPdfSections",
    featureValue: true, // Full access including content editing
    pricing: {
      monthly: 40,
      yearly: 465,
    },
    stripePriceIds: {
      monthly: "price_1Seyb4GrkF9UfsqcgOn6b6BT",
      yearly: "price_1SeycQGrkF9UfsqcRXMhIHo3",
    },
    icon: "FileEdit",
    availableForTiers: ["starter", "pro"],
  },
];

export const AddonService = {
  /**
   * Get all add-ons purchased by a tenant
   */
  async getAddonsForTenant(tenantId: string): Promise<PurchasedAddon[]> {
    if (!tenantId) {

      return [];
    }

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
      console.error('[AddonService] Error querying addons:', error);
      // If it's an index error, Firestore will provide a link to create it
      throw error;
    }
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
    return ADDON_DEFINITIONS.filter((addon) =>
      addon.availableForTiers.includes(tier)
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
      ...(status === "cancelled" ? { expiresAt: new Date().toISOString() } : {}),
    });
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
  applyAddonsToFeatures(
    baseFeatures: {
      hasFinancial: boolean;
      canEditPdfSections: boolean;
      maxPdfTemplates: number;
      canCustomizeTheme: boolean;
      maxUsers: number;
    },
    purchasedAddons: AddonType[]
  ): typeof baseFeatures {
    const result = { ...baseFeatures };

    for (const addonType of purchasedAddons) {
      const definition = this.getAddonDefinition(addonType);
      if (!definition) continue;

      switch (addonType) {
        case "financial":
          result.hasFinancial = true;
          break;
        case "pdf_editor_partial":
          // 3 templates, no content editing (like Pro plan)
          if (result.maxPdfTemplates !== -1) {
            result.maxPdfTemplates = Math.max(result.maxPdfTemplates, 3);
          }
          break;
        case "pdf_editor_full":
          // Full access: unlimited templates + content editing
          result.maxPdfTemplates = -1; // Unlimited
          result.canEditPdfSections = true;
          break;
      }
    }

    return result;
  },
};
