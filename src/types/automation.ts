// Tipos para o sistema de Automação Residencial
// Hierarquia NOVA: Sistema -> Ambientes -> Produtos

/**
 * Produto associado a um Ambiente (template)
 */
export type AmbienteProduct = {
  productId: string;
  itemType?: "product" | "service";
  productName: string; // Cache para exibição
  quantity: number;
  notes?: string;
  status?: "active" | "inactive";
};

/**
 * Ambiente - agora é o nível que contém produtos
 * Pode ser um template reutilizável (ex: "Sala Padrão")
 */
export type Ambiente = {
  id: string;
  tenantId: string;
  name: string;
  description?: string; // Descrição do ambiente (template)
  icon?: string; // Emoji ou nome de ícone lucide
  order?: number;
  // Template de produtos padrão para este ambiente
  defaultProducts: AmbienteProduct[];
  createdAt?: string;
};

/**
 * Sistema - agrupa múltiplos ambientes
 * Ex: "Sistema de Iluminação" pode ter "Sala", "Quarto", etc
 */
export type Sistema = {
  id: string;
  tenantId: string;
  name: string;
  description: string; // Descrição que aparece no PDF
  icon?: string; // Emoji ou nome de ícone lucide
  // IDs dos ambientes disponíveis para este sistema
  // availableAmbienteIds: string[]; -> Deprecated in favor of configured environments

  /**
   * Main configuration: Environments within this system, each with its own product list.
   * This is the SOURCE OF TRUTH for products when adding a system to a proposal.
   */
  ambientes: SistemaAmbienteTemplate[];

  createdAt: string;
  updatedAt: string;

  // DEPRECATED: Mantido temporariamente para migração
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
  description?: string; // Optional: Override description for this specific system-environment pair
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
  notes?: string;
  status?: "active" | "inactive";
};

// ============================================
// TIPOS PARA PROPOSTAS
// ============================================

/**
 * Ambiente dentro de uma proposta (instância customizável)
 */
export type ProposalAmbiente = {
  ambienteId: string;
  ambienteName: string;
  description?: string; // Descrição snapshot do ambiente nesta proposta
  // Produtos específicos deste ambiente nesta proposta
  products: AmbienteProduct[];
};

/**
 * Sistema dentro de uma proposta - contém múltiplos ambientes
 */
export type ProposalSistema = {
  sistemaId: string;
  sistemaName: string;
  description: string;
  // Ambientes incluídos neste sistema para esta proposta
  ambientes: ProposalAmbiente[];
  // DEPRECATED: Campos antigos mantidos para migração
  /** @deprecated Use ambientes[].ambienteId instead */
  ambienteId?: string;
  /** @deprecated Use ambientes[].ambienteName instead */
  ambienteName?: string;
  /** @deprecated Use ambientes[].products instead */
  products?: SistemaProduct[];
};
