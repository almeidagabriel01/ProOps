import type { NicheConfig } from "../../config-types";
import { groupsStepFor, pdfCopyFor, solutionsPageFor } from "../../copy-builders";
import { term, type NicheVocabulary } from "../../vocabulary";
import { NICHE_REGISTRY } from "../../registry";
import { meterInventoryDefinition } from "../../inventory-definitions";

const vocabulary: NicheVocabulary = {
  place: term("ambiente", "ambientes", "m"),
  // A proposta é por ambiente: cada grupo é o próprio cômodo.
  group: term("ambiente", "ambientes", "m"),
  placeExamples: "Sala, Quarto, Varanda",
  groupExamples: "Sala, Quarto, Varanda",
  productNamePlaceholder: "Ex: Cortina wave premium",
};

/** Configuração de tela do nicho. */
export const nicheConfig: NicheConfig = {
  vocabulary,
  id: "cortinas",
  label: NICHE_REGISTRY.cortinas.label,
  analyticsColor: "#f59e0b",
  seoAudience: "persianas, cortinas e toldos",
  pageAvailability: {
    solutions: false,
    ambientes: true,
    // Projetos de instalação: em todos os nichos, com etapas padrão próprias
    // (Medição, Produção, Instalação, Entrega).
    projects: true,
    // Tarefas: iguais em todos os nichos.
    tasks: true,
  },
  solutionsPage: solutionsPageFor(vocabulary, "environment", {
    pageDescription: "Gerencie os ambientes e configure os produtos padrões de cada espaço.",
  }),
  pricing: {
    dimensionModes: ["curtain_meter", "curtain_height", "curtain_width"],
    defaultProductMode: "curtain_meter",
  },
  proposal: {
    workflow: "environment",
    lineFormat: "labeled",
    allowLinePriceEditing: true,
    titlePlaceholder: "Ex: Persianas motorizadas - Apto 302",
    groupsStep: groupsStepFor(vocabulary, {
      stepDescription: "Selecionar ambientes",
      subheading: "Selecione os ambientes desejados na proposta",
    }),
  },
  pdf: pdfCopyFor(vocabulary, { singleEnvironmentLayout: true, showEnvironmentHeaders: false }),
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
