// Tipos para o sistema de Automação Residencial
// Hierarquia: Ambiente -> Sistema -> Produtos

export type Ambiente = {
    id: string;
    tenantId: string;
    name: string;
    icon?: string; // Emoji ou nome de ícone lucide
    order: number;
    createdAt: string;
}

export type SistemaProduct = {
    productId: string;
    productName: string; // Cache para exibição
    quantity: number;
    notes?: string;
}

export type Sistema = {
    id: string;
    tenantId: string;
    name: string;
    description: string; // Descrição que aparece no PDF
    icon?: string; // Emoji ou nome de ícone lucide
    // Um sistema pode pertencer a múltiplos ambientes
    ambienteIds: string[];
    // Template de produtos padrão para este sistema
    defaultProducts: SistemaProduct[];
    createdAt: string;
    updatedAt: string;
}

// Tipo usado em propostas - cópia do template que pode ser customizada
export type ProposalSistema = {
    sistemaId: string;
    sistemaName: string;
    ambienteId: string;
    ambienteName: string;
    description: string;
    products: SistemaProduct[];
}
