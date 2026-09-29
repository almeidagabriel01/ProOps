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

/**
 * Andamento de uma etapa da obra de exemplo. Nome e checklist vêm do roteiro
 * do nicho (`stageTemplate` em `NICHE_REGISTRY`), na mesma ordem.
 */
export interface DemoStageProgress {
  status: "pending" | "in_progress" | "done";
  /** Quantos itens do checklist, do início, estão feitos. */
  doneItems: number;
  completedOffset: number | null;
}

export interface DemoDataset {
  niche: TenantNicheId;
  tenantId: string;
  tenant: { slug: string; primaryColor: string };
  /** Prefixo dos ids que o motor monta (options e etapas da obra). */
  idPrefix: string;
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
    /** Uma entrada por etapa do roteiro do nicho. */
    stageProgress: DemoStageProgress[];
    visit: { eventId: string; stageIndex: number; dayOffset: number; hours: number; color: string };
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
  /**
   * Assistência técnica: os aparelhos dos clientes e as OS. Uma concluída e
   * assinada (com peça do estoque), uma agendada e uma aberta, para a lista
   * mostrar a fila e o detalhe mostrar a assinatura.
   */
  fieldService: {
    equipment: DemoEquipment[];
    orders: DemoServiceOrder[];
    /**
     * O contrato típico do nicho, ativo, com as duas últimas mensalidades já
     * recebidas: a lista mostra a receita recorrente e o detalhe, o histórico.
     */
    contracts: DemoContract[];
  };
  /** Documentos de versões antigas da demonstração que não existem mais. */
  legacyDeletes?: string[];
}

export interface DemoEquipment {
  id: string;
  clientId: string;
  name: string;
  type: string;
  brand: string;
  model: string;
  serialNumber?: string;
  capacity?: string;
  location: string;
  /** Dias antes de hoje. */
  installedDaysAgo: number;
  warrantyMonths: number;
}

export interface DemoServiceOrder {
  id: string;
  number: number;
  clientId: string;
  type: "corrective" | "preventive" | "installation" | "inspection";
  priority: "low" | "normal" | "high" | "urgent";
  status: "open" | "scheduled" | "completed";
  title: string;
  description: string;
  equipmentIds: string[];
  /** Dias a partir de hoje e hora de Brasília da visita. */
  schedule?: { dayOffset: number; hour: number; durationMin: number };
  checklist: Array<{ text: string; done: boolean }>;
  /** Preço de venda sai do catálogo do dataset. */
  items: Array<{ kind: "product" | "service"; refId: string; quantity: number }>;
  report?: string;
  /** Só na concluída: quem assinou. */
  signedBy?: string;
  createdDaysAgo: number;
}

export interface DemoContract {
  id: string;
  number: number;
  clientId: string;
  title: string;
  type: "monitoring" | "maintenance" | "support" | "pmoc" | "other";
  /** Serviço do catálogo e o valor mensal dele no contrato. */
  lines: Array<{ refId: string; quantity: number; unitPrice: number }>;
  billingDay: number;
  equipmentIds: string[];
  visitIntervalMonths: number | null;
  visitChecklist: string[];
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
  equipment: number;
  serviceOrders: number;
  contracts: number;
}
