import { NICHE_REGISTRY } from "../../../shared/niches";
import type { DemoDataset } from "../types";

/**
 * Demonstração de móveis planejados: armário e painel por m², armário de
 * cozinha por metro linear, ferragem e iluminação por unidade, e propostas por
 * ambiente.
 */
const P = {
  armario: "demo_mov_prod_armario",
  painel: "demo_mov_prod_painel",
  cozinha: "demo_mov_prod_cozinha",
  ferragens: "demo_mov_prod_ferragens",
  led: "demo_mov_prod_led",
} as const;

const A = {
  cozinha: "demo_mov_amb_cozinha",
  dormitorio: "demo_mov_amb_dormitorio",
  closet: "demo_mov_amb_closet",
} as const;

export const moveisPlanejadosDemo: DemoDataset = {
  niche: "moveis_planejados",
  tenantId: NICHE_REGISTRY.moveis_planejados.demoTenantId,
  tenant: { slug: "proops-demo-moveis", primaryColor: "#a16207" },
  idPrefix: "demo_mov",
  products: [
    { id: P.armario, name: "Armário em MDF Branco TX", description: "Roupeiro ou armário em MDF 18 mm, cobrado por metro quadrado de frente.", price: 850, markup: 60, category: "Armários", manufacturer: "Chapas Serra Verde", inventoryValue: 60, pricingModel: { mode: "curtain_meter" } },
    { id: P.painel, name: "Painel Ripado em MDF Freijó", description: "Painel ripado para cabeceira ou TV, cobrado por metro quadrado.", price: 520, markup: 60, category: "Painéis", manufacturer: "Chapas Serra Verde", inventoryValue: 30, pricingModel: { mode: "curtain_meter" } },
    { id: P.cozinha, name: "Armário de Cozinha Aéreo e Inferior", description: "Módulos aéreos e inferiores com tampo, cobrados por metro linear.", price: 1200, markup: 50, category: "Cozinhas", manufacturer: "Chapas Serra Verde", inventoryValue: 20, pricingModel: { mode: "curtain_width" } },
    { id: P.ferragens, name: "Kit de Ferragens com Amortecedor", description: "Dobradiças e corrediças com fechamento suave para um módulo.", price: 290, markup: 40, category: "Ferragens", manufacturer: "Metais Vitória", inventoryValue: 40, pricingModel: { mode: "standard" } },
    { id: P.led, name: "Fita de LED para Nichos", description: "Iluminação embutida com fonte e perfil de alumínio.", price: 180, markup: 50, category: "Iluminação", manufacturer: "Luz & Cia", inventoryValue: 25, pricingModel: { mode: "standard" } },
  ],
  services: [
    { id: "demo_mov_svc_projeto", name: "Medição e Projeto", description: "Visita para medir o ambiente e projeto com as cores e acabamentos.", price: 350, category: "Projeto" },
    { id: "demo_mov_svc_montagem", name: "Montagem no Local", description: "Transporte, montagem, fixação e regulagem dos móveis.", price: 600, category: "Montagem" },
  ],
  clients: [
    { id: "demo_mov_client_luisa", name: "Luísa Fernandes", email: "luisa.demo@exemplo.com", phone: "11999993001" },
    { id: "demo_mov_client_bruno", name: "Bruno Tavares", email: "bruno.demo@exemplo.com", phone: "11999993002" },
    { id: "demo_mov_client_marcos", name: "Marcos Azevedo", email: "marcos.demo@exemplo.com", phone: "11999993003" },
  ],
  ambientes: [
    {
      id: A.cozinha,
      name: "Cozinha",
      description: "Armários aéreos e inferiores com tampo e iluminação nos nichos.",
      icon: "🍳",
      order: 1,
      lines: [
        { productId: P.cozinha, pricingDetails: { mode: "curtain_width", width: 3.2, panels: 1 } },
        { productId: P.ferragens, quantity: 4 },
        { productId: P.led, quantity: 1 },
      ],
    },
    {
      id: A.dormitorio,
      name: "Dormitório",
      description: "Roupeiro de parede a parede e painel ripado na cabeceira.",
      icon: "🛏️",
      order: 2,
      lines: [
        { productId: P.armario, pricingDetails: { mode: "curtain_meter", width: 2.8, height: 2.6, area: 0, panels: 1 } },
        { productId: P.painel, pricingDetails: { mode: "curtain_meter", width: 1.6, height: 1.2, area: 0, panels: 1 } },
        { productId: P.ferragens, quantity: 3 },
      ],
    },
    {
      id: A.closet,
      name: "Closet",
      description: "Closet aberto com gaveteiro e iluminação.",
      icon: "👔",
      order: 3,
      lines: [
        { productId: P.armario, pricingDetails: { mode: "curtain_meter", width: 2.2, height: 2.6, area: 0, panels: 1 } },
        { productId: P.ferragens, quantity: 2 },
        { productId: P.led, quantity: 2 },
      ],
    },
  ],
  proposals: {
    workflow: "environment",
    items: [
      { id: "demo_mov_prop_1", title: "Apartamento Luísa: cozinha e dormitório", status: "approved", clientId: "demo_mov_client_luisa", groupIds: [A.cozinha, A.dormitorio], day: 10 },
      { id: "demo_mov_prop_2", title: "Closet da suíte", status: "sent", clientId: "demo_mov_client_bruno", groupIds: [A.closet], day: 14 },
      { id: "demo_mov_prop_3", title: "Casa do Marcos: projeto completo", status: "sent", clientId: "demo_mov_client_marcos", groupIds: [A.cozinha, A.dormitorio, A.closet], day: 18 },
    ],
  },
  finance: {
    wallets: [
      { id: "demo_mov_wallet_main", name: "Conta Principal", type: "bank", color: "#a16207", icon: "Landmark", isDefault: true },
      { id: "demo_mov_wallet_cash", name: "Caixa", type: "cash", color: "#22c55e", icon: "Wallet", isDefault: false },
    ],
    categories: [
      { id: "demo_mov_cat_propostas", name: "Propostas", kind: "income", group: "revenue" },
      { id: "demo_mov_cat_servicos_receita", name: "Serviços", kind: "income", group: "revenue" },
      { id: "demo_mov_cat_fornecedores", name: "Fornecedores", kind: "expense", group: "cost" },
      { id: "demo_mov_cat_operacional", name: "Operacional", kind: "expense", group: "cost" },
      { id: "demo_mov_cat_marketing", name: "Marketing", kind: "expense", group: "operating" },
      { id: "demo_mov_cat_impostos", name: "Impostos", kind: "expense", group: "deduction" },
    ],
    transactions: [
      { id: "demo_mov_txn_01", type: "income", description: "Apartamento Luísa: entrada", amount: 5200, status: "paid", walletId: "demo_mov_wallet_main", dateOffset: -12, dueOffset: -12, paid: true, clientName: "Luísa Fernandes", category: "Propostas" },
      { id: "demo_mov_txn_02", type: "income", description: "Apartamento Luísa: saldo na montagem", amount: 5400, status: "pending", walletId: "demo_mov_wallet_main", dateOffset: -12, dueOffset: 8, clientName: "Luísa Fernandes", category: "Propostas" },
      { id: "demo_mov_txn_03", type: "income", description: "Projeto avulso de home office", amount: 350, status: "paid", walletId: "demo_mov_wallet_cash", dateOffset: -4, dueOffset: -4, paid: true, clientName: "Bruno Tavares", category: "Serviços" },
      { id: "demo_mov_txn_04", type: "income", description: "Painel da sala: parcela em atraso", amount: 1300, status: "overdue", walletId: "demo_mov_wallet_main", dateOffset: -25, dueOffset: -6, clientName: "Marcos Azevedo", category: "Propostas" },
      { id: "demo_mov_txn_05", type: "expense", description: "Chapas de MDF (lote do mês)", amount: 4800, status: "paid", walletId: "demo_mov_wallet_main", dateOffset: -14, dueOffset: -14, paid: true, category: "Fornecedores" },
      { id: "demo_mov_txn_06", type: "expense", description: "Ferragens e corrediças", amount: 1900, status: "pending", walletId: "demo_mov_wallet_main", dateOffset: -2, dueOffset: 10, category: "Fornecedores" },
      { id: "demo_mov_txn_07", type: "expense", description: "Fita de borda, cola e parafusos", amount: 520, status: "paid", walletId: "demo_mov_wallet_cash", dateOffset: -5, dueOffset: -5, paid: true, category: "Operacional" },
      { id: "demo_mov_txn_08", type: "expense", description: "Anúncios online", amount: 600, status: "paid", walletId: "demo_mov_wallet_cash", dateOffset: -11, dueOffset: -11, paid: true, category: "Marketing" },
    ],
  },
  project: {
    proposalId: "demo_mov_prop_1",
    clientId: "demo_mov_client_luisa",
    startOffset: -12,
    dueOffset: 15,
    createdOffset: -12,
    stageProgress: [
      { status: "done", doneItems: 3, completedOffset: -11 },
      { status: "done", doneItems: 2, completedOffset: -7 },
      { status: "in_progress", doneItems: 1, completedOffset: null },
      { status: "pending", doneItems: 0, completedOffset: null },
      { status: "pending", doneItems: 0, completedOffset: null },
    ],
    visit: { eventId: "demo_mov_event_montagem", stageIndex: 3, dayOffset: 5, hours: 6, color: "#a16207" },
  },
  leads: [
    { id: "demo_mov_lead_carla", name: "Carla Mendes", phone: "11988883001", source: "instagram", stage: "novo", estimatedValue: 18000, nextAction: "Agendar a medição da cozinha", nextActionOffset: 1 },
    { id: "demo_mov_lead_construtora", name: "Construtora Alvorada", company: "Construtora Alvorada", phone: "11988883002", source: "indicacao", stage: "contato", estimatedValue: 140000, nextAction: "Orçar as cozinhas dos 12 apartamentos decorados", nextActionOffset: 2 },
    { id: "demo_mov_lead_arq", name: "Arq. Helena Duarte", company: "Duarte Interiores", phone: "11988883003", source: "arquiteto", stage: "qualificado", estimatedValue: 46000, nextAction: "Enviar proposta do apartamento completo", nextActionOffset: 3 },
  ],
  activities: [
    { id: "demo_mov_activity_construtora_1", leadId: "demo_mov_lead_construtora", type: "ligacao", title: "Primeiro contato: quer móveis para os decorados do lançamento", offset: -2 },
    { id: "demo_mov_activity_arq_1", leadId: "demo_mov_lead_arq", type: "reuniao", title: "Reunião com a arquiteta sobre acabamentos e prazos", offset: -3 },
  ],
  notifications: [
    { id: "demo_mov_notif_vista", type: "proposal_viewed", title: "Proposta visualizada", message: "Bruno Tavares abriu \"Closet da suíte\".", proposalId: "demo_mov_prop_2", offset: 0, read: false },
    { id: "demo_mov_notif_pago", type: "transaction_paid_online", title: "Pagamento recebido", message: "Pagamento via PIX confirmado para \"Apartamento Luísa: entrada\".", transactionId: "demo_mov_txn_01", offset: -1, read: false },
    { id: "demo_mov_notif_aceite", type: "proposal_accepted", title: "Cliente aceitou a proposta", message: "Marcos Azevedo aceitou \"Casa do Marcos: projeto completo\" pelo link. Confirme para gerar o financeiro.", proposalId: "demo_mov_prop_3", offset: -2, read: true },
  ],
  tasks: [
    { id: "demo_mov_task_producao", title: "Conferir o corte das chapas do dormitório da Luísa", dueOffset: 0, done: false, clientId: "demo_mov_client_luisa", clientName: "Luísa Fernandes", proposalId: "demo_mov_prop_1", proposalTitle: "Apartamento Luísa: cozinha e dormitório" },
    { id: "demo_mov_task_amostras", title: "Levar amostras de MDF para a Construtora Alvorada", dueOffset: 2, done: false, leadId: "demo_mov_lead_construtora", leadName: "Construtora Alvorada" },
  ],
};
