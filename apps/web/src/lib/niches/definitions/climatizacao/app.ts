import type { NicheConfig, InventoryDefinition } from "../../config-types";
import { groupsStepFor, pdfCopyFor, solutionsPageFor } from "../../copy-builders";
import { term, type NicheVocabulary } from "../../vocabulary";
import { NICHE_REGISTRY } from "../../registry";
import { unitInventoryDefinition } from "../../inventory-definitions";

const vocabulary: NicheVocabulary = {
  place: term("ambiente", "ambientes", "m"),
  // A proposta é por ambiente: cada sala ou quarto recebe o seu aparelho.
  group: term("ambiente", "ambientes", "m"),
  placeExamples: "Sala, Suíte, Escritório",
  groupExamples: "Sala, Suíte, Escritório",
  productNamePlaceholder: "Ex: Split inverter 12.000 BTUs",
};

// Aparelho, kit e peça se contam por unidade; a tubulação entra por metro na
// proposta, sem estoque próprio por medida.
const inventory: InventoryDefinition = {
  ...unitInventoryDefinition,
  pageDescription: "Gerencie o catálogo de aparelhos, tubulação, kits e peças, o estoque e os preços.",
  emptyStateDescription:
    "Cadastre aparelhos, kits de instalação e peças para controlar o estoque e montar propostas.",
};

/** Configuração de tela do nicho. */
export const nicheConfig: NicheConfig = {
  vocabulary,
  id: "climatizacao",
  label: NICHE_REGISTRY.climatizacao.label,
  analyticsColor: "#0284c7",
  seoAudience: "empresas de climatização e ar-condicionado",
  pageAvailability: {
    solutions: false,
    ambientes: true,
    projects: true,
    tasks: true,
  },
  solutionsPage: solutionsPageFor(vocabulary, "environment", {
    pageDescription: "Gerencie os ambientes e configure os aparelhos e a instalação padrão de cada um.",
  }),
  pricing: {
    // Aparelho, kit e mão de obra por unidade; tubulação, cabo e dreno pelo
    // comprimento. Área e faixa de altura não existem nesse ramo.
    dimensionModes: ["curtain_width"],
    defaultProductMode: "standard",
    modeLabels: {
      curtain_width: {
        short: "Por metro",
        description: "Usa o comprimento (tubulação, cabo, dreno) x preço do metro, com markup na proposta.",
        ruleTitle: "Regra por metro",
      },
    },
    measureLabels: {
      curtain_width: { width: term("comprimento", "comprimentos", "m"), priceUnit: "m" },
    },
  },
  proposal: {
    workflow: "environment",
    lineFormat: "labeled",
    allowLinePriceEditing: true,
    titlePlaceholder: "Ex: Splits da sala e das suítes - Casa 12",
    groupsStep: groupsStepFor(vocabulary, {
      stepDescription: "Selecionar ambientes",
      subheading: "Selecione os ambientes desejados na proposta",
    }),
  },
  pdf: pdfCopyFor(vocabulary, { singleEnvironmentLayout: true, showEnvironmentHeaders: false }),
  productCatalog: {
    inventoryView: "stock",
    singularLabel: "Produto",
    pluralLabel: "Produtos",
    newTitle: "Novo Produto",
    newSubtitle:
      "Adicione um aparelho, um kit ou um material ao catálogo, com preço por unidade ou por metro.",
    editTitle: "Editar Produto",
    editSubtitle: (productName) => `Atualize as informações de "${productName}"`,
    viewTitle: "Visualizar Produto",
    viewSubtitle: (productName) => `Detalhes do produto "${productName}"`,
    inventory,
  },
  demoAttention: {
    items: [
      {
        id: "demo_clim_prop_3",
        title: "Escritório Contábil Andrade",
        clientName: "Cliente de exemplo",
        reason: "acceptance",
        detail: "Aceite do cliente a confirmar",
        href: "/proposals/demo_clim_prop_3/view",
      },
      {
        id: "demo_clim_prop_2",
        title: "Split da suíte master",
        clientName: "Cliente de exemplo",
        reason: "expiring",
        detail: "Vence em 3 dias",
        href: "/proposals/demo_clim_prop_2/view",
      },
    ],
    counts: { acceptance: 1, change_request: 0, expiring: 1, stale: 0 },
    total: 2,
  },
  onboardingStepDescriptions: {},
  booking: {
    defaultVisitType: NICHE_REGISTRY.climatizacao.defaultVisitType,
  },
};
