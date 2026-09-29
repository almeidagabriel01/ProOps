import type { NicheConfig } from "../../config-types";
import { groupsStepFor, pdfCopyFor, solutionsPageFor } from "../../copy-builders";
import { term, type NicheVocabulary } from "../../vocabulary";
import { NICHE_REGISTRY } from "../../registry";
import { unitInventoryDefinition } from "../../inventory-definitions";

const vocabulary: NicheVocabulary = {
  place: term("área", "áreas", "f"),
  group: term("sistema", "sistemas", "m"),
  placeExamples: "Portaria, Garagem, Perímetro",
  groupExamples: "CFTV, Alarme, Controle de acesso",
  productNamePlaceholder: "Ex: Câmera bullet Full HD",
};

/** Configuração de tela do nicho. */
export const nicheConfig: NicheConfig = {
  vocabulary,
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
  solutionsPage: solutionsPageFor(vocabulary, "automation"),
  pricing: {
    dimensionModes: [],
    defaultProductMode: "standard",
  },
  proposal: {
    workflow: "automation",
    lineFormat: "multiplier",
    allowLinePriceEditing: false,
    titlePlaceholder: "Ex: CFTV e alarme - Condomínio Jardim",
    groupsStep: groupsStepFor(vocabulary, {
      stepDescription: "Segurança",
      heading: "Sistemas de Segurança",
      cardDescription: "Adicione um ou mais sistemas de segurança à proposta",
      emptySelectionError: "Selecione pelo menos 1 sistema de segurança com produtos",
    }),
  },
  pdf: pdfCopyFor(vocabulary, { singleEnvironmentLayout: false, showEnvironmentHeaders: true }),
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
  fieldService: {
    equipmentTypes: [
      "Câmera",
      "DVR ou NVR",
      "Central de alarme",
      "Sensor",
      "Cerca elétrica",
      "Controle de acesso",
      "Interfone",
    ],
    equipmentNamePlaceholder: "Ex.: Câmera da garagem",
    preventiveChecklist: [
      "Testar todas as câmeras e a gravação",
      "Conferir o HD e os dias de gravação",
      "Testar sensores e sirene",
      "Verificar a bateria da central",
      "Limpar lentes e caixas",
      "Conferir o acesso remoto",
    ],
  },
  booking: {
    defaultVisitType: NICHE_REGISTRY.seguranca_eletronica.defaultVisitType,
  },
};
