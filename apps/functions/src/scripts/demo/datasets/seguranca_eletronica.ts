import { NICHE_REGISTRY } from "../../../shared/niches";
import type { DemoDataset } from "../types";

/**
 * Demonstração de segurança eletrônica: catálogo por unidade, áreas, sistemas
 * (kits de CFTV, alarme e acesso) e a mensalidade de manutenção como
 * recorrência no financeiro, que é como o nicho cobra depois da instalação.
 */
const P = {
  camera: "demo_seg_prod_camera",
  nvr: "demo_seg_prod_nvr",
  sensor: "demo_seg_prod_sensor",
  central: "demo_seg_prod_central",
  leitor: "demo_seg_prod_leitor",
} as const;

const A = {
  perimetro: "demo_seg_amb_perimetro",
  portaria: "demo_seg_amb_portaria",
  interno: "demo_seg_amb_interno",
} as const;

const S = {
  cftv: "demo_seg_sys_cftv",
  alarme: "demo_seg_sys_alarme",
  acesso: "demo_seg_sys_acesso",
} as const;

export const segurancaEletronicaDemo: DemoDataset = {
  niche: "seguranca_eletronica",
  tenantId: NICHE_REGISTRY.seguranca_eletronica.demoTenantId,
  tenant: { slug: "proops-demo-seguranca", primaryColor: "#dc2626" },
  optionIdPrefix: "demo_seg",
  products: [
    { id: P.camera, name: "Câmera Bullet Full HD 2MP", description: "Câmera externa com infravermelho de 30 m e proteção IP67.", price: 260, markup: 60, category: "CFTV", manufacturer: "VisionTec", inventoryValue: 48 },
    { id: P.nvr, name: "Gravador NVR 8 Canais", description: "Gravador de rede com HD de 2 TB e acesso remoto pelo aplicativo.", price: 980, markup: 45, category: "CFTV", manufacturer: "VisionTec", inventoryValue: 10 },
    { id: P.sensor, name: "Sensor de Presença Infravermelho", description: "Sensor sem fio com imunidade a animais de até 20 kg.", price: 95, markup: 70, category: "Alarme", manufacturer: "AlarmPro", inventoryValue: 60 },
    { id: P.central, name: "Central de Alarme Monitorável", description: "Central com comunicador 4G e Ethernet, pronta para monitoramento.", price: 720, markup: 50, category: "Alarme", manufacturer: "AlarmPro", inventoryValue: 12 },
    { id: P.leitor, name: "Leitor Facial com Senha", description: "Controle de acesso por reconhecimento facial, senha e cartão.", price: 1350, markup: 40, category: "Controle de Acesso", manufacturer: "AccessOne", inventoryValue: 8 },
  ],
  services: [
    { id: "demo_seg_svc_instalacao", name: "Instalação e Cabeamento", description: "Passagem de cabos, fixação dos equipamentos e testes de cada ponto.", price: 1200, category: "Instalação" },
    { id: "demo_seg_svc_config", name: "Configuração e Acesso Remoto", description: "Configuração da gravação, das zonas e do aplicativo no celular do cliente.", price: 450, category: "Configuração" },
    { id: "demo_seg_svc_manutencao", name: "Manutenção Mensal", description: "Visita preventiva mensal e atendimento prioritário.", price: 290, category: "Manutenção" },
  ],
  clients: [
    { id: "demo_seg_client_condominio", name: "Condomínio Vila Verde", email: "sindico.demo@vilaverde.com", phone: "1133332001" },
    { id: "demo_seg_client_lucas", name: "Lucas Andrade", email: "lucas.demo@exemplo.com", phone: "11999992002" },
    { id: "demo_seg_client_loja", name: "Loja Bela Moda", email: "contato.demo@belamoda.com", phone: "1133332003" },
  ],
  ambientes: [
    { id: A.perimetro, name: "Perímetro", description: "Muros, portões e área externa.", icon: "🧱", order: 1, lines: [{ productId: P.camera, quantity: 4 }] },
    { id: A.portaria, name: "Portaria", description: "Entrada de pessoas e veículos.", icon: "🚪", order: 2, lines: [{ productId: P.camera, quantity: 2 }, { productId: P.leitor, quantity: 1 }] },
    { id: A.interno, name: "Área Interna", description: "Corredores, salão e depósito.", icon: "🏢", order: 3, lines: [{ productId: P.sensor, quantity: 6 }, { productId: P.central, quantity: 1 }] },
  ],
  sistemas: [
    {
      id: S.cftv,
      name: "CFTV 8 Câmeras",
      description: "Oito câmeras com gravador e acesso remoto pelo celular.",
      icon: "📹",
      ambientes: [
        { ambienteId: A.perimetro, lines: [{ productId: P.camera, quantity: 6 }, { productId: P.nvr, quantity: 1 }] },
        { ambienteId: A.portaria, lines: [{ productId: P.camera, quantity: 2 }] },
      ],
    },
    {
      id: S.alarme,
      name: "Alarme Monitorado",
      description: "Central monitorável com sensores de presença nas áreas internas.",
      icon: "🚨",
      ambientes: [{ ambienteId: A.interno, lines: [{ productId: P.central, quantity: 1 }, { productId: P.sensor, quantity: 6 }] }],
    },
    {
      id: S.acesso,
      name: "Controle de Acesso",
      description: "Leitor facial na portaria com registro de entradas.",
      icon: "🔐",
      ambientes: [{ ambienteId: A.portaria, lines: [{ productId: P.leitor, quantity: 1 }] }],
    },
  ],
  proposals: {
    workflow: "system",
    items: [
      { id: "demo_seg_prop_1", title: "Condomínio Vila Verde: CFTV e acesso", status: "approved", clientId: "demo_seg_client_condominio", groupIds: [S.cftv, S.acesso], day: 10 },
      { id: "demo_seg_prop_2", title: "Residência Lucas: alarme monitorado", status: "sent", clientId: "demo_seg_client_lucas", groupIds: [S.alarme], day: 14 },
      { id: "demo_seg_prop_3", title: "Loja Bela Moda: CFTV", status: "sent", clientId: "demo_seg_client_loja", groupIds: [S.cftv], day: 18 },
    ],
  },
  finance: {
    wallets: [
      { id: "demo_seg_wallet_main", name: "Conta Principal", type: "bank", color: "#dc2626", icon: "Landmark", isDefault: true },
      { id: "demo_seg_wallet_cash", name: "Caixa", type: "cash", color: "#22c55e", icon: "Wallet", isDefault: false },
    ],
    categories: [
      { id: "demo_seg_cat_propostas", name: "Propostas", kind: "income", group: "revenue" },
      { id: "demo_seg_cat_manutencao", name: "Manutenção", kind: "income", group: "revenue" },
      { id: "demo_seg_cat_servicos", name: "Serviços", kind: "income", group: "revenue" },
      { id: "demo_seg_cat_fornecedores", name: "Fornecedores", kind: "expense", group: "cost" },
      { id: "demo_seg_cat_operacional", name: "Operacional", kind: "expense", group: "cost" },
      { id: "demo_seg_cat_impostos", name: "Impostos", kind: "expense", group: "deduction" },
    ],
    transactions: [
      { id: "demo_seg_txn_01", type: "income", description: "Condomínio Vila Verde: entrada da instalação", amount: 7200, status: "paid", walletId: "demo_seg_wallet_main", dateOffset: -9, dueOffset: -9, paid: true, clientName: "Condomínio Vila Verde", category: "Propostas" },
      { id: "demo_seg_txn_02", type: "income", description: "Condomínio Vila Verde: saldo na entrega", amount: 7200, status: "pending", walletId: "demo_seg_wallet_main", dateOffset: -9, dueOffset: 7, clientName: "Condomínio Vila Verde", category: "Propostas" },
      // Contrato de manutenção: a mensalidade recorrente, que é a receita do
      // nicho depois da instalação.
      { id: "demo_seg_txn_03", type: "income", description: "Manutenção mensal: Loja Bela Moda", amount: 290, status: "paid", walletId: "demo_seg_wallet_main", dateOffset: -30, dueOffset: -30, paid: true, clientName: "Loja Bela Moda", category: "Manutenção", recurringGroupId: "demo_seg_rec_manutencao" },
      { id: "demo_seg_txn_04", type: "income", description: "Manutenção mensal: Loja Bela Moda", amount: 290, status: "paid", walletId: "demo_seg_wallet_main", dateOffset: 0, dueOffset: 0, paid: true, clientName: "Loja Bela Moda", category: "Manutenção", recurringGroupId: "demo_seg_rec_manutencao" },
      { id: "demo_seg_txn_05", type: "income", description: "Manutenção mensal: Loja Bela Moda", amount: 290, status: "pending", walletId: "demo_seg_wallet_main", dateOffset: 30, dueOffset: 30, clientName: "Loja Bela Moda", category: "Manutenção", recurringGroupId: "demo_seg_rec_manutencao" },
      { id: "demo_seg_txn_06", type: "income", description: "Visita técnica avulsa", amount: 180, status: "overdue", walletId: "demo_seg_wallet_cash", dateOffset: -15, dueOffset: -5, clientName: "Lucas Andrade", category: "Serviços" },
      { id: "demo_seg_txn_07", type: "expense", description: "Compra de câmeras e gravador", amount: 3900, status: "paid", walletId: "demo_seg_wallet_main", dateOffset: -12, dueOffset: -12, paid: true, category: "Fornecedores" },
      { id: "demo_seg_txn_08", type: "expense", description: "Cabos e conectores", amount: 640, status: "paid", walletId: "demo_seg_wallet_cash", dateOffset: -6, dueOffset: -6, paid: true, category: "Fornecedores" },
      { id: "demo_seg_txn_09", type: "expense", description: "Técnico terceirizado: instalação", amount: 1100, status: "pending", walletId: "demo_seg_wallet_main", dateOffset: -2, dueOffset: 5, category: "Operacional" },
    ],
  },
  project: {
    proposalId: "demo_seg_prop_1",
    clientId: "demo_seg_client_condominio",
    startOffset: -9,
    dueOffset: 9,
    createdOffset: -9,
    stages: [
      { id: "demo_seg_stage_1", name: "Levantamento", status: "done", items: [["Mapear os pontos de câmera e sensores", true], ["Definir a rota dos cabos e a energia", true], ["Confirmar o local do gravador e da central", true]], completedOffset: -8 },
      { id: "demo_seg_stage_2", name: "Infraestrutura", status: "done", items: [["Passar tubulação e cabeamento", true], ["Montar o rack ou a caixa do gravador", true]], completedOffset: -4 },
      { id: "demo_seg_stage_3", name: "Instalação", status: "in_progress", items: [["Instalar câmeras, sensores e central", true], ["Instalar fechaduras, leitores e cerca, se houver", false]], completedOffset: null },
      { id: "demo_seg_stage_4", name: "Configuração", status: "pending", items: [["Configurar gravação e acesso remoto no aplicativo", false], ["Cadastrar zonas, usuários e biometrias", false], ["Testar cada ponto", false]], completedOffset: null },
      { id: "demo_seg_stage_5", name: "Entrega", status: "pending", items: [["Treinar o cliente", false], ["Entregar senhas e o termo de entrega", false], ["Registrar fotos finais", false]], completedOffset: null },
    ],
    visit: { eventId: "demo_seg_event_configuracao", stageId: "demo_seg_stage_4", dayOffset: 2, hours: 3, color: "#dc2626" },
  },
  leads: [
    { id: "demo_seg_lead_clinica", name: "Clínica Sorriso", company: "Clínica Sorriso", phone: "11988882001", source: "indicacao", stage: "novo", estimatedValue: 9800, nextAction: "Agendar a vistoria técnica", nextActionOffset: 1 },
    { id: "demo_seg_lead_galpao", name: "Galpão Logística Sul", company: "Logística Sul", phone: "11988882002", source: "google", stage: "contato", estimatedValue: 36000, nextAction: "Enviar proposta de CFTV com 16 câmeras", nextActionOffset: 2 },
    { id: "demo_seg_lead_residencia", name: "Paulo Martins", phone: "11988882003", source: "instagram", stage: "qualificado", estimatedValue: 14500, nextAction: "Apresentar alarme monitorado com cerca", nextActionOffset: 3 },
  ],
  activities: [
    { id: "demo_seg_activity_galpao_1", leadId: "demo_seg_lead_galpao", type: "ligacao", title: "Primeiro contato: quer cobrir as docas e o estacionamento", offset: -2 },
    { id: "demo_seg_activity_residencia_1", leadId: "demo_seg_lead_residencia", type: "reuniao", title: "Visita à residência para ver o muro e os acessos", offset: -3 },
  ],
  notifications: [
    { id: "demo_seg_notif_vista", type: "proposal_viewed", title: "Proposta visualizada", message: "Lucas Andrade abriu \"Residência Lucas: alarme monitorado\".", proposalId: "demo_seg_prop_2", offset: 0, read: false },
    { id: "demo_seg_notif_pago", type: "transaction_paid_online", title: "Pagamento recebido", message: "Pagamento via PIX confirmado para \"Manutenção mensal: Loja Bela Moda\".", transactionId: "demo_seg_txn_04", offset: 0, read: false },
    { id: "demo_seg_notif_aceite", type: "proposal_accepted", title: "Cliente aceitou a proposta", message: "Loja Bela Moda aceitou \"Loja Bela Moda: CFTV\" pelo link. Confirme para gerar o financeiro.", proposalId: "demo_seg_prop_3", offset: -2, read: true },
  ],
  tasks: [
    { id: "demo_seg_task_config", title: "Levar o notebook para configurar o gravador do condomínio", dueOffset: 2, done: false, clientId: "demo_seg_client_condominio", clientName: "Condomínio Vila Verde", proposalId: "demo_seg_prop_1", proposalTitle: "Condomínio Vila Verde: CFTV e acesso" },
    { id: "demo_seg_task_proposta", title: "Montar proposta de 16 câmeras para o galpão", dueOffset: 1, done: false, leadId: "demo_seg_lead_galpao", leadName: "Galpão Logística Sul" },
  ],
  format: {
    ambienteLineId: "byIndex",
    ambienteLinePricing: false,
    sistemaLineId: "byInstanceIndex",
    proposalLineId: "byProduct",
    pricing: { kind: "catalog" },
    totalInCents: true,
    writePrimaryFields: true,
  },
};
