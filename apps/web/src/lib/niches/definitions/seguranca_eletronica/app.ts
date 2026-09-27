import type { NicheConfig } from "../../config-types";
import { NICHE_REGISTRY } from "../../registry";
import { unitInventoryDefinition } from "../../inventory-definitions";

/** Configuração de tela do nicho. */
export const nicheConfig: NicheConfig = {
  id: "seguranca_eletronica",
  label: NICHE_REGISTRY.seguranca_eletronica.label,
  analyticsColor: "#dc2626",
  seoAudience: "segurança eletrônica",
  pageAvailability: {
    solutions: true,
    ambientes: false,
    // Projetos de instalação com etapas próprias (Levantamento,
    // Infraestrutura, Instalação, Configuração, Entrega).
    projects: true,
    tasks: true,
  },
  solutionsPage: {
    navigationLabel: "Sistemas",
    pageTitle: "Sistemas",
    pageDescription: "Central de gerenciamento de sistemas e áreas.",
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
    titlePlaceholder: "Ex: CFTV e alarme - Condomínio Jardim",
    groupsStep: {
      stepTitle: "Sistemas",
      stepDescription: "Segurança",
      heading: "Sistemas de Segurança",
      subheading: "Adicione os sistemas da proposta",
      cardDescription: "Adicione um ou mais sistemas de segurança à proposta",
      emptySelectionError: "Selecione pelo menos 1 sistema de segurança com produtos",
    },
  },
  pdf: {
    singleEnvironmentLayout: false,
    showEnvironmentHeaders: true,
    groupSubtotalLabel: "Subtotal do Sistema:",
    groupSubtotalOptionLabel: "Mostrar subtotal por sistema",
  },
  productCatalog: {
    inventoryView: "stock",
    singularLabel: "Produto",
    pluralLabel: "Produtos",
    newTitle: "Novo Produto",
    newSubtitle:
      "Adicione um novo equipamento ao seu catálogo com todas as informações necessárias.",
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
        id: "demo_seg_prop_3",
        title: "Loja Bela Moda: CFTV",
        clientName: "Cliente de exemplo",
        reason: "acceptance",
        detail: "Aceite do cliente a confirmar",
        href: "/proposals/demo_seg_prop_3/view",
      },
      {
        id: "demo_seg_prop_2",
        title: "Residência Lucas: alarme monitorado",
        clientName: "Cliente de exemplo",
        reason: "expiring",
        detail: "Vence em 3 dias",
        href: "/proposals/demo_seg_prop_2/view",
      },
    ],
    counts: { acceptance: 1, change_request: 0, expiring: 1, stale: 0 },
    total: 2,
  },
  onboardingStepDescriptions: {
    solutions:
      "Kits prontos, como oito câmeras com gravador ou um alarme monitorado, com os produtos de cada área já definidos.",
  },
  booking: {
    defaultVisitType: NICHE_REGISTRY.seguranca_eletronica.defaultVisitType,
  },
};
