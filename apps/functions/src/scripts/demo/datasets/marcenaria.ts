import { NICHE_REGISTRY } from "../../../shared/niches";
import type { DemoDataset } from "../types";

/**
 * Demonstração de marcenaria e móveis planejados: armário e painel por m², armário de
 * cozinha por metro linear, ferragem e iluminação por unidade, e propostas por
 * ambiente.
 */
const P = {
  armario: "demo_marc_prod_armario",
  painel: "demo_marc_prod_painel",
  cozinha: "demo_marc_prod_cozinha",
  ferragens: "demo_marc_prod_ferragens",
  led: "demo_marc_prod_led",
} as const;

const A = {
  cozinha: "demo_marc_amb_cozinha",
  dormitorio: "demo_marc_amb_dormitorio",
  closet: "demo_marc_amb_closet",
} as const;

export const marcenariaDemo: DemoDataset = {
  niche: "marcenaria",
  tenantId: NICHE_REGISTRY.marcenaria.demoTenantId,
  tenant: { slug: "proops-demo-marcenaria", primaryColor: "#a16207" },
  idPrefix: "demo_marc",
  products: [
    { id: P.armario, name: "Armário em MDF Branco TX", description: "Roupeiro ou armário em MDF 18 mm, cobrado por metro quadrado de frente.", price: 850, markup: 60, category: "Armários", manufacturer: "Chapas Serra Verde", inventoryValue: 60, pricingModel: { mode: "curtain_meter" } },
    { id: P.painel, name: "Painel Ripado em MDF Freijó", description: "Painel ripado para cabeceira ou TV, cobrado por metro quadrado.", price: 520, markup: 60, category: "Painéis", manufacturer: "Chapas Serra Verde", inventoryValue: 30, pricingModel: { mode: "curtain_meter" } },
    { id: P.cozinha, name: "Armário de Cozinha Aéreo e Inferior", description: "Módulos aéreos e inferiores com tampo, cobrados por metro linear.", price: 1200, markup: 50, category: "Cozinhas", manufacturer: "Chapas Serra Verde", inventoryValue: 20, pricingModel: { mode: "curtain_width" } },
    { id: P.ferragens, name: "Kit de Ferragens com Amortecedor", description: "Dobradiças e corrediças com fechamento suave para um módulo.", price: 290, markup: 40, category: "Ferragens", manufacturer: "Metais Vitória", inventoryValue: 40, pricingModel: { mode: "standard" } },
    { id: P.led, name: "Fita de LED para Nichos", description: "Iluminação embutida com fonte e perfil de alumínio.", price: 180, markup: 50, category: "Iluminação", manufacturer: "Luz & Cia", inventoryValue: 25, pricingModel: { mode: "standard" } },
  ],
  services: [
    { id: "demo_marc_svc_projeto", name: "Medição e Projeto", description: "Visita para medir o ambiente e projeto com as cores e acabamentos.", price: 350, category: "Projeto" },
    { id: "demo_marc_svc_montagem", name: "Montagem no Local", description: "Transporte, montagem, fixação e regulagem dos móveis.", price: 600, category: "Montagem" },
  ],
  clients: [
    { id: "demo_marc_client_luisa", name: "Luísa Fernandes", email: "luisa.demo@exemplo.com", phone: "11999993001" },
    { id: "demo_marc_client_bruno", name: "Bruno Tavares", email: "bruno.demo@exemplo.com", phone: "11999993002" },
    { id: "demo_marc_client_marcos", name: "Marcos Azevedo", email: "marcos.demo@exemplo.com", phone: "11999993003" },
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
      { id: "demo_marc_prop_1", title: "Apartamento Luísa: cozinha e dormitório", status: "approved", clientId: "demo_marc_client_luisa", groupIds: [A.cozinha, A.dormitorio], day: 10 },
      { id: "demo_marc_prop_2", title: "Closet da suíte", status: "sent", clientId: "demo_marc_client_bruno", groupIds: [A.closet], day: 14 },
      { id: "demo_marc_prop_3", title: "Casa do Marcos: projeto completo", status: "sent", clientId: "demo_marc_client_marcos", groupIds: [A.cozinha, A.dormitorio, A.closet], day: 18 },
    ],
  },
  finance: {
    wallets: [
      { id: "demo_marc_wallet_main", name: "Conta Principal", type: "bank", color: "#a16207", icon: "Landmark", isDefault: true },
      { id: "demo_marc_wallet_cash", name: "Caixa", type: "cash", color: "#22c55e", icon: "Wallet", isDefault: false },
    ],
    categories: [
      { id: "demo_marc_cat_propostas", name: "Propostas", kind: "income", group: "revenue" },
      { id: "demo_marc_cat_servicos_receita", name: "Serviços", kind: "income", group: "revenue" },
      { id: "demo_marc_cat_fornecedores", name: "Fornecedores", kind: "expense", group: "cost" },
      { id: "demo_marc_cat_operacional", name: "Operacional", kind: "expense", group: "cost" },
      { id: "demo_marc_cat_marketing", name: "Marketing", kind: "expense", group: "operating" },
      { id: "demo_marc_cat_impostos", name: "Impostos", kind: "expense", group: "deduction" },
    ],
    transactions: [
      { id: "demo_marc_txn_01", type: "income", description: "Apartamento Luísa: entrada", amount: 5200, status: "paid", walletId: "demo_marc_wallet_main", dateOffset: -12, dueOffset: -12, paid: true, clientName: "Luísa Fernandes", category: "Propostas" },
      { id: "demo_marc_txn_02", type: "income", description: "Apartamento Luísa: saldo na montagem", amount: 5400, status: "pending", walletId: "demo_marc_wallet_main", dateOffset: -12, dueOffset: 8, clientName: "Luísa Fernandes", category: "Propostas" },
      { id: "demo_marc_txn_03", type: "income", description: "Projeto avulso de home office", amount: 350, status: "paid", walletId: "demo_marc_wallet_cash", dateOffset: -4, dueOffset: -4, paid: true, clientName: "Bruno Tavares", category: "Serviços" },
      { id: "demo_marc_txn_04", type: "income", description: "Painel da sala: parcela em atraso", amount: 1300, status: "overdue", walletId: "demo_marc_wallet_main", dateOffset: -25, dueOffset: -6, clientName: "Marcos Azevedo", category: "Propostas" },
      { id: "demo_marc_txn_05", type: "expense", description: "Chapas de MDF (lote do mês)", amount: 4800, status: "paid", walletId: "demo_marc_wallet_main", dateOffset: -14, dueOffset: -14, paid: true, category: "Fornecedores" },
      { id: "demo_marc_txn_06", type: "expense", description: "Ferragens e corrediças", amount: 1900, status: "pending", walletId: "demo_marc_wallet_main", dateOffset: -2, dueOffset: 10, category: "Fornecedores" },
      { id: "demo_marc_txn_07", type: "expense", description: "Fita de borda, cola e parafusos", amount: 520, status: "paid", walletId: "demo_marc_wallet_cash", dateOffset: -5, dueOffset: -5, paid: true, category: "Operacional" },
      { id: "demo_marc_txn_08", type: "expense", description: "Anúncios online", amount: 600, status: "paid", walletId: "demo_marc_wallet_cash", dateOffset: -11, dueOffset: -11, paid: true, category: "Marketing" },
    ],
  },
  project: {
    proposalId: "demo_marc_prop_1",
    clientId: "demo_marc_client_luisa",
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
    visit: { eventId: "demo_marc_event_montagem", stageIndex: 3, dayOffset: 5, hours: 6, color: "#a16207" },
  },
  leads: [
    { id: "demo_marc_lead_carla", name: "Carla Mendes", phone: "11988883001", source: "instagram", stage: "novo", estimatedValue: 18000, nextAction: "Agendar a medição da cozinha", nextActionOffset: 1 },
    { id: "demo_marc_lead_construtora", name: "Construtora Alvorada", company: "Construtora Alvorada", phone: "11988883002", source: "indicacao", stage: "contato", estimatedValue: 140000, nextAction: "Orçar as cozinhas dos 12 apartamentos decorados", nextActionOffset: 2 },
    { id: "demo_marc_lead_arq", name: "Arq. Helena Duarte", company: "Duarte Interiores", phone: "11988883003", source: "arquiteto", stage: "qualificado", estimatedValue: 46000, nextAction: "Enviar proposta do apartamento completo", nextActionOffset: 3 },
  ],
  activities: [
    { id: "demo_marc_activity_construtora_1", leadId: "demo_marc_lead_construtora", type: "ligacao", title: "Primeiro contato: quer móveis para os decorados do lançamento", offset: -2 },
    { id: "demo_marc_activity_arq_1", leadId: "demo_marc_lead_arq", type: "reuniao", title: "Reunião com a arquiteta sobre acabamentos e prazos", offset: -3 },
  ],
  notifications: [
    { id: "demo_marc_notif_vista", type: "proposal_viewed", title: "Proposta visualizada", message: "Bruno Tavares abriu \"Closet da suíte\".", proposalId: "demo_marc_prop_2", offset: 0, read: false },
    { id: "demo_marc_notif_pago", type: "transaction_paid_online", title: "Pagamento recebido", message: "Pagamento via PIX confirmado para \"Apartamento Luísa: entrada\".", transactionId: "demo_marc_txn_01", offset: -1, read: false },
    { id: "demo_marc_notif_aceite", type: "proposal_accepted", title: "Cliente aceitou a proposta", message: "Marcos Azevedo aceitou \"Casa do Marcos: projeto completo\" pelo link. Confirme para gerar o financeiro.", proposalId: "demo_marc_prop_3", offset: -2, read: true },
  ],
  tasks: [
    { id: "demo_marc_task_producao", title: "Conferir o corte das chapas do dormitório da Luísa", dueOffset: 0, done: false, clientId: "demo_marc_client_luisa", clientName: "Luísa Fernandes", proposalId: "demo_marc_prop_1", proposalTitle: "Apartamento Luísa: cozinha e dormitório" },
    { id: "demo_marc_task_amostras", title: "Levar amostras de MDF para a Construtora Alvorada", dueOffset: 2, done: false, leadId: "demo_marc_lead_construtora", leadName: "Construtora Alvorada" },
  ],
  fieldService: {
    equipment: [
      { id: "demo_marc_equip_cozinha", clientId: "demo_marc_client_luisa", name: "Cozinha planejada", type: "Cozinha planejada", brand: "Nogueira", model: "Aéreo e inferior em MDF", location: "Cozinha", installedDaysAgo: 170, warrantyMonths: 24 },
      { id: "demo_marc_equip_guarda", clientId: "demo_marc_client_luisa", name: "Guarda-roupa do casal", type: "Guarda-roupa", brand: "Nogueira", model: "Portas de correr", location: "Dormitório", installedDaysAgo: 170, warrantyMonths: 24 },
      { id: "demo_marc_equip_painel", clientId: "demo_marc_client_marcos", name: "Painel da TV", type: "Painel", brand: "Nogueira", model: "Ripado Freijó", location: "Sala", installedDaysAgo: 300, warrantyMonths: 12 },
    ],
    orders: [
      {
        id: "demo_marc_os_1",
        number: 1,
        clientId: "demo_marc_client_luisa",
        type: "corrective",
        priority: "normal",
        status: "completed",
        title: "Porta do aéreo desalinhada",
        description: "Duas portas do armário aéreo da cozinha não fecham alinhadas.",
        equipmentIds: ["demo_marc_equip_cozinha"],
        schedule: { dayOffset: -6, hour: 10, durationMin: 60 },
        checklist: [{ text: "Regular portas e dobradiças", done: true }, { text: "Lubrificar as ferragens", done: true }],
        items: [{ kind: "product", refId: P.ferragens, quantity: 1 }, { kind: "service", refId: "demo_marc_svc_montagem", quantity: 1 }],
        report: "Dobradiças reguladas e uma trocada por amortecida. Portas alinhadas e testadas com a cliente.",
        signedBy: "Luísa Fernandes",
        createdDaysAgo: 8,
      },
      {
        id: "demo_marc_os_2",
        number: 2,
        clientId: "demo_marc_client_luisa",
        type: "preventive",
        priority: "low",
        status: "scheduled",
        title: "Revisão de 6 meses do guarda-roupa",
        description: "Revisão prevista na entrega do projeto.",
        equipmentIds: ["demo_marc_equip_guarda"],
        schedule: { dayOffset: 5, hour: 9, durationMin: 60 },
        checklist: [{ text: "Regular portas e dobradiças", done: false }, { text: "Ajustar as corrediças das gavetas", done: false }, { text: "Verificar a fixação na parede", done: false }],
        items: [{ kind: "service", refId: "demo_marc_svc_montagem", quantity: 1 }],
        createdDaysAgo: 4,
      },
      {
        id: "demo_marc_os_3",
        number: 3,
        clientId: "demo_marc_client_marcos",
        type: "corrective",
        priority: "high",
        status: "open",
        title: "Fita de borda descolando no painel",
        description: "A fita de borda do painel da TV soltou perto da tomada.",
        equipmentIds: ["demo_marc_equip_painel"],
        checklist: [],
        items: [],
        createdDaysAgo: 0,
      },
    ],
    contracts: [
      { id: "demo_marc_ct_painel", number: 1, clientId: "demo_marc_client_marcos", title: "Manutenção dos móveis planejados", type: "maintenance", lines: [{ refId: "demo_marc_svc_montagem", quantity: 1, unitPrice: 80 }], billingDay: 10, equipmentIds: ["demo_marc_equip_painel"], visitIntervalMonths: 6, visitChecklist: ["Regular portas e dobradiças", "Conferir corrediças das gavetas", "Reapertar a fixação dos módulos"] },
    ],
  },
};
