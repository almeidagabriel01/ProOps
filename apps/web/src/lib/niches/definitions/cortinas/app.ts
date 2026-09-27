import type { NicheConfig } from "../../config-types";
import { NICHE_REGISTRY } from "../../registry";
import { meterInventoryDefinition } from "../../inventory-definitions";

/** Configuração de tela do nicho. */
export const nicheConfig: NicheConfig = {
  id: "cortinas",
  label: NICHE_REGISTRY.cortinas.label,
  analyticsColor: "#f59e0b",
  seoAudience: "persianas, cortinas e toldos",
  pageAvailability: {
    solutions: false,
    ambientes: true,
    // Projetos de instalação: nos dois nichos, com etapas padrão próprias
    // (Medição, Produção, Instalação, Entrega).
    projects: true,
    // Tarefas: iguais nos dois nichos.
    tasks: true,
  },
  solutionsPage: {
    navigationLabel: "Ambientes",
    pageTitle: "Ambientes",
    pageDescription:
      "Gerencie os ambientes e configure os produtos padrões de cada espaço.",
    mode: "environment",
  },
  pricing: {
    dimensionModes: ["curtain_meter", "curtain_height", "curtain_width"],
    defaultProductMode: "curtain_meter",
  },
  proposal: {
    workflow: "environment",
    lineFormat: "labeled",
    allowLinePriceEditing: true,
    titlePlaceholder: "Ex: Persianas motorizadas - Apto 302",
    groupsStep: {
      stepTitle: "Ambientes",
      stepDescription: "Selecionar ambientes",
      heading: "Ambientes",
      subheading: "Selecione os ambientes desejados na proposta",
      cardDescription: "Adicione um ou mais ambientes à proposta",
      emptySelectionError: "Selecione pelo menos 1 ambiente com produtos",
    },
  },
  pdf: {
    singleEnvironmentLayout: true,
    showEnvironmentHeaders: false,
    groupSubtotalLabel: "Subtotal do Ambiente:",
    groupSubtotalOptionLabel: "Mostrar subtotais por ambiente",
  },
  productCatalog: {
    inventoryView: "dimension_balance",
    singularLabel: "Produto",
    pluralLabel: "Produtos",
    newTitle: "Novo Produto",
    newSubtitle:
      "Adicione um novo item ao catálogo de persianas, cortinas e toldos com preço, acabamento e metragem.",
    editTitle: "Editar Produto",
    editSubtitle: (productName) =>
      `Atualize as informações de "${productName}"`,
    viewTitle: "Visualizar Produto",
    viewSubtitle: (productName) => `Detalhes do produto "${productName}"`,
    inventory: meterInventoryDefinition,
  },
  demoAttention: {
    items: [
      {
        id: "demo_cort_prop_3",
        title: "Showroom Studio Casa Viva",
        clientName: "Cliente de exemplo",
        reason: "acceptance",
        detail: "Aceite do cliente a confirmar",
        href: "/proposals/demo_cort_prop_3/view",
      },
      {
        id: "demo_cort_prop_2",
        title: "Toldo da varanda gourmet",
        clientName: "Cliente de exemplo",
        reason: "expiring",
        detail: "Vence em 3 dias",
        href: "/proposals/demo_cort_prop_2/view",
      },
    ],
    counts: { acceptance: 1, change_request: 0, expiring: 1, stale: 0 },
    total: 2,
  },
  onboardingStepDescriptions: {},
  booking: {
    defaultVisitType: NICHE_REGISTRY.cortinas.defaultVisitType,
  },
};
