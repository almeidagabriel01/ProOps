import type { NicheConfig, InventoryDefinition } from "../../config-types";
import { groupsStepFor, pdfCopyFor, solutionsPageFor } from "../../copy-builders";
import { term, type NicheVocabulary } from "../../vocabulary";
import { NICHE_REGISTRY } from "../../registry";
import { meterInventoryDefinition } from "../../inventory-definitions";

const vocabulary: NicheVocabulary = {
  place: term("ambiente", "ambientes", "m"),
  // A proposta é por ambiente: cozinha, dormitório e closet são os grupos.
  group: term("ambiente", "ambientes", "m"),
  placeExamples: "Cozinha, Dormitório, Closet",
  groupExamples: "Cozinha, Dormitório, Closet",
  productNamePlaceholder: "Ex: Armário em MDF branco TX",
};

// O estoque por medida é o mesmo de persianas; muda o que se conta nele.
const inventory: InventoryDefinition = {
  ...meterInventoryDefinition,
  pageDescription: "Gerencie o catálogo de módulos, chapas, ferragens e acessórios, a metragem disponível e os preços.",
  emptyStateDescription:
    "Cadastre módulos, painéis, ferragens e acessórios para controlar a metragem disponível e montar propostas.",
};

/** Configuração de tela do nicho. */
export const nicheConfig: NicheConfig = {
  vocabulary,
  id: "marcenaria",
  label: NICHE_REGISTRY.marcenaria.label,
  analyticsColor: "#a16207",
  seoAudience: "marcenarias e lojas de móveis planejados",
  pageAvailability: {
    solutions: false,
    ambientes: true,
    projects: true,
    tasks: true,
  },
  solutionsPage: solutionsPageFor(vocabulary, "environment", {
    pageDescription: "Gerencie os ambientes e configure os móveis e acessórios padrão de cada um.",
  }),
  pricing: {
    // Faixa de altura é coisa de cortina de trilho; móvel se cobra pela área
    // de frente ou pelo metro linear.
    dimensionModes: ["curtain_meter", "curtain_width"],
    defaultProductMode: "curtain_meter",
    modeLabels: {
      curtain_meter: {
        short: "Por m²",
        description: "Usa largura x altura do móvel x preço do m², com markup na proposta.",
        ruleTitle: "Regra por m²",
      },
      curtain_width: {
        short: "Por metro linear",
        description: "Usa só a largura (armário de cozinha, bancada, rodapé) x preço do metro, com markup na proposta.",
        ruleTitle: "Regra por metro linear",
      },
    },
  },
  proposal: {
    workflow: "environment",
    lineFormat: "labeled",
    allowLinePriceEditing: true,
    titlePlaceholder: "Ex: Cozinha e dormitório - Apto 82",
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
      "Adicione um móvel, um painel ou uma ferragem ao catálogo, com preço por m², por metro linear ou por unidade.",
    editTitle: "Editar Produto",
    editSubtitle: (productName) => `Atualize as informações de "${productName}"`,
    viewTitle: "Visualizar Produto",
    viewSubtitle: (productName) => `Detalhes do produto "${productName}"`,
    inventory,
  },
  demoAttention: {
    items: [
      {
        id: "demo_marc_prop_3",
        title: "Casa do Marcos: projeto completo",
        clientName: "Cliente de exemplo",
        reason: "acceptance",
        detail: "Aceite do cliente a confirmar",
        href: "/proposals/demo_marc_prop_3/view",
      },
      {
        id: "demo_marc_prop_2",
        title: "Closet da suíte",
        clientName: "Cliente de exemplo",
        reason: "expiring",
        detail: "Vence em 3 dias",
        href: "/proposals/demo_marc_prop_2/view",
      },
    ],
    counts: { acceptance: 1, change_request: 0, expiring: 1, stale: 0 },
    total: 2,
  },
  onboardingStepDescriptions: {},
  booking: {
    defaultVisitType: NICHE_REGISTRY.marcenaria.defaultVisitType,
  },
};
