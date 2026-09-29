import type { NicheConfig, InventoryDefinition } from "../../config-types";
import { groupsStepFor, pdfCopyFor, solutionsPageFor } from "../../copy-builders";
import { term, type NicheVocabulary } from "../../vocabulary";
import { NICHE_REGISTRY } from "../../registry";
import { areaInventoryDefinition } from "../../inventory-definitions";

const vocabulary: NicheVocabulary = {
  place: term("ambiente", "ambientes", "m"),
  // A proposta é por ambiente: cada grupo é o próprio cômodo ou fachada.
  group: term("ambiente", "ambientes", "m"),
  placeExamples: "Banheiro, Sacada, Fachada",
  groupExamples: "Banheiro, Sacada, Fachada",
  productNamePlaceholder: "Ex: Box de vidro temperado 8 mm",
};

// Estoque por área (m²); muda o que se conta nele.
const inventory: InventoryDefinition = {
  ...areaInventoryDefinition,
  pageDescription: "Gerencie o catálogo de vidros, esquadrias e acessórios, a metragem disponível e os preços.",
  emptyStateDescription:
    "Cadastre vidros, perfis, kits e acessórios para controlar a metragem disponível e montar propostas.",
};

/** Configuração de tela do nicho. */
export const nicheConfig: NicheConfig = {
  vocabulary,
  id: "vidracaria_esquadrias",
  label: NICHE_REGISTRY.vidracaria_esquadrias.label,
  analyticsColor: "#0891b2",
  seoAudience: "vidraçarias e empresas de esquadrias",
  pageAvailability: {
    solutions: false,
    ambientes: true,
    projects: true,
    tasks: true,
  },
  solutionsPage: solutionsPageFor(vocabulary, "environment", {
    pageDescription: "Gerencie os ambientes e configure os vidros e esquadrias padrão de cada um.",
  }),
  pricing: {
    // Faixa de altura é coisa de cortina de trilho; vidro se cobra por área
    // ou, no caso de perfil e pingadeira, por metro linear.
    dimensionModes: ["curtain_meter", "curtain_width"],
    defaultProductMode: "curtain_meter",
    modeLabels: {
      curtain_meter: {
        short: "Por m²",
        description: "Usa largura x altura do vão x preço do m², com markup na proposta.",
        ruleTitle: "Regra por m²",
      },
      curtain_width: {
        short: "Por metro linear",
        description: "Usa só a largura (perfil, trilho, pingadeira) x preço do metro, com markup na proposta.",
        ruleTitle: "Regra por metro linear",
      },
    },
  },
  proposal: {
    workflow: "environment",
    lineFormat: "labeled",
    allowLinePriceEditing: true,
    titlePlaceholder: "Ex: Box e sacada - Apto 51",
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
      "Adicione um vidro, uma esquadria ou um acessório ao catálogo, com preço por m² ou por unidade.",
    editTitle: "Editar Produto",
    editSubtitle: (productName) => `Atualize as informações de "${productName}"`,
    viewTitle: "Visualizar Produto",
    viewSubtitle: (productName) => `Detalhes do produto "${productName}"`,
    inventory,
  },
  demoAttention: {
    items: [
      {
        id: "demo_vid_prop_3",
        title: "Fachada da Clínica Sorriso",
        clientName: "Cliente de exemplo",
        reason: "acceptance",
        detail: "Aceite do cliente a confirmar",
        href: "/proposals/demo_vid_prop_3/view",
      },
      {
        id: "demo_vid_prop_2",
        title: "Envidraçamento da sacada",
        clientName: "Cliente de exemplo",
        reason: "expiring",
        detail: "Vence em 3 dias",
        href: "/proposals/demo_vid_prop_2/view",
      },
    ],
    counts: { acceptance: 1, change_request: 0, expiring: 1, stale: 0 },
    total: 2,
  },
  onboardingStepDescriptions: {},
  fieldService: {
    equipmentTypes: [
      "Janela",
      "Porta",
      "Box de banheiro",
      "Guarda-corpo",
      "Fachada",
      "Espelho",
    ],
    equipmentNamePlaceholder: "Ex.: Janela de correr da suíte",
    preventiveChecklist: [
      "Verificar vedação e silicone",
      "Regular roldanas e trilhos",
      "Conferir fechaduras e puxadores",
      "Inspecionar vidros e fixações",
      "Limpar os drenos das esquadrias",
    ],
    defaultContractType: "maintenance",
    contractTitlePlaceholder: "Ex.: Manutenção das esquadrias",
    pmoc: false,
  },
  booking: {
    defaultVisitType: NICHE_REGISTRY.vidracaria_esquadrias.defaultVisitType,
  },
};
