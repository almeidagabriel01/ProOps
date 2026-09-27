import type { NicheConfig } from "../../config-types";
import { NICHE_REGISTRY } from "../../registry";
import { unitInventoryDefinition } from "../../inventory-definitions";

/** Configuração de tela do nicho. */
export const nicheConfig: NicheConfig = {
  id: "automacao_residencial",
  label: NICHE_REGISTRY.automacao_residencial.label,
  analyticsColor: "#6366f1",
  seoAudience: "automação residencial",
  pageAvailability: {
    solutions: true,
    ambientes: false,
    // Projetos de instalação: nos dois nichos, com etapas padrão próprias
    // (Infraestrutura, Instalação, Configuração, Entrega).
    projects: true,
    // Tarefas: iguais nos dois nichos.
    tasks: true,
  },
  solutionsPage: {
    navigationLabel: "Soluções",
    pageTitle: "Soluções",
    pageDescription: "Central de gerenciamento de soluções e ambientes.",
    mode: "automation",
  },
  pricing: {
    dimensionModes: [],
    defaultProductMode: "standard",
  },
  proposal: {
    workflow: "automation",
    lineFormat: "multiplier",
    allowLinePriceEditing: false,
    titlePlaceholder: "Ex: Automação Residencial - Casa Silva",
    groupsStep: {
      stepTitle: "Soluções",
      stepDescription: "Automação",
      heading: "Soluções de Automação",
      subheading: "Adicione as soluções da proposta",
      cardDescription: "Adicione uma ou mais soluções de automação à proposta",
      emptySelectionError: "Selecione pelo menos 1 sistema de automação com produtos",
    },
  },
  pdf: {
    singleEnvironmentLayout: false,
    showEnvironmentHeaders: true,
    groupSubtotalLabel: "Subtotal da Solução:",
    groupSubtotalOptionLabel: "Mostrar subtotal por solução",
  },
  productCatalog: {
    inventoryView: "stock",
    singularLabel: "Produto",
    pluralLabel: "Produtos",
    newTitle: "Novo Produto",
    newSubtitle:
      "Adicione um novo produto ao seu catálogo com todas as informações necessárias.",
    editTitle: "Editar Produto",
    editSubtitle: (productName) =>
      `Atualize as informações de "${productName}"`,
    viewTitle: "Visualizar Produto",
    viewSubtitle: (productName) => `Detalhes do produto "${productName}"`,
    inventory: unitInventoryDefinition,
  },
  demoAttention: {
    items: [
      {
        id: "demo_prop_2",
        title: "Segurança e Controle de Acesso",
        clientName: "Cliente de exemplo",
        reason: "acceptance",
        detail: "Aceite do cliente a confirmar",
        href: "/proposals/demo_prop_2/view",
      },
      {
        id: "demo_prop_3",
        title: "Som Ambiente Multizona",
        clientName: "Cliente de exemplo",
        reason: "expiring",
        detail: "Vence em 3 dias",
        href: "/proposals/demo_prop_3/view",
      },
    ],
    counts: { acceptance: 1, change_request: 0, expiring: 1, stale: 0 },
    total: 2,
  },
  onboardingStepDescriptions: {},
  booking: {
    defaultVisitType: NICHE_REGISTRY.automacao_residencial.defaultVisitType,
  },
};
