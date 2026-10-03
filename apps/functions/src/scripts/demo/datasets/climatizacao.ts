import { NICHE_REGISTRY } from "../../../shared/niches";
import type { DemoDataset } from "../types";

/**
 * Demonstração de climatização e ar-condicionado: aparelho, suporte e kit por
 * unidade, tubulação e cabo pelo comprimento, e propostas por ambiente.
 */
const P = {
  split12: "demo_clim_prod_split12",
  split18: "demo_clim_prod_split18",
  cassete: "demo_clim_prod_cassete",
  tubulacao: "demo_clim_prod_tubulacao",
  cabo: "demo_clim_prod_cabo",
  suporte: "demo_clim_prod_suporte",
} as const;

const A = {
  sala: "demo_clim_amb_sala",
  suite: "demo_clim_amb_suite",
  escritorio: "demo_clim_amb_escritorio",
} as const;

export const climatizacaoDemo: DemoDataset = {
  niche: "climatizacao",
  tenantId: NICHE_REGISTRY.climatizacao.demoTenantId,
  tenant: { slug: "proops-demo-climatizacao", primaryColor: "#1e40af" },
  idPrefix: "demo_clim",
  products: [
    { id: P.split12, name: "Split Inverter 12.000 BTUs", description: "Hi-wall inverter, gás R-32, com controle remoto.", price: 1990, markup: 30, category: "Aparelhos", manufacturer: "Frioteck", inventoryValue: 8, pricingModel: { mode: "standard" } },
    { id: P.split18, name: "Split Inverter 18.000 BTUs", description: "Hi-wall inverter, gás R-32, para salas de até 30 m².", price: 2890, markup: 30, category: "Aparelhos", manufacturer: "Frioteck", inventoryValue: 5, pricingModel: { mode: "standard" } },
    { id: P.cassete, name: "Cassete 4 Vias 36.000 BTUs", description: "Aparelho de teto para ambiente comercial, com painel de 4 vias.", price: 7900, markup: 25, category: "Aparelhos", manufacturer: "Frioteck", inventoryValue: 2, pricingModel: { mode: "standard" } },
    { id: P.tubulacao, name: "Tubulação de Cobre com Isolamento", description: "Par de tubos de cobre com isolamento térmico, cobrado pelo comprimento.", price: 85, markup: 40, category: "Tubulação", manufacturer: "Cobre Norte", inventoryValue: 120, pricingModel: { mode: "curtain_width" } },
    { id: P.cabo, name: "Cabo PP de Interligação", description: "Cabo de interligação entre evaporadora e condensadora, cobrado pelo comprimento.", price: 12, markup: 50, category: "Elétrica", manufacturer: "Fios Sul", inventoryValue: 200, pricingModel: { mode: "curtain_width" } },
    { id: P.suporte, name: "Suporte para Condensadora", description: "Suporte de parede com calços antivibração.", price: 95, markup: 60, category: "Acessórios", manufacturer: "Metalfix", inventoryValue: 30, pricingModel: { mode: "standard" } },
  ],
  services: [
    { id: "demo_clim_svc_visita", name: "Visita Técnica", description: "Vistoria dos ambientes, da insolação e do ponto elétrico.", price: 150, category: "Visita" },
    { id: "demo_clim_svc_instalacao", name: "Instalação com Vácuo e Carga", description: "Instalação das unidades, vácuo na tubulação, carga de gás e testes.", price: 450, category: "Instalação" },
    { id: "demo_clim_svc_limpeza", name: "Higienização", description: "Limpeza de filtros, serpentina e bandeja, com bactericida.", price: 220, category: "Manutenção" },
    { id: "demo_clim_svc_pmoc", name: "Manutenção PMOC", description: "Visitas do plano de manutenção, operação e controle, com relatório e responsável técnico.", price: 890, category: "Manutenção" },
  ],
  clients: [
    { id: "demo_clim_client_fernanda", name: "Fernanda Lopes", email: "fernanda.demo@exemplo.com", phone: "11999994001" },
    { id: "demo_clim_client_gustavo", name: "Gustavo Pires", email: "gustavo.demo@exemplo.com", phone: "11999994002" },
    { id: "demo_clim_client_escritorio", name: "Escritório Contábil Andrade", email: "contato.demo@andradecontabil.com", phone: "1133334003" },
  ],
  ambientes: [
    {
      id: A.sala,
      name: "Sala",
      description: "Split de 18.000 BTUs com a condensadora na varanda.",
      icon: "🛋️",
      order: 1,
      lines: [
        { productId: P.split18, quantity: 1 },
        { productId: P.tubulacao, pricingDetails: { mode: "curtain_width", width: 6, panels: 1 } },
        { productId: P.cabo, pricingDetails: { mode: "curtain_width", width: 6, panels: 1 } },
        { productId: P.suporte, quantity: 1 },
      ],
    },
    {
      id: A.suite,
      name: "Suíte",
      description: "Split de 12.000 BTUs com tubulação curta.",
      icon: "🛏️",
      order: 2,
      lines: [
        { productId: P.split12, quantity: 1 },
        { productId: P.tubulacao, pricingDetails: { mode: "curtain_width", width: 4, panels: 1 } },
        { productId: P.cabo, pricingDetails: { mode: "curtain_width", width: 4, panels: 1 } },
        { productId: P.suporte, quantity: 1 },
      ],
    },
    {
      id: A.escritorio,
      name: "Escritório",
      description: "Cassete de teto para a sala de atendimento.",
      icon: "🏢",
      order: 3,
      lines: [
        { productId: P.cassete, quantity: 1 },
        { productId: P.tubulacao, pricingDetails: { mode: "curtain_width", width: 12, panels: 1 } },
        { productId: P.cabo, pricingDetails: { mode: "curtain_width", width: 12, panels: 1 } },
      ],
    },
  ],
  proposals: {
    workflow: "environment",
    items: [
      { id: "demo_clim_prop_1", title: "Casa da Fernanda: sala e suíte", status: "approved", clientId: "demo_clim_client_fernanda", groupIds: [A.sala, A.suite], day: 10 },
      { id: "demo_clim_prop_2", title: "Split da suíte master", status: "sent", clientId: "demo_clim_client_gustavo", groupIds: [A.suite], day: 14 },
      { id: "demo_clim_prop_3", title: "Escritório Contábil Andrade", status: "sent", clientId: "demo_clim_client_escritorio", groupIds: [A.escritorio, A.sala], day: 18 },
    ],
  },
  finance: {
    wallets: [
      { id: "demo_clim_wallet_main", name: "Conta Principal", type: "bank", color: "#1e40af", icon: "Landmark", isDefault: true },
      { id: "demo_clim_wallet_cash", name: "Caixa", type: "cash", color: "#22c55e", icon: "Wallet", isDefault: false },
    ],
    categories: [
      { id: "demo_clim_cat_propostas", name: "Propostas", kind: "income", group: "revenue" },
      { id: "demo_clim_cat_servicos_receita", name: "Serviços", kind: "income", group: "revenue" },
      { id: "demo_clim_cat_fornecedores", name: "Fornecedores", kind: "expense", group: "cost" },
      { id: "demo_clim_cat_operacional", name: "Operacional", kind: "expense", group: "cost" },
      { id: "demo_clim_cat_marketing", name: "Marketing", kind: "expense", group: "operating" },
      { id: "demo_clim_cat_impostos", name: "Impostos", kind: "expense", group: "deduction" },
    ],
    transactions: [
      { id: "demo_clim_txn_01", type: "income", description: "Casa da Fernanda: entrada", amount: 3600, status: "paid", walletId: "demo_clim_wallet_main", dateOffset: -9, dueOffset: -9, paid: true, clientName: "Fernanda Lopes", category: "Propostas" },
      { id: "demo_clim_txn_02", type: "income", description: "Casa da Fernanda: saldo na entrega", amount: 3700, status: "pending", walletId: "demo_clim_wallet_main", dateOffset: -9, dueOffset: 6, clientName: "Fernanda Lopes", category: "Propostas" },
      { id: "demo_clim_txn_03", type: "income", description: "Higienização avulsa", amount: 220, status: "paid", walletId: "demo_clim_wallet_cash", dateOffset: -4, dueOffset: -4, paid: true, clientName: "Gustavo Pires", category: "Serviços" },
      { id: "demo_clim_txn_04", type: "income", description: "Manutenção do escritório: parcela em atraso", amount: 980, status: "overdue", walletId: "demo_clim_wallet_main", dateOffset: -20, dueOffset: -6, clientName: "Escritório Contábil Andrade", category: "Serviços" },
      { id: "demo_clim_txn_05", type: "expense", description: "Aparelhos do lote do mês", amount: 9800, status: "paid", walletId: "demo_clim_wallet_main", dateOffset: -12, dueOffset: -12, paid: true, category: "Fornecedores" },
      { id: "demo_clim_txn_06", type: "expense", description: "Rolo de tubulação de cobre", amount: 1650, status: "pending", walletId: "demo_clim_wallet_main", dateOffset: -2, dueOffset: 10, category: "Fornecedores" },
      { id: "demo_clim_txn_07", type: "expense", description: "Gás R-32 e nitrogênio", amount: 540, status: "paid", walletId: "demo_clim_wallet_cash", dateOffset: -5, dueOffset: -5, paid: true, category: "Operacional" },
      { id: "demo_clim_txn_08", type: "expense", description: "Anúncios online", amount: 600, status: "paid", walletId: "demo_clim_wallet_cash", dateOffset: -11, dueOffset: -11, paid: true, category: "Marketing" },
    ],
  },
  project: {
    proposalId: "demo_clim_prop_1",
    clientId: "demo_clim_client_fernanda",
    startOffset: -9,
    dueOffset: 7,
    createdOffset: -9,
    stageProgress: [
      { status: "done", doneItems: 3, completedOffset: -8 },
      { status: "done", doneItems: 3, completedOffset: -3 },
      { status: "in_progress", doneItems: 1, completedOffset: null },
      { status: "pending", doneItems: 0, completedOffset: null },
      { status: "pending", doneItems: 0, completedOffset: null },
    ],
    visit: { eventId: "demo_clim_event_instalacao", stageIndex: 2, dayOffset: 2, hours: 4, color: "#1e40af" },
  },
  leads: [
    { id: "demo_clim_lead_patricia", name: "Patrícia Rocha", phone: "11988884001", source: "instagram", stage: "novo", estimatedValue: 5200, nextAction: "Agendar a visita técnica", nextActionOffset: 1 },
    { id: "demo_clim_lead_clinica", name: "Clínica Vida Plena", company: "Clínica Vida Plena", phone: "11988884002", source: "indicacao", stage: "contato", estimatedValue: 48000, nextAction: "Levantar a carga térmica das 8 salas", nextActionOffset: 2 },
    { id: "demo_clim_lead_arq", name: "Arq. Marina Castro", company: "Castro Arquitetura", phone: "11988884003", source: "arquiteto", stage: "qualificado", estimatedValue: 31000, nextAction: "Enviar proposta dos splits do apartamento", nextActionOffset: 3 },
  ],
  activities: [
    { id: "demo_clim_activity_clinica_1", leadId: "demo_clim_lead_clinica", type: "ligacao", title: "Primeiro contato: quer climatizar as salas de atendimento", offset: -2 },
    { id: "demo_clim_activity_arq_1", leadId: "demo_clim_lead_arq", type: "reuniao", title: "Reunião com a arquiteta sobre a posição das condensadoras", offset: -3 },
  ],
  notifications: [
    { id: "demo_clim_notif_vista", type: "proposal_viewed", title: "Proposta visualizada", message: "Gustavo Pires abriu \"Split da suíte master\".", proposalId: "demo_clim_prop_2", offset: 0, read: false },
    { id: "demo_clim_notif_pago", type: "transaction_paid_online", title: "Pagamento recebido", message: "Pagamento via PIX confirmado para \"Casa da Fernanda: entrada\".", transactionId: "demo_clim_txn_01", offset: -1, read: false },
    { id: "demo_clim_notif_aceite", type: "proposal_accepted", title: "Cliente aceitou a proposta", message: "Escritório Contábil Andrade aceitou \"Escritório Contábil Andrade\" pelo link. Confirme para gerar o financeiro.", proposalId: "demo_clim_prop_3", offset: -2, read: true },
  ],
  tasks: [
    { id: "demo_clim_task_gas", title: "Separar o gás e a bomba de vácuo para a instalação da Fernanda", dueOffset: 0, done: false, clientId: "demo_clim_client_fernanda", clientName: "Fernanda Lopes", proposalId: "demo_clim_prop_1", proposalTitle: "Casa da Fernanda: sala e suíte" },
    { id: "demo_clim_task_visita", title: "Confirmar a visita técnica na Clínica Vida Plena", dueOffset: 2, done: false, leadId: "demo_clim_lead_clinica", leadName: "Clínica Vida Plena" },
  ],
  fieldService: {
    equipment: [
      { id: "demo_clim_equip_sala", clientId: "demo_clim_client_fernanda", name: "Split da sala", type: "Split hi-wall", brand: "Frioteck", model: "Inverter 18.000", serialNumber: "FT18-40291", capacity: "18.000 BTUs", location: "Sala", installedDaysAgo: 90, warrantyMonths: 12 },
      { id: "demo_clim_equip_suite", clientId: "demo_clim_client_fernanda", name: "Split da suíte", type: "Split hi-wall", brand: "Frioteck", model: "Inverter 12.000", serialNumber: "FT12-40318", capacity: "12.000 BTUs", location: "Suíte", installedDaysAgo: 90, warrantyMonths: 12 },
      { id: "demo_clim_equip_cassete", clientId: "demo_clim_client_escritorio", name: "Cassete do atendimento", type: "Cassete", brand: "Frioteck", model: "4 Vias 36.000", serialNumber: "FC36-10077", capacity: "36.000 BTUs", location: "Sala de atendimento", installedDaysAgo: 400, warrantyMonths: 12 },
      { id: "demo_clim_equip_reuniao", clientId: "demo_clim_client_escritorio", name: "Split da sala de reunião", type: "Split hi-wall", brand: "Frioteck", model: "Inverter 24.000", serialNumber: "FT24-10102", capacity: "24.000 BTUs", location: "Sala de reunião", installedDaysAgo: 400, warrantyMonths: 12 },
      { id: "demo_clim_equip_diretoria", clientId: "demo_clim_client_escritorio", name: "Split da diretoria", type: "Split hi-wall", brand: "Frioteck", model: "Inverter 12.000", serialNumber: "FT12-10113", capacity: "12.000 BTUs", location: "Diretoria", installedDaysAgo: 400, warrantyMonths: 12 },
    ],
    orders: [
      {
        id: "demo_clim_os_1",
        number: 1,
        clientId: "demo_clim_client_escritorio",
        type: "corrective",
        priority: "urgent",
        status: "completed",
        title: "Cassete pingando água no atendimento",
        description: "O aparelho goteja sobre a mesa da recepção desde segunda.",
        equipmentIds: ["demo_clim_equip_cassete"],
        schedule: { dayOffset: -2, hour: 8, durationMin: 120 },
        checklist: [{ text: "Verificar o dreno", done: true }, { text: "Higienizar evaporadora e bandeja", done: true }, { text: "Limpar os filtros de ar", done: true }],
        items: [{ kind: "service", refId: "demo_clim_svc_limpeza", quantity: 1 }, { kind: "product", refId: P.tubulacao, quantity: 2 }],
        report: "Dreno entupido e bandeja com lodo. Dreno desobstruído, bandeja higienizada e 2 m de tubulação trocados. Sem gotejamento depois de uma hora ligado.",
        signedBy: "Renata Andrade",
        createdDaysAgo: 3,
      },
      {
        id: "demo_clim_os_2",
        number: 2,
        clientId: "demo_clim_client_fernanda",
        type: "preventive",
        priority: "normal",
        status: "scheduled",
        title: "Limpeza semestral dos splits",
        description: "Higienização dos dois aparelhos da casa.",
        equipmentIds: ["demo_clim_equip_sala", "demo_clim_equip_suite"],
        schedule: { dayOffset: 3, hour: 9, durationMin: 180 },
        checklist: [{ text: "Limpar os filtros de ar", done: false }, { text: "Higienizar evaporadora e bandeja", done: false }, { text: "Limpar a condensadora", done: false }, { text: "Verificar o dreno", done: false }, { text: "Medir pressão e temperatura de insuflamento", done: false }],
        items: [{ kind: "service", refId: "demo_clim_svc_limpeza", quantity: 2 }],
        createdDaysAgo: 6,
      },
      {
        id: "demo_clim_os_3",
        number: 3,
        clientId: "demo_clim_client_fernanda",
        type: "corrective",
        priority: "high",
        status: "open",
        title: "Split da suíte não gela",
        description: "O aparelho liga, mas só sai ar em temperatura ambiente.",
        equipmentIds: ["demo_clim_equip_suite"],
        checklist: [],
        items: [],
        createdDaysAgo: 0,
      },
    ],
    contracts: [
      {
        id: "demo_clim_ct_escritorio",
        number: 1,
        clientId: "demo_clim_client_escritorio",
        title: "PMOC do escritório",
        type: "pmoc",
        lines: [{ refId: "demo_clim_svc_pmoc", quantity: 1, unitPrice: 890 }],
        billingDay: 15,
        equipmentIds: ["demo_clim_equip_cassete", "demo_clim_equip_reuniao", "demo_clim_equip_diretoria"],
        visitIntervalMonths: 1,
        visitChecklist: [],
        pmoc: {
          responsibleId: "demo_clim_rt_carla",
          building: { name: "Escritório Contábil Andrade", occupants: 28, climatizedArea: 210, use: "Escritório" },
          visitsDone: 2,
          signedBy: "Renata Andrade",
        },
      },
    ],
    technicalResponsibles: [
      {
        id: "demo_clim_rt_carla",
        name: "Carla Mendes",
        profession: "Engenheira mecânica",
        council: "CREA",
        registryNumber: "SP-5061234567",
        artNumber: "28027230210987654",
        artValidMonths: 8,
      },
    ],
  },
};
