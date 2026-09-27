import { NICHE_REGISTRY } from "../../../shared/niches";
import type { DemoDataset } from "../types";

/**
 * Demonstração de automação residencial: catálogo por unidade, ambientes com
 * os produtos padrão e soluções (sistemas) agrupando ambientes.
 */
const P = {
  central: "demo_prod_central",
  sensor: "demo_prod_sensor",
  lock: "demo_prod_lock",
  speaker: "demo_prod_speaker",
} as const;

const A = {
  sala: "demo_amb_sala",
  entrada: "demo_amb_entrada",
  comuns: "demo_amb_comuns",
} as const;

const S = {
  residencial: "demo_sys_residencial",
  seguranca: "demo_sys_seguranca",
  audio: "demo_sys_audio",
} as const;

export const automacaoResidencialDemo: DemoDataset = {
  niche: "automacao_residencial",
  tenantId: NICHE_REGISTRY.automacao_residencial.demoTenantId,
  tenant: { slug: "proops-demo", primaryColor: "#4f46e5" },
  idPrefix: "demo",
  products: [
    { id: P.central, name: "Central de Automação Smart Hub", description: "Controlador central para integrar iluminação, climatização e segurança.", price: 2490, markup: 30, category: "Automação", manufacturer: "SmartHome", inventoryValue: 12 },
    { id: P.sensor, name: "Sensor de Presença Wireless", description: "Sensor de movimento sem fio com alcance de 8 metros.", price: 189, markup: 30, category: "Sensores", manufacturer: "SensorTech", inventoryValue: 60 },
    { id: P.lock, name: "Fechadura Digital Biométrica", description: "Fechadura com leitor de digital, senha e desbloqueio por app.", price: 1290, markup: 30, category: "Segurança", manufacturer: "SecureLock", inventoryValue: 20 },
    { id: P.speaker, name: "Caixa de Som Embutida", description: "Alto-falante de teto para som ambiente multizona.", price: 640, markup: 30, category: "Áudio", manufacturer: "AudioPro", inventoryValue: 35 },
  ],
  services: [
    { id: "demo_svc_install", name: "Instalação e Comissionamento", description: "Instalação completa dos equipamentos e testes de comissionamento.", price: 850, category: "Instalação" },
    { id: "demo_svc_config", name: "Configuração de Cenários", description: "Programação de cenas e automações personalizadas por ambiente.", price: 420, category: "Configuração" },
    { id: "demo_svc_support", name: "Manutenção Anual", description: "Plano de manutenção preventiva com visitas trimestrais.", price: 1200, category: "Suporte" },
  ],
  clients: [
    { id: "demo_client_ana", name: "Ana Ribeiro", email: "ana.demo@exemplo.com", phone: "11999990001" },
    { id: "demo_client_bruno", name: "Bruno Carvalho", email: "bruno.demo@exemplo.com", phone: "11999990002" },
    { id: "demo_client_condo", name: "Condomínio Jardins", email: "contato.demo@jardins.com", phone: "1133330003" },
  ],
  ambientes: [
    { id: A.sala, name: "Sala de Estar", description: "Automação de iluminação, som e clima da sala principal.", icon: "🛋️", order: 1, lines: [{ productId: P.central, quantity: 1 }, { productId: P.speaker, quantity: 2 }] },
    { id: A.entrada, name: "Hall de Entrada", description: "Controle de acesso e segurança da entrada.", icon: "🚪", order: 2, lines: [{ productId: P.lock, quantity: 1 }, { productId: P.sensor, quantity: 2 }] },
    { id: A.comuns, name: "Áreas Comuns", description: "Som ambiente multizona nas áreas de convivência.", icon: "🔊", order: 3, lines: [{ productId: P.speaker, quantity: 4 }] },
  ],
  sistemas: [
    {
      id: S.residencial,
      name: "Automação Residencial Completa",
      description: "Solução integrada de iluminação, som, clima e segurança para a casa toda.",
      icon: "🏠",
      ambientes: [
        { ambienteId: A.sala, lines: [{ productId: P.central, quantity: 1 }, { productId: P.speaker, quantity: 2 }] },
        { ambienteId: A.entrada, lines: [{ productId: P.lock, quantity: 1 }, { productId: P.sensor, quantity: 2 }] },
      ],
    },
    {
      id: S.seguranca,
      name: "Segurança e Controle de Acesso",
      description: "Fechadura biométrica e sensores de presença para o perímetro.",
      icon: "🔒",
      ambientes: [{ ambienteId: A.entrada, lines: [{ productId: P.lock, quantity: 1 }, { productId: P.sensor, quantity: 3 }] }],
    },
    {
      id: S.audio,
      name: "Som Ambiente Multizona",
      description: "Áudio distribuído com controle por zona nas áreas comuns.",
      icon: "🎵",
      ambientes: [{ ambienteId: A.comuns, lines: [{ productId: P.speaker, quantity: 4 }] }],
    },
  ],
  proposals: {
    workflow: "system",
    items: [
      { id: "demo_prop_1", title: "Automação Residencial Completa", status: "approved", clientId: "demo_client_ana", groupIds: [S.residencial], day: 10 },
      { id: "demo_prop_2", title: "Segurança e Controle de Acesso", status: "sent", clientId: "demo_client_bruno", groupIds: [S.seguranca], day: 14 },
      { id: "demo_prop_3", title: "Som Ambiente Multizona", status: "sent", clientId: "demo_client_condo", groupIds: [S.audio], day: 18 },
    ],
  },
  finance: {
    wallets: [
      { id: "demo_wallet_main", name: "Conta Principal", type: "bank", color: "#4f46e5", icon: "Landmark", isDefault: true },
      { id: "demo_wallet_cash", name: "Caixa", type: "cash", color: "#22c55e", icon: "Wallet", isDefault: false },
    ],
    categories: [
      { id: "demo_cat_propostas", name: "Propostas", kind: "income", group: "revenue" },
      { id: "demo_cat_projetos", name: "Projetos", kind: "income", group: "revenue" },
      { id: "demo_cat_instalacao", name: "Instalação", kind: "income", group: "revenue" },
      { id: "demo_cat_manutencao", name: "Manutenção", kind: "income", group: "revenue" },
      { id: "demo_cat_fornecedores", name: "Fornecedores", kind: "expense", group: "cost" },
      { id: "demo_cat_operacional", name: "Operacional", kind: "expense", group: "cost" },
      { id: "demo_cat_marketing", name: "Marketing", kind: "expense", group: "operating" },
      { id: "demo_cat_servicos", name: "Serviços", kind: "expense", group: "operating" },
      { id: "demo_cat_impostos", name: "Impostos", kind: "expense", group: "deduction" },
    ],
    transactions: [
      { id: "demo_txn_01", type: "income", description: "Automação residencial: entrada do projeto", amount: 8500, status: "paid", walletId: "demo_wallet_main", dateOffset: -10, dueOffset: -10, paid: true, clientName: "Ana Paula Ribeiro", category: "Projetos" },
      { id: "demo_txn_02", type: "income", description: "Manutenção preventiva: contrato mensal", amount: 5000, status: "paid", walletId: "demo_wallet_cash", dateOffset: -4, dueOffset: -4, paid: true, clientName: "Carla Menezes", category: "Manutenção" },
      { id: "demo_txn_03", type: "income", description: "Cortinas motorizadas: instalação", amount: 12000, status: "paid", walletId: "demo_wallet_main", dateOffset: -25, dueOffset: -25, paid: true, clientName: "Bruno Carvalho", category: "Instalação" },
      { id: "demo_txn_04", type: "income", description: "Saldo do projeto de automação", amount: 9500, status: "pending", walletId: "demo_wallet_main", dateOffset: -2, dueOffset: 5, clientName: "Carla Menezes", category: "Projetos" },
      { id: "demo_txn_05", type: "income", description: "Parcela em atraso", amount: 4200, status: "overdue", walletId: "demo_wallet_main", dateOffset: -20, dueOffset: -8, clientName: "Bruno Carvalho", category: "Instalação" },
      { id: "demo_txn_06", type: "expense", description: "Compra de equipamentos KNX", amount: 3200, status: "paid", walletId: "demo_wallet_main", dateOffset: -8, dueOffset: -8, paid: true, category: "Fornecedores" },
      { id: "demo_txn_07", type: "expense", description: "Mão de obra: instalação", amount: 1500, status: "paid", walletId: "demo_wallet_cash", dateOffset: -3, dueOffset: -3, paid: true, category: "Operacional" },
      { id: "demo_txn_08", type: "expense", description: "Anúncios online", amount: 900, status: "paid", walletId: "demo_wallet_cash", dateOffset: -12, dueOffset: -12, paid: true, category: "Marketing" },
      { id: "demo_txn_09", type: "expense", description: "Lote de sensores de presença", amount: 2800, status: "pending", walletId: "demo_wallet_main", dateOffset: -1, dueOffset: 6, category: "Fornecedores" },
      { id: "demo_txn_10", type: "expense", description: "Assinatura de software de projeto", amount: 1800, status: "pending", walletId: "demo_wallet_main", dateOffset: -1, dueOffset: 18, category: "Serviços" },
      { id: "demo_txn_11", type: "income", description: "Automação Residência Ana: projeto (parcelado)", amount: 4000, status: "paid", walletId: "demo_wallet_main", dateOffset: -30, dueOffset: -30, paid: true, clientName: "Ana Paula Ribeiro", category: "Projetos", installment: { count: 3, number: 1, groupId: "demo_inst_income_1" } },
      { id: "demo_txn_12", type: "income", description: "Automação Residência Ana: projeto (parcelado)", amount: 4000, status: "pending", walletId: "demo_wallet_main", dateOffset: -30, dueOffset: 2, clientName: "Ana Paula Ribeiro", category: "Projetos", installment: { count: 3, number: 2, groupId: "demo_inst_income_1" } },
      { id: "demo_txn_13", type: "income", description: "Automação Residência Ana: projeto (parcelado)", amount: 4000, status: "pending", walletId: "demo_wallet_main", dateOffset: -30, dueOffset: 32, clientName: "Ana Paula Ribeiro", category: "Projetos", installment: { count: 3, number: 3, groupId: "demo_inst_income_1" } },
      { id: "demo_txn_14", type: "expense", description: "Compra de equipamentos: parcelado", amount: 1500, status: "paid", walletId: "demo_wallet_main", dateOffset: -25, dueOffset: -25, paid: true, category: "Fornecedores", installment: { count: 3, number: 1, groupId: "demo_inst_expense_1" } },
      { id: "demo_txn_15", type: "expense", description: "Compra de equipamentos: parcelado", amount: 1500, status: "pending", walletId: "demo_wallet_main", dateOffset: -25, dueOffset: 8, category: "Fornecedores", installment: { count: 3, number: 2, groupId: "demo_inst_expense_1" } },
      { id: "demo_txn_16", type: "expense", description: "Compra de equipamentos: parcelado", amount: 1500, status: "pending", walletId: "demo_wallet_main", dateOffset: -25, dueOffset: 38, category: "Fornecedores", installment: { count: 3, number: 3, groupId: "demo_inst_expense_1" } },
    ],
  },
  project: {
    proposalId: "demo_prop_1",
    clientId: "demo_client_ana",
    startOffset: -8,
    dueOffset: 12,
    createdOffset: -8,
    stageProgress: [
      { status: "done", doneItems: 3, completedOffset: -6 },
      { status: "in_progress", doneItems: 1, completedOffset: null },
      { status: "pending", doneItems: 0, completedOffset: null },
      { status: "pending", doneItems: 0, completedOffset: null },
    ],
    visit: { eventId: "demo_event_obra_configuracao", stageIndex: 2, dayOffset: 2, hours: 3, color: "#0891b2" },
  },
  leads: [
    { id: "demo_lead_carla", name: "Carla Mendes", phone: "11988880001", source: "instagram", stage: "novo", estimatedValue: 18000, nextAction: "Ligar para entender o projeto", nextActionOffset: 1 },
    { id: "demo_lead_diego", name: "Diego Sampaio", phone: "11988880002", source: "indicacao", stage: "contato", estimatedValue: 42000, nextAction: "Agendar visita técnica", nextActionOffset: 0 },
    { id: "demo_lead_studio", name: "Studio Arq Lima", company: "Studio Arq Lima", phone: "11988880003", source: "arquiteto", stage: "qualificado", estimatedValue: 95000, nextAction: "Enviar proposta da cobertura", nextActionOffset: 3 },
  ],
  activities: [
    { id: "demo_activity_diego_1", leadId: "demo_lead_diego", type: "ligacao", title: "Primeiro contato: quer automatizar iluminação e cortinas da sala", offset: -2, done: true },
    { id: "demo_activity_studio_1", leadId: "demo_lead_studio", type: "reuniao", title: "Reunião com a arquiteta sobre o projeto da cobertura", offset: -3, done: true },
  ],
  notifications: [
    { id: "demo_notif_aceite", type: "proposal_accepted", title: "Cliente aceitou a proposta", message: "Bruno Carvalho aceitou \"Segurança e Controle de Acesso\" pelo link. Confirme para gerar o financeiro.", proposalId: "demo_prop_2", offset: 0, read: false },
    { id: "demo_notif_pago", type: "transaction_paid_online", title: "Pagamento recebido", message: "Pagamento via PIX confirmado para \"Automação residencial: entrada do projeto\".", transactionId: "demo_txn_01", offset: -1, read: false },
    { id: "demo_notif_vista", type: "proposal_viewed", title: "Proposta visualizada", message: "Condomínio Jardins abriu \"Som Ambiente Multizona\".", proposalId: "demo_prop_3", offset: -1, read: false },
    { id: "demo_notif_entrega", type: "project_delivery_accepted", title: "Entrega aceita pelo cliente", message: "Ana Ribeiro aceitou a entrega da obra \"Automação Residencial Completa\".", projectId: "proposal_demo_prop_1", offset: -3, read: true },
  ],
  tasks: [
    { id: "demo_task_instalacao", title: "Confirmar a data da instalação com Ana Ribeiro", dueOffset: 0, done: false, clientId: "demo_client_ana", clientName: "Ana Ribeiro", proposalId: "demo_prop_1", proposalTitle: "Automação Residencial Completa" },
    { id: "demo_task_studio", title: "Montar proposta com cinema e climatização", dueOffset: 3, done: false, leadId: "demo_lead_studio", leadName: "Studio Arq Lima" },
    { id: "demo_task_fotos", title: "Enviar ao cliente as fotos da infraestrutura", dueOffset: -2, done: true, clientId: "demo_client_ana", clientName: "Ana Ribeiro" },
  ],
  // A atividade "tarefa" do lead virou a tarefa acima; num tenant já semeado
  // ela continuaria aparecendo duplicada no histórico do lead.
  legacyDeletes: ["activities/demo_activity_studio_2"],
};
