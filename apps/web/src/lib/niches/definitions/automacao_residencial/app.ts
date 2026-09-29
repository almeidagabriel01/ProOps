import type { NicheConfig } from "../../config-types";
import { groupsStepFor, pdfCopyFor, solutionsPageFor } from "../../copy-builders";
import { term, type NicheVocabulary } from "../../vocabulary";
import { NICHE_REGISTRY } from "../../registry";
import { unitInventoryDefinition } from "../../inventory-definitions";

const vocabulary: NicheVocabulary = {
  place: term("ambiente", "ambientes", "m"),
  group: term("solução", "soluções", "f"),
  placeExamples: "Sala, Quarto, Cozinha",
  groupExamples: "Iluminação, Áudio, Wi-Fi",
  productNamePlaceholder: "Ex: Central de automação",
};

/** Configuração de tela do nicho. */
export const nicheConfig: NicheConfig = {
  vocabulary,
  id: "automacao_residencial",
  label: NICHE_REGISTRY.automacao_residencial.label,
  analyticsColor: "#6366f1",
  seoAudience: "automação residencial",
  pageAvailability: {
    solutions: true,
    ambientes: false,
    // Projetos de instalação: em todos os nichos, com etapas padrão próprias
    // (Infraestrutura, Instalação, Configuração, Entrega).
    projects: true,
    // Tarefas: iguais em todos os nichos.
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
    titlePlaceholder: "Ex: Automação Residencial - Casa Silva",
    groupsStep: groupsStepFor(vocabulary, {
      stepDescription: "Automação",
      heading: "Soluções de Automação",
      cardDescription: "Adicione uma ou mais soluções de automação à proposta",
    }),
  },
  pdf: pdfCopyFor(vocabulary, { singleEnvironmentLayout: false, showEnvironmentHeaders: true }),
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
  fieldService: {
    equipmentTypes: [
      "Central de automação",
      "Controlador ou hub",
      "Rede e roteador",
      "Sonorização",
      "Câmera",
      "Fechadura inteligente",
      "Cortina motorizada",
      "Nobreak",
    ],
    equipmentNamePlaceholder: "Ex.: Central de automação da sala",
    preventiveChecklist: [
      "Testar cenas e comandos",
      "Atualizar o firmware da central",
      "Verificar a rede e o roteador",
      "Testar controles e o aplicativo",
      "Conferir nobreak e alimentação",
    ],
    defaultContractType: "support",
    contractTitlePlaceholder: "Ex.: Suporte mensal da automação",
    pmoc: false,
  },
  booking: {
    defaultVisitType: NICHE_REGISTRY.automacao_residencial.defaultVisitType,
  },
};
