import { NICHE_REGISTRY } from "../../../shared/niches";
import type { DemoDataset } from "../types";

/**
 * Demonstração de persianas e toldos (id `cortinas`): catálogo por medida
 * (área, faixa de altura, largura) e por unidade, e propostas por ambiente.
 */
const P = {
  rolo: "demo_cort_prod_rolo",
  wave: "demo_cort_prod_wave",
  toldo: "demo_cort_prod_toldo",
  motor: "demo_cort_prod_motor",
} as const;

const A = {
  sala: "demo_cort_amb_sala",
  suite: "demo_cort_amb_suite",
  varanda: "demo_cort_amb_varanda",
} as const;

export const cortinasDemo: DemoDataset = {
  niche: "cortinas",
  tenantId: NICHE_REGISTRY.cortinas.demoTenantId,
  tenant: { slug: "proops-demo-persianas", primaryColor: "#b45309" },
  idPrefix: "demo_cort",
  products: [
    { id: P.rolo, name: "Persiana Rolô Blackout", description: "Tecido blackout em rolo, cobrado por metro quadrado do vão.", price: 180, markup: 60, category: "Persianas", manufacturer: "Tecidos Aurora", inventoryValue: 120, pricingModel: { mode: "curtain_meter" } },
    {
      id: P.wave,
      name: "Cortina Wave em Linho",
      description: "Cortina de trilho suíço com pregas wave, preço por largura na faixa de altura.",
      price: 0,
      markup: 0,
      category: "Cortinas",
      manufacturer: "Casa Linho",
      inventoryValue: 80,
      pricingModel: {
        mode: "curtain_height",
        tiers: [
          { id: "demo_cort_tier_26", maxHeight: 2.6, basePrice: 220, markup: 70 },
          { id: "demo_cort_tier_30", maxHeight: 3, basePrice: 260, markup: 70 },
          { id: "demo_cort_tier_35", maxHeight: 3.5, basePrice: 310, markup: 70 },
        ],
      },
    },
    { id: P.toldo, name: "Toldo Retrátil de Braço Articulado", description: "Lona acrílica com braços articulados, cobrado por metro de largura.", price: 650, markup: 55, category: "Toldos", manufacturer: "Sol & Sombra", inventoryValue: 30, pricingModel: { mode: "curtain_width" } },
    { id: P.motor, name: "Motor Tubular com Controle", description: "Motor silencioso com controle remoto e integração a assistentes de voz.", price: 890, markup: 40, category: "Motorização", manufacturer: "Somfy", inventoryValue: 25, pricingModel: { mode: "standard" } },
  ],
  services: [
    { id: "demo_cort_svc_medicao", name: "Medição Técnica", description: "Visita para medir vãos, conferir a alvenaria e o ponto elétrico.", price: 150, category: "Medição" },
    { id: "demo_cort_svc_instalacao", name: "Instalação e Regulagem", description: "Fixação de trilhos e suportes, instalação e regulagem do acionamento.", price: 380, category: "Instalação" },
  ],
  clients: [
    { id: "demo_cort_client_marina", name: "Marina Costa", email: "marina.demo@exemplo.com", phone: "11999991001" },
    { id: "demo_cort_client_rafael", name: "Rafael Nogueira", email: "rafael.demo@exemplo.com", phone: "11999991002" },
    { id: "demo_cort_client_studio", name: "Studio Casa Viva", email: "contato.demo@casaviva.com", phone: "1133331003", priceTableId: "demo_cort_price_table_parceiros" },
  ],
  // Tabela de exemplo: o ajuste sobre o catálogo e um preço próprio. O cliente
  // acima aponta para ela, e a aba de Produtos e o cadastro têm o que mostrar.
  priceTables: [
    {
      id: "demo_cort_price_table_parceiros",
      name: "Arquitetos e decoradores",
      adjustmentPercent: -10,
      productPrices: { [P.rolo]: 260 },
    },
  ],
  ambientes: [
    {
      id: A.sala,
      name: "Sala de Estar",
      description: "Cortina wave no janelão e motorização.",
      icon: "🛋️",
      order: 1,
      lines: [
        { productId: P.wave, pricingDetails: { mode: "curtain_height", width: 3.2, tierId: "demo_cort_tier_30", maxHeight: 3, panels: 2 } },
        { productId: P.motor, quantity: 1 },
      ],
    },
    {
      id: A.suite,
      name: "Suíte Principal",
      description: "Persiana blackout para dormir no escuro.",
      icon: "🛏️",
      order: 2,
      lines: [{ productId: P.rolo, pricingDetails: { mode: "curtain_meter", width: 1.8, height: 2.4, area: 0, panels: 2 } }],
    },
    {
      id: A.varanda,
      name: "Varanda Gourmet",
      description: "Toldo retrátil motorizado sobre a área da churrasqueira.",
      icon: "⛱️",
      order: 3,
      lines: [
        { productId: P.toldo, pricingDetails: { mode: "curtain_width", width: 4, panels: 1 } },
        { productId: P.motor, quantity: 1 },
      ],
    },
  ],
  proposals: {
    workflow: "environment",
    items: [
      { id: "demo_cort_prop_1", title: "Apartamento Marina: sala e suíte", status: "approved", clientId: "demo_cort_client_marina", groupIds: [A.sala, A.suite], day: 10 },
      { id: "demo_cort_prop_2", title: "Toldo da varanda gourmet", status: "sent", clientId: "demo_cort_client_rafael", groupIds: [A.varanda], day: 14 },
      { id: "demo_cort_prop_3", title: "Showroom Studio Casa Viva", status: "sent", clientId: "demo_cort_client_studio", groupIds: [A.sala, A.suite, A.varanda], day: 18 },
    ],
  },
  finance: {
    wallets: [
      { id: "demo_cort_wallet_main", name: "Conta Principal", type: "bank", color: "#b45309", icon: "Landmark", isDefault: true },
      { id: "demo_cort_wallet_cash", name: "Caixa", type: "cash", color: "#22c55e", icon: "Wallet", isDefault: false },
    ],
    categories: [
      { id: "demo_cort_cat_propostas", name: "Propostas", kind: "income", group: "revenue" },
      { id: "demo_cort_cat_servicos_receita", name: "Serviços", kind: "income", group: "revenue" },
      { id: "demo_cort_cat_fornecedores", name: "Fornecedores", kind: "expense", group: "cost" },
      { id: "demo_cort_cat_operacional", name: "Operacional", kind: "expense", group: "cost" },
      { id: "demo_cort_cat_marketing", name: "Marketing", kind: "expense", group: "operating" },
      { id: "demo_cort_cat_impostos", name: "Impostos", kind: "expense", group: "deduction" },
    ],
    transactions: [
      { id: "demo_cort_txn_01", type: "income", description: "Apartamento Marina: sinal", amount: 3800, status: "paid", walletId: "demo_cort_wallet_main", dateOffset: -9, dueOffset: -9, paid: true, clientName: "Marina Costa", category: "Propostas" },
      { id: "demo_cort_txn_02", type: "income", description: "Apartamento Marina: saldo na entrega", amount: 3900, status: "pending", walletId: "demo_cort_wallet_main", dateOffset: -9, dueOffset: 6, clientName: "Marina Costa", category: "Propostas" },
      { id: "demo_cort_txn_03", type: "income", description: "Medição técnica avulsa", amount: 150, status: "paid", walletId: "demo_cort_wallet_cash", dateOffset: -4, dueOffset: -4, paid: true, clientName: "Rafael Nogueira", category: "Serviços" },
      { id: "demo_cort_txn_04", type: "income", description: "Persianas do escritório: parcela em atraso", amount: 1600, status: "overdue", walletId: "demo_cort_wallet_main", dateOffset: -20, dueOffset: -6, clientName: "Studio Casa Viva", category: "Propostas" },
      { id: "demo_cort_txn_05", type: "expense", description: "Compra de tecidos blackout", amount: 2400, status: "paid", walletId: "demo_cort_wallet_main", dateOffset: -12, dueOffset: -12, paid: true, category: "Fornecedores" },
      { id: "demo_cort_txn_06", type: "expense", description: "Motores tubulares (lote)", amount: 3100, status: "pending", walletId: "demo_cort_wallet_main", dateOffset: -2, dueOffset: 10, category: "Fornecedores" },
      { id: "demo_cort_txn_07", type: "expense", description: "Costura e confecção terceirizada", amount: 950, status: "paid", walletId: "demo_cort_wallet_cash", dateOffset: -5, dueOffset: -5, paid: true, category: "Operacional" },
      { id: "demo_cort_txn_08", type: "expense", description: "Anúncios online", amount: 600, status: "paid", walletId: "demo_cort_wallet_cash", dateOffset: -11, dueOffset: -11, paid: true, category: "Marketing" },
    ],
  },
  project: {
    proposalId: "demo_cort_prop_1",
    clientId: "demo_cort_client_marina",
    startOffset: -9,
    dueOffset: 10,
    createdOffset: -9,
    stageProgress: [
      { status: "done", doneItems: 3, completedOffset: -8 },
      { status: "in_progress", doneItems: 1, completedOffset: null },
      { status: "pending", doneItems: 0, completedOffset: null },
      { status: "pending", doneItems: 0, completedOffset: null },
    ],
    visit: { eventId: "demo_cort_event_instalacao", stageIndex: 2, dayOffset: 3, hours: 2, color: "#b45309" },
    itemStatuses: ["in_stock", "installed", "purchase_requested"],
  },
  leads: [
    { id: "demo_cort_lead_helena", name: "Helena Prado", phone: "11988881001", source: "instagram", stage: "novo", estimatedValue: 6500, nextAction: "Agendar a medição", nextActionOffset: 1 },
    { id: "demo_cort_lead_pousada", name: "Pousada Vento Sul", company: "Pousada Vento Sul", phone: "11988881002", source: "indicacao", stage: "contato", estimatedValue: 28000, nextAction: "Levar amostras de lona para os toldos", nextActionOffset: 2 },
    { id: "demo_cort_lead_arq", name: "Arq. Beatriz Lemos", company: "Lemos Arquitetura", phone: "11988881003", source: "arquiteto", stage: "qualificado", estimatedValue: 41000, nextAction: "Enviar proposta da cobertura", nextActionOffset: 3 },
  ],
  activities: [
    { id: "demo_cort_activity_pousada_1", leadId: "demo_cort_lead_pousada", type: "ligacao", title: "Primeiro contato: quer toldos nas seis varandas", offset: -2 },
    { id: "demo_cort_activity_arq_1", leadId: "demo_cort_lead_arq", type: "reuniao", title: "Reunião com a arquiteta sobre as persianas da cobertura", offset: -3 },
  ],
  notifications: [
    { id: "demo_cort_notif_vista", type: "proposal_viewed", title: "Proposta visualizada", message: "Rafael Nogueira abriu \"Toldo da varanda gourmet\".", proposalId: "demo_cort_prop_2", offset: 0, read: false },
    { id: "demo_cort_notif_pago", type: "transaction_paid_online", title: "Pagamento recebido", message: "Pagamento via PIX confirmado para \"Apartamento Marina: sinal\".", transactionId: "demo_cort_txn_01", offset: -1, read: false },
    { id: "demo_cort_notif_aceite", type: "proposal_accepted", title: "Cliente aceitou a proposta", message: "Studio Casa Viva aceitou \"Showroom Studio Casa Viva\" pelo link. Confirme para gerar o financeiro.", proposalId: "demo_cort_prop_3", offset: -2, read: true },
  ],
  tasks: [
    { id: "demo_cort_task_pedido", title: "Conferir a chegada dos motores do pedido da Marina", dueOffset: 0, done: false, clientId: "demo_cort_client_marina", clientName: "Marina Costa", proposalId: "demo_cort_prop_1", proposalTitle: "Apartamento Marina: sala e suíte" },
    { id: "demo_cort_task_amostras", title: "Separar amostras de lona para a Pousada Vento Sul", dueOffset: 2, done: false, leadId: "demo_cort_lead_pousada", leadName: "Pousada Vento Sul" },
  ],
  fieldService: {
    equipment: [
      { id: "demo_cort_equip_rolo", clientId: "demo_cort_client_marina", name: "Persiana rolô da suíte", type: "Persiana", brand: "Ateliê", model: "Rolô Blackout", location: "Suíte", installedDaysAgo: 150, warrantyMonths: 12 },
      { id: "demo_cort_equip_motor", clientId: "demo_cort_client_marina", name: "Motor da cortina da sala", type: "Motor", brand: "Somfy", model: "Sonesse 30", serialNumber: "SN30-55812", location: "Sala", installedDaysAgo: 150, warrantyMonths: 24 },
      { id: "demo_cort_equip_toldo", clientId: "demo_cort_client_rafael", name: "Toldo da varanda", type: "Toldo", brand: "Ateliê", model: "Braço Articulado", location: "Varanda", installedDaysAgo: 380, warrantyMonths: 12 },
    ],
    orders: [
      {
        id: "demo_cort_os_1",
        number: 1,
        clientId: "demo_cort_client_marina",
        type: "corrective",
        priority: "high",
        status: "completed",
        title: "Cortina da sala para no meio do curso",
        description: "O motor liga, mas a cortina para antes de fechar por completo.",
        equipmentIds: ["demo_cort_equip_motor"],
        schedule: { dayOffset: -4, hour: 10, durationMin: 60 },
        checklist: [{ text: "Testar abertura e fechamento", done: true }, { text: "Verificar motor e fim de curso", done: true }, { text: "Testar o controle remoto", done: true }],
        items: [{ kind: "service", refId: "demo_cort_svc_instalacao", quantity: 1 }],
        report: "Fim de curso reprogramado. O trilho estava com um suporte solto, que foi refixado. Abertura e fechamento testados com a cliente.",
        signedBy: "Marina Costa",
        createdDaysAgo: 6,
      },
      {
        id: "demo_cort_os_2",
        number: 2,
        clientId: "demo_cort_client_rafael",
        type: "preventive",
        priority: "normal",
        status: "scheduled",
        title: "Revisão do toldo antes do verão",
        description: "Limpeza da lona e regulagem dos braços.",
        equipmentIds: ["demo_cort_equip_toldo"],
        schedule: { dayOffset: 3, hour: 9, durationMin: 90 },
        checklist: [{ text: "Testar abertura e fechamento", done: false }, { text: "Lubrificar trilhos e mecanismo", done: false }, { text: "Conferir tecido e costuras", done: false }],
        items: [{ kind: "service", refId: "demo_cort_svc_instalacao", quantity: 1 }],
        createdDaysAgo: 8,
      },
      {
        id: "demo_cort_os_3",
        number: 3,
        clientId: "demo_cort_client_marina",
        type: "corrective",
        priority: "normal",
        status: "open",
        title: "Persiana da suíte enrolando torta",
        description: "A persiana desce inclinada para um dos lados.",
        equipmentIds: ["demo_cort_equip_rolo"],
        checklist: [],
        items: [],
        createdDaysAgo: 1,
      },
    ],
    contracts: [
      { id: "demo_cort_ct_toldo", number: 1, clientId: "demo_cort_client_rafael", title: "Manutenção anual do toldo", type: "maintenance", lines: [{ refId: "demo_cort_svc_instalacao", quantity: 1, unitPrice: 45 }], billingDay: 20, equipmentIds: ["demo_cort_equip_toldo"], visitIntervalMonths: 12, visitChecklist: ["Lubrificar os braços e o tubo", "Regular o motor e os fins de curso", "Conferir a lona e as costuras"] },
    ],
  },
};
