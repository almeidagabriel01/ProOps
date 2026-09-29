/**
 * Tipos da configuração de tela de um nicho (`NicheConfig`). Cada nicho
 * declara a sua em `lib/niches/definitions/<id>/app.ts`.
 */
import type { TenantNiche } from "@/types";
import type {
  DimensionPricingMode,
  ProductPricingMode,
  ProposalLineFormat,
} from "@/lib/product-pricing";
import type { AttentionResult } from "@/lib/sales/proposal-attention";
import type { NicheVocabulary, Term } from "./vocabulary";

export type InventoryUnit = "unit" | "meter";
export type ProposalWorkflow = "automation" | "catalog" | "environment";
export type SolutionsPageMode = "automation" | "environment";

export interface InventoryDefinition {
  mode: InventoryUnit;
  unitLabel: string;
  unitSuffix: string;
  priceSuffix: string;
  tableHeader: string;
  formLabel: string;
  formInitialLabel: string;
  readOnlyLabel: string;
  pageDescription: string;
  emptyStateDescription: string;
  costBalanceLabel: string;
  revenueBalanceLabel: string;
  lowValueThreshold: number;
  step: number;
}

export interface ProductCatalogDefinition {
  /**
   * `stock`: coluna de estoque na lista e saldo por unidade. `dimension_balance`:
   * sem a coluna, com os cards de saldo por medida.
   */
  inventoryView: "stock" | "dimension_balance";
  singularLabel: string;
  pluralLabel: string;
  newTitle: string;
  newSubtitle: string;
  editTitle: string;
  editSubtitle: (productName: string) => string;
  viewTitle: string;
  viewSubtitle: (productName: string) => string;
  inventory: InventoryDefinition;
}

export interface SolutionsPageDefinition {
  navigationLabel: string;
  pageTitle: string;
  pageDescription: string;
  mode: SolutionsPageMode;
}

/**
 * Páginas que ligam e desligam por nicho. Todo nicho declara todas: uma chave
 * ausente contaria como ligada e abriria a tela em silêncio.
 */
export const NICHE_PAGE_KEYS = ["solutions", "ambientes", "projects", "tasks"] as const;
export type NichePageKey = (typeof NICHE_PAGE_KEYS)[number];

/**
 * Como o nicho cobra. Os modos por medida (ids históricos `curtain_*`, que
 * ficam gravados em produtos e propostas) só aparecem no cadastro de produto
 * do nicho que os lista.
 */
export interface PricingDefinition {
  dimensionModes: readonly DimensionPricingMode[];
  /** Modo com que um produto novo nasce. */
  defaultProductMode: ProductPricingMode;
  /**
   * Nome, descrição e título de regra de um modo, trocados pelo nicho. Sem
   * entrada, vale o padrão de `lib/pricing/dimension-mode-labels.ts`.
   */
  modeLabels?: Partial<
    Record<DimensionPricingMode, Partial<{ short: string; description: string; ruleTitle: string }>>
  >;
  /**
   * Como as medidas de um modo se chamam nos campos: "comprimento" onde a
   * tubulação de climatização se mede, em vez de "largura". Sem entrada, vale
   * largura e altura. É `Term` porque os textos de ajuda concordam em gênero.
   */
  measureLabels?: Partial<
    Record<
      DimensionPricingMode,
      Partial<{
        width: Term;
        height: Term;
        /** A unidade do preço linear ("R$ 18,00 / m larg."); a tubulação diz só "m". */
        priceUnit: string;
      }>
    >
  >;
}

export interface PdfDefinition {
  /**
   * Grupo com um ambiente só vira o próprio ambiente no cabeçalho do PDF
   * (proposta por ambiente, em que cada grupo é um cômodo).
   */
  singleEnvironmentLayout: boolean;
  /**
   * Cabeçalho de cada ambiente dentro do grupo. Desligado, a opção de
   * subtotal por ambiente também some da tela.
   */
  showEnvironmentHeaders: boolean;
  groupSubtotalLabel: string;
  groupSubtotalOptionLabel: string;
}

/**
 * Textos do passo em que a proposta ganha os grupos (soluções ou ambientes).
 */
export interface ProposalGroupsStepCopy {
  stepTitle: string;
  stepDescription: string;
  heading: string;
  subheading: string;
  /** Descrição do card de grupos no fluxo por sistema. */
  cardDescription: string;
  emptySelectionError: string;
}

export interface NicheConfig {
  id: TenantNiche;
  label: string;
  /** Local e grupo do domínio, com gênero (`lib/niches/vocabulary.ts`). */
  vocabulary: NicheVocabulary;
  pageAvailability: Record<NichePageKey, boolean>;
  solutionsPage: SolutionsPageDefinition;
  pricing: PricingDefinition;
  proposal: {
    workflow: ProposalWorkflow;
    /**
     * `multiplier`: "2x R$ 10,00". `labeled`: "Qtd. 2 x R$ 10,00", com a
     * medida quando o produto é por medida e o serviço só com o valor.
     */
    lineFormat: ProposalLineFormat;
    /** Preço da linha editável dentro da proposta. */
    allowLinePriceEditing: boolean;
    titlePlaceholder: string;
    groupsStep: ProposalGroupsStepCopy;
  };
  pdf: PdfDefinition;
  productCatalog: ProductCatalogDefinition;
  /**
   * Descrição de passo do tutorial trocada pelo nicho, por id de passo
   * (`onboarding-steps.ts`). Sem entrada, vale o texto do template.
   */
  onboardingStepDescriptions: Partial<Record<string, string>>;
  /** Cor do nicho no gráfico de distribuição do painel do superadmin. */
  analyticsColor: string;
  /** Complemento de "empresas de ..." no dado estruturado da landing. */
  seoAudience: string;
  /**
   * O exemplo do card "Precisa de atenção" na conta de demonstração. Os ids
   * são de propostas do dataset de demonstração do nicho.
   */
  demoAttention: AttentionResult;
  /**
   * Tipo de visita com que o link de agendamento nasce. Espelho de
   * `defaultVisitTypes` do backend (booking-model.ts), com teste de paridade;
   * aqui só serve à demonstração, que não chama a API.
   */
  booking: {
    defaultVisitType: { id: string; label: string; durationMin: number };
  };
}
