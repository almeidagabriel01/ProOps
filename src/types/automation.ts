// Tipos para o sistema de Automação Residencial
// Hierarquia NOVA: Sistema -> Ambientes -> Produtos

/**
 * Produto associado a um Ambiente (template)
 */
export type AmbienteProduct = {
  productId: string;
  productName: string; // Cache para exibição
  quantity: number;
  notes?: string;
};

/**
 * Ambiente - agora é o nível que contém produtos
 * Pode ser um template reutilizável (ex: "Sala Padrão")
 */
export type Ambiente = {
  id: string;
  tenantId: string;
  name: string;
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
  availableAmbienteIds: string[];
  createdAt: string;
  updatedAt: string;
  // DEPRECATED: Mantido temporariamente para migração
  /** @deprecated Use Ambiente.defaultProducts instead */
  defaultProducts?: SistemaProduct[];
  /** @deprecated Use availableAmbienteIds instead */
  ambienteIds?: string[];
};

/**
 * @deprecated Use AmbienteProduct instead
 * Mantido temporariamente para compatibilidade com dados existentes
 */
export type SistemaProduct = {
  productId: string;
  productName: string;
  quantity: number;
  notes?: string;
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
