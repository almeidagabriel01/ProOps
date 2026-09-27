import type { TenantNicheId } from "../../shared/niches";
import type {
  ProductPricingModel,
  ProposalProductPricingDetails,
} from "../../shared/dimension-pricing";

/**
 * Dados de uma demonstração de nicho, sem código: o motor
 * (`scripts/demo/engine.ts`) transforma isto nos documentos que a conta free
 * do nicho navega. Arquivo puro (só tipos), para os datasets poderem ser lidos
 * também por testes do front.
 *
 * Todo id de documento é explícito aqui: re-semear um ambiente sobrescreve os
 * mesmos documentos em vez de duplicar. Só saem do motor os ids que seguem uma
 * convenção do app: options, projeto (`proposal_<id>`), itens de checklist,
 * lineItemIds e `transaction_categories/<tenantId>`.
 */

export interface DemoLine {
  productId: string;
  /** Quantidade do produto por unidade. */
  quantity?: number;
  /** Medidas do produto cobrado por medida. */
  pricingDetails?: ProposalProductPricingDetails;
}

export interface DemoProduct {
  id: string;
  name: string;
  description: string;
  price: number;
  /** Ausente: markup "0". */
  markup?: number;
  category: string;
  manufacturer: string;
  inventoryValue: number;
  /** Ausente: preço por unidade. */
  pricingModel?: ProductPricingModel;
}

export interface DemoService {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
}

export interface DemoClient {
  id: string;
  name: string;
  email: string;
  phone: string;
}

export interface DemoAmbiente {
  id: string;
  name: string;
  description: string;
  icon: string;
  order: number;
  lines: DemoLine[];
}

export interface DemoSistema {
  id: string;
  name: string;
  description: string;
  icon: string;
  ambientes: Array<{ ambienteId: string; lines: DemoLine[] }>;
}

export interface DemoProposal {
  id: string;
  title: string;
  status: "approved" | "sent";
  clientId: string;
  /** Sistemas (fluxo por sistema) ou ambientes (fluxo por ambiente). */
  groupIds: string[];
  day: number;
}

export interface DemoTransaction {
  id: string;
  type: "income" | "expense";
  description: string;
  amount: number;
  status: "paid" | "pending" | "overdue";
  walletId: string;
  dateOffset: number;
  dueOffset: number;
  paid?: boolean;
  clientName?: string;
  category?: string;
  installment?: { count: number; number: number; groupId: string };
  recurringGroupId?: string;
}

export interface DemoStage {
  id: string;
  name: string;
  status: "pending" | "in_progress" | "done";
  items: Array<[string, boolean]>;
  completedOffset: number | null;
}

export interface DemoDataset {
  niche: TenantNicheId;
  tenantId: string;
  tenant: { slug: string; primaryColor: string };
  optionIdPrefix: string;
  products: DemoProduct[];
  services: DemoService[];
  clients: DemoClient[];
  ambientes: DemoAmbiente[];
  /** Só no fluxo por sistema. */
  sistemas?: DemoSistema[];
  proposals: { workflow: "system" | "environment"; items: DemoProposal[] };
  finance: {
    wallets: Array<{
      id: string;
      name: string;
      type: string;
      color: string;
      icon: string;
      isDefault: boolean;
    }>;
    categories: Array<{ id: string; name: string; kind: "income" | "expense"; group: string }>;
    transactions: DemoTransaction[];
  };
  project: {
    proposalId: string;
    clientId: string;
    startOffset: number;
    dueOffset: number;
    createdOffset: number;
    stages: DemoStage[];
    visit: { eventId: string; stageId: string; dayOffset: number; hours: number; color: string };
  };
  leads: Array<{
    id: string;
    name: string;
    phone: string;
    company?: string;
    source: string;
    stage: string;
    estimatedValue: number;
    nextAction: string;
    nextActionOffset: number;
  }>;
  activities: Array<{
    id: string;
    leadId: string;
    type: string;
    title: string;
    offset: number;
    /** Padrão: concluída. */
    done?: boolean;
  }>;
  notifications: Array<{
    id: string;
    type: string;
    title: string;
    message: string;
    offset: number;
    read: boolean;
    proposalId?: string;
    transactionId?: string;
    projectId?: string;
  }>;
  tasks: Array<{
    id: string;
    title: string;
    dueOffset: number;
    done: boolean;
    clientId?: string;
    clientName?: string;
    proposalId?: string;
    proposalTitle?: string;
    leadId?: string;
    leadName?: string;
  }>;
  /** Documentos de versões antigas da demonstração que não existem mais. */
  legacyDeletes?: string[];
  /**
   * Formato herdado dos seeds antigos, explícito para o motor reproduzi-los
   * byte a byte. Novos datasets usam o padrão: `catalogFormat()`.
   */
  format: DemoFormat;
}

export interface DemoFormat {
  /** `${productId}_li` ou `${ambienteId}_li_${n}`. */
  ambienteLineId: "byProduct" | "byIndex";
  /** Linha do ambiente leva a quantidade e as medidas calculadas. */
  ambienteLinePricing: boolean;
  /** `${productId}_li` ou `${sistemaId}-${ambienteId}_li_${n}`. */
  sistemaLineId?: "byProduct" | "byInstanceIndex";
  /** `${instanceId}_${productId}` ou `${instanceId}_${n}`. */
  proposalLineId: "byProduct" | "byIndex";
  /** Preço pelo catálogo, ou o markup único e o arredondamento do seed antigo de automação. */
  pricing: { kind: "catalog" } | { kind: "legacyFlatMarkup"; markup: number };
  /** Arredondar o total da proposta em centavos. */
  totalInCents: boolean;
}

export interface SeedDemoResult {
  tenant: number;
  products: number;
  services: number;
  clients: number;
  ambientes: number;
  sistemas?: number;
  options: number;
  proposals: number;
  wallets: number;
  transactions: number;
  leads: number;
  activities: number;
  projects: number;
  notifications: number;
  tasks: number;
}
