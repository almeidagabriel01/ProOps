/**
 * Utilities for converting between legacy and new data formats
 * for the multi-ambiente per sistema feature.
 */

import { ProposalSistema, AmbienteProduct } from "@/types/automation";
import { ProposalSystemInstance, ProposalAmbienteInstance, ProposalProduct } from "@/types/proposal";

/**
 * Convert legacy ProposalSistema (single ambiente) to new format (multiple ambientes)
 */
export function normalizeProposalSistema(legacy: Partial<ProposalSistema> & { sistemaId: string; sistemaName: string }): ProposalSistema {
  // If already has ambientes array, return as-is
  if (legacy.ambientes && legacy.ambientes.length > 0) {
    return legacy as ProposalSistema;
  }

  // Convert legacy format to new format
  const ambientes = [];
  if (legacy.ambienteId && legacy.ambienteName) {
    ambientes.push({
      ambienteId: legacy.ambienteId,
      ambienteName: legacy.ambienteName,
      description: "", // Legacy didn't have description snapshot
      products: legacy.products || [],
    });
  }

  return {
    sistemaId: legacy.sistemaId,
    sistemaName: legacy.sistemaName,
    description: legacy.description || "",
    ambientes,
    // Keep legacy fields for backward compat
    ambienteId: legacy.ambienteId,
    ambienteName: legacy.ambienteName,
    products: legacy.products,
  };
}

/**
 * Convert legacy ProposalSystemInstance to new format
 */
export function normalizeProposalSystemInstance(legacy: Partial<ProposalSystemInstance> & { sistemaId: string; sistemaName: string }): ProposalSystemInstance {
  // If already has ambientes array, return as-is
  if (legacy.ambientes && legacy.ambientes.length > 0) {
    return legacy as ProposalSystemInstance;
  }

  // Convert legacy format
  const ambientes: ProposalAmbienteInstance[] = [];
  if (legacy.ambienteId && legacy.ambienteName) {
    ambientes.push({
      ambienteId: legacy.ambienteId,
      ambienteName: legacy.ambienteName,
      productIds: legacy.productIds || [],
    });
  }

  return {
    sistemaId: legacy.sistemaId,
    sistemaName: legacy.sistemaName,
    description: legacy.description,
    ambientes,
    // Keep legacy fields
    ambienteId: legacy.ambienteId,
    ambienteName: legacy.ambienteName,
    productIds: legacy.productIds,
  };
}

/**
 * Create a new ProposalSistema with a single ambiente
 */
export function createProposalSistema(
  sistemaId: string,
  sistemaName: string,
  ambienteId: string,
  ambienteName: string,
  description: string = "",
  products: AmbienteProduct[] = [],
  ambienteDescription?: string
): ProposalSistema {
  return {
    sistemaId,
    sistemaName,
    description,
    ambientes: [{
      ambienteId,
      ambienteName,
      description: ambienteDescription,
      products,
    }],
    // Legacy fields for backward compat
    ambienteId,
    ambienteName,
    products,
  };
}

/**
 * Create a new ProposalSystemInstance with a single ambiente
 */
export function createProposalSystemInstance(
  sistemaId: string,
  sistemaName: string,
  ambienteId: string,
  ambienteName: string,
  description: string = "",
  productIds: string[] = []
): ProposalSystemInstance {
  return {
    sistemaId,
    sistemaName,
    description,
    ambientes: [{
      ambienteId,
      ambienteName,
      productIds,
    }],
    // Legacy fields
    ambienteId,
    ambienteName,
    productIds,
  };
}

/**
 * Get the primary ambiente from a ProposalSistema
 * (for components that still work with single ambiente)
 */
export function getPrimaryAmbiente(sistema: ProposalSistema): { ambienteId: string; ambienteName: string; products: AmbienteProduct[] } | null {
  // Try new format first
  if (sistema.ambientes && sistema.ambientes.length > 0) {
    return sistema.ambientes[0];
  }
  // Fall back to legacy
  if (sistema.ambienteId && sistema.ambienteName) {
    return {
      ambienteId: sistema.ambienteId,
      ambienteName: sistema.ambienteName,
      products: sistema.products || [],
    };
  }
  return null;
}

/**
 * Get the primary ambiente from a ProposalSystemInstance
 */
export function getPrimaryAmbienteInstance(sistema: ProposalSystemInstance): ProposalAmbienteInstance | null {
  // Try new format first
  if (sistema.ambientes && sistema.ambientes.length > 0) {
    return sistema.ambientes[0];
  }
  // Fall back to legacy
  if (sistema.ambienteId && sistema.ambienteName) {
    return {
      ambienteId: sistema.ambienteId,
      ambienteName: sistema.ambienteName,
      productIds: sistema.productIds || [],
    };
  }
  return null;
}

/**
 * Generate an instance ID for a produto based on sistema and ambiente
 */
export function generateAmbienteInstanceId(sistemaId: string, ambienteId: string): string {
  return `${sistemaId}-${ambienteId}`;
}

/**
 * Parse an ambiente instance ID back to parts
 */
export function parseAmbienteInstanceId(instanceId: string): { sistemaId: string; ambienteId: string } | null {
  const parts = instanceId.split("-");
  if (parts.length >= 2) {
    return {
      sistemaId: parts[0],
      ambienteId: parts.slice(1).join("-"),
    };
  }
  return null;
}

/**
 * Get all products from a ProposalSistema (across all ambientes)
 */
export function getAllProductsFromSistema(sistema: ProposalSistema): AmbienteProduct[] {
  if (sistema.ambientes && sistema.ambientes.length > 0) {
    return sistema.ambientes.flatMap(a => a.products);
  }
  return sistema.products || [];
}

/**
 * Migrate a ProposalProduct to use the new ambienteInstanceId format
 */
export function normalizeProposalProduct(product: ProposalProduct): ProposalProduct {
  // If already has ambienteInstanceId, return as-is
  if (product.ambienteInstanceId) {
    return product;
  }
  // Migrate from systemInstanceId if present
  if (product.systemInstanceId) {
    return {
      ...product,
      ambienteInstanceId: product.systemInstanceId,
    };
  }
  return product;
}

/**
 * Check if a sistema uses the new multi-ambiente format
 */
export function isMultiAmbienteFormat(sistema: ProposalSistema | ProposalSystemInstance): boolean {
  return !!(sistema.ambientes && sistema.ambientes.length > 0);
}
