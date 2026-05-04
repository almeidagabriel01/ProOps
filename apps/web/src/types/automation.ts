import { ProposalProductPricingDetails } from "@/lib/product-pricing";

// Tipos para o sistema de automacao residencial
// Hierarquia NOVA: Sistema -> Ambientes -> Produtos

/**
 * Produto associado a um Ambiente (template)
 */
export type AmbienteProduct = {
  lineItemId?: string;
  productId: string;
  itemType?: "product" | "service";
  productName: string; // Cache para exibicao
  quantity: number;
  pricingDetails?: ProposalProductPricingDetails;
  notes?: string;
  status?: "active" | "inactive";
};

/**
 * Ambiente - agora e o nivel que contem produtos
 * Pode ser um template reutilizavel (ex: "Sala Padrao")
 */
export type Ambiente = {
  id: string;
  tenantId: string;
  name: string;
  description?: string; // Descricao do ambiente (template)
  icon?: string; // Emoji ou nome de icone lucide
  order?: number;
  // Template de produtos padrao para este ambiente
  defaultProducts: AmbienteProduct[];
  createdAt?: string;
};

/**
 * Sistema - agrupa multiplos ambientes
 * Ex: "Sistema de Iluminacao" pode ter "Sala", "Quarto", etc
 */
export type Sistema = {
  id: string;
  tenantId: string;
  name: string;
  description: string; // Descricao que aparece no PDF
  icon?: string; // Emoji ou nome de icone lucide

  /**
   * Main configuration: Environments within this system, each with its own product list.
   * This is the SOURCE OF TRUTH for products when adding a system to a proposal.
   */
  ambientes: SistemaAmbienteTemplate[];

  createdAt: string;
  updatedAt: string;

  // DEPRECATED: mantido temporariamente para migracao
  /** @deprecated Use ambientes field instead */
  availableAmbienteIds?: string[];
  /** @deprecated Use Ambiente.defaultProducts instead */
  defaultProducts?: SistemaProduct[];
  /** @deprecated Use availableAmbienteIds instead */
  ambienteIds?: string[];
};

/**
 * Configuration of an Environment within a System Template.
 * Defines which products are standard for this Room in this System.
 */
export type SistemaAmbienteTemplate = {
  ambienteId: string; // Reference to the generic Ambiente (Name/Icon)
  description?: string; // Optional: override description for this specific system-environment pair
  products: AmbienteProduct[];
};

/**
 * @deprecated Use AmbienteProduct instead
 * Mantido temporariamente para compatibilidade com dados existentes
 */
export type SistemaProduct = {
  productId: string;
  itemType?: "product" | "service";
  productName: string;
  quantity: number;
  pricingDetails?: ProposalProductPricingDetails;
  notes?: string;
  status?: "active" | "inactive";
};

// ============================================
// TIPOS PARA PROPOSTAS
// ============================================

/**
 * Ambiente dentro de uma proposta (instancia customizavel)
 */
export type ProposalAmbiente = {
  ambienteId: string;
  ambienteName: string;
  description?: string; // Descricao snapshot do ambiente nesta proposta
  // Produtos especificos deste ambiente nesta proposta
  products: AmbienteProduct[];
};

/**
 * Sistema dentro de uma proposta - contem multiplos ambientes
 */
export type ProposalSistema = {
  sistemaId: string;
  sistemaName: string;
  description: string;
  // Ambientes incluidos neste sistema para esta proposta
  ambientes: ProposalAmbiente[];
  // DEPRECATED: campos antigos mantidos para migracao
  /** @deprecated Use ambientes[].ambienteId instead */
  ambienteId?: string;
  /** @deprecated Use ambientes[].ambienteName instead */
  ambienteName?: string;
  /** @deprecated Use ambientes[].products instead */
  products?: SistemaProduct[];
};
