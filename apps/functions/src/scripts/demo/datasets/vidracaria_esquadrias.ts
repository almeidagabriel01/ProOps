import { NICHE_REGISTRY } from "../../../shared/niches";
import type { DemoDataset } from "../types";

/**
 * Demonstração de vidraçaria e esquadrias: vidro e esquadria por m², perfil
 * por metro linear, kit e acessório por unidade, e propostas por ambiente.
 */
const P = {
  temperado: "demo_vid_prod_temperado",
  espelho: "demo_vid_prod_espelho",
  janela: "demo_vid_prod_janela",
  perfil: "demo_vid_prod_perfil",
  kitBox: "demo_vid_prod_kit_box",
} as const;

const A = {
  banheiro: "demo_vid_amb_banheiro",
  sacada: "demo_vid_amb_sacada",
  fachada: "demo_vid_amb_fachada",
} as const;

export const vidracariaEsquadriasDemo: DemoDataset = {
  niche: "vidracaria_esquadrias",
  tenantId: NICHE_REGISTRY.vidracaria_esquadrias.demoTenantId,
  tenant: { slug: "proops-demo-vidracaria", primaryColor: "#0e7490" },
  idPrefix: "demo_vid",
  products: [
    { id: P.temperado, name: "Vidro Temperado Incolor 8 mm", description: "Vidro temperado para box, sacada e fechamento, cobrado por metro quadrado do vão.", price: 210, markup: 60, category: "Vidros", manufacturer: "Têmpera Litoral", inventoryValue: 90, pricingModel: { mode: "curtain_meter" } },
    { id: P.espelho, name: "Espelho Prata 4 mm Lapidado", description: "Espelho com borda lapidada, cobrado por metro quadrado.", price: 140, markup: 70, category: "Espelhos", manufacturer: "Têmpera Litoral", inventoryValue: 40, pricingModel: { mode: "curtain_meter" } },
    { id: P.janela, name: "Janela de Correr em Alumínio Branco", description: "Esquadria de alumínio com duas folhas de correr e vidro liso, cobrada por metro quadrado.", price: 520, markup: 45, category: "Esquadrias", manufacturer: "Alumínio Serra", inventoryValue: 25, pricingModel: { mode: "curtain_meter" } },
    { id: P.perfil, name: "Perfil de Alumínio para Sacada", description: "Trilho superior e inferior do envidraçamento de sacada, cobrado por metro linear.", price: 320, markup: 50, category: "Esquadrias", manufacturer: "Alumínio Serra", inventoryValue: 60, pricingModel: { mode: "curtain_width" } },
    { id: P.kitBox, name: "Kit Box de Correr em Inox", description: "Roldanas, trilho, puxador e vedação para um box de correr.", price: 380, markup: 45, category: "Kits e acessórios", manufacturer: "Metais Vitória", inventoryValue: 12, pricingModel: { mode: "standard" } },
  ],
  services: [
    { id: "demo_vid_svc_medicao", name: "Medição no Local", description: "Visita para medir os vãos e conferir prumo, nível e esquadro.", price: 120, category: "Medição" },
    { id: "demo_vid_svc_instalacao", name: "Instalação e Vedação", description: "Instalação de vidros e esquadrias, vedação com silicone e regulagem.", price: 350, category: "Instalação" },
  ],
  clients: [
    { id: "demo_vid_client_paula", name: "Paula Andrade", email: "paula.demo@exemplo.com", phone: "11999992001" },
    { id: "demo_vid_client_eduardo", name: "Eduardo Ribeiro", email: "eduardo.demo@exemplo.com", phone: "11999992002" },
    { id: "demo_vid_client_clinica", name: "Clínica Sorriso", email: "contato.demo@clinicasorriso.com", phone: "1133332003" },
  ],
  ambientes: [
    {
      id: A.banheiro,
      name: "Banheiro Social",
      description: "Box de correr em vidro temperado e espelho sobre a bancada.",
      icon: "🚿",
      order: 1,
      lines: [
        { productId: P.temperado, pricingDetails: { mode: "curtain_meter", width: 1.2, height: 1.9, area: 0, panels: 1 } },
        { productId: P.kitBox, quantity: 1 },
        { productId: P.espelho, pricingDetails: { mode: "curtain_meter", width: 1, height: 0.8, area: 0, panels: 1 } },
      ],
    },
    {
      id: A.sacada,
      name: "Sacada",
      description: "Envidraçamento de sacada com folhas de correr.",
      icon: "🏙️",
      order: 2,
      lines: [
        { productId: P.temperado, pricingDetails: { mode: "curtain_meter", width: 4.5, height: 1.3, area: 0, panels: 1 } },
        { productId: P.perfil, pricingDetails: { mode: "curtain_width", width: 4.5, panels: 1 } },
      ],
    },
    {
      id: A.fachada,
      name: "Fachada",
      description: "Janelas de correr em alumínio na fachada comercial.",
      icon: "🏢",
      order: 3,
      lines: [{ productId: P.janela, pricingDetails: { mode: "curtain_meter", width: 3, height: 1.5, area: 0, panels: 2 } }],
    },
  ],
  proposals: {
    workflow: "environment",
    items: [
      { id: "demo_vid_prop_1", title: "Apartamento Paula: banheiro e sacada", status: "approved", clientId: "demo_vid_client_paula", groupIds: [A.banheiro, A.sacada], day: 10 },
      { id: "demo_vid_prop_2", title: "Envidraçamento da sacada", status: "sent", clientId: "demo_vid_client_eduardo", groupIds: [A.sacada], day: 14 },
      { id: "demo_vid_prop_3", title: "Fachada da Clínica Sorriso", status: "sent", clientId: "demo_vid_client_clinica", groupIds: [A.fachada, A.banheiro], day: 18 },
    ],
  },
  finance: {
    wallets: [
      { id: "demo_vid_wallet_main", name: "Conta Principal", type: "bank", color: "#0e7490", icon: "Landmark", isDefault: true },
      { id: "demo_vid_wallet_cash", name: "Caixa", type: "cash", color: "#22c55e", icon: "Wallet", isDefault: false },
    ],
    categories: [
      { id: "demo_vid_cat_propostas", name: "Propostas", kind: "income", group: "revenue" },
      { id: "demo_vid_cat_servicos_receita", name: "Serviços", kind: "income", group: "revenue" },
      { id: "demo_vid_cat_fornecedores", name: "Fornecedores", kind: "expense", group: "cost" },
      { id: "demo_vid_cat_operacional", name: "Operacional", kind: "expense", group: "cost" },
      { id: "demo_vid_cat_marketing", name: "Marketing", kind: "expense", group: "operating" },
      { id: "demo_vid_cat_impostos", name: "Impostos", kind: "expense", group: "deduction" },
    ],
    transactions: [
      { id: "demo_vid_txn_01", type: "income", description: "Apartamento Paula: sinal", amount: 2200, status: "paid", walletId: "demo_vid_wallet_main", dateOffset: -9, dueOffset: -9, paid: true, clientName: "Paula Andrade", category: "Propostas" },
      { id: "demo_vid_txn_02", type: "income", description: "Apartamento Paula: saldo na instalação", amount: 2300, status: "pending", walletId: "demo_vid_wallet_main", dateOffset: -9, dueOffset: 6, clientName: "Paula Andrade", category: "Propostas" },
      { id: "demo_vid_txn_03", type: "income", description: "Medição avulsa", amount: 120, status: "paid", walletId: "demo_vid_wallet_cash", dateOffset: -4, dueOffset: -4, paid: true, clientName: "Eduardo Ribeiro", category: "Serviços" },
      { id: "demo_vid_txn_04", type: "income", description: "Espelhos da academia: parcela em atraso", amount: 1400, status: "overdue", walletId: "demo_vid_wallet_main", dateOffset: -20, dueOffset: -6, clientName: "Clínica Sorriso", category: "Propostas" },
      { id: "demo_vid_txn_05", type: "expense", description: "Têmpera dos vidros (lote da semana)", amount: 2600, status: "paid", walletId: "demo_vid_wallet_main", dateOffset: -12, dueOffset: -12, paid: true, category: "Fornecedores" },
      { id: "demo_vid_txn_06", type: "expense", description: "Perfis de alumínio", amount: 3400, status: "pending", walletId: "demo_vid_wallet_main", dateOffset: -2, dueOffset: 10, category: "Fornecedores" },
      { id: "demo_vid_txn_07", type: "expense", description: "Silicone, parafusos e ventosas", amount: 420, status: "paid", walletId: "demo_vid_wallet_cash", dateOffset: -5, dueOffset: -5, paid: true, category: "Operacional" },
      { id: "demo_vid_txn_08", type: "expense", description: "Anúncios online", amount: 600, status: "paid", walletId: "demo_vid_wallet_cash", dateOffset: -11, dueOffset: -11, paid: true, category: "Marketing" },
    ],
  },
  project: {
    proposalId: "demo_vid_prop_1",
    clientId: "demo_vid_client_paula",
    startOffset: -9,
    dueOffset: 10,
    createdOffset: -9,
    stageProgress: [
      { status: "done", doneItems: 3, completedOffset: -8 },
      { status: "in_progress", doneItems: 1, completedOffset: null },
      { status: "pending", doneItems: 0, completedOffset: null },
      { status: "pending", doneItems: 0, completedOffset: null },
    ],
    visit: { eventId: "demo_vid_event_instalacao", stageIndex: 2, dayOffset: 3, hours: 3, color: "#0e7490" },
  },
  leads: [
    { id: "demo_vid_lead_juliana", name: "Juliana Mota", phone: "11988882001", source: "instagram", stage: "novo", estimatedValue: 4800, nextAction: "Agendar a medição do box", nextActionOffset: 1 },
    { id: "demo_vid_lead_construtora", name: "Construtora Horizonte", company: "Construtora Horizonte", phone: "11988882002", source: "indicacao", stage: "contato", estimatedValue: 86000, nextAction: "Levantar os vãos das 24 sacadas", nextActionOffset: 2 },
    { id: "demo_vid_lead_arq", name: "Arq. Renato Salles", company: "Salles Arquitetura", phone: "11988882003", source: "arquiteto", stage: "qualificado", estimatedValue: 32000, nextAction: "Enviar proposta do guarda-corpo", nextActionOffset: 3 },
  ],
  activities: [
    { id: "demo_vid_activity_construtora_1", leadId: "demo_vid_lead_construtora", type: "ligacao", title: "Primeiro contato: quer orçamento para as sacadas do prédio novo", offset: -2 },
    { id: "demo_vid_activity_arq_1", leadId: "demo_vid_lead_arq", type: "reuniao", title: "Reunião com o arquiteto sobre o guarda-corpo da cobertura", offset: -3 },
  ],
  notifications: [
    { id: "demo_vid_notif_vista", type: "proposal_viewed", title: "Proposta visualizada", message: "Eduardo Ribeiro abriu \"Envidraçamento da sacada\".", proposalId: "demo_vid_prop_2", offset: 0, read: false },
    { id: "demo_vid_notif_pago", type: "transaction_paid_online", title: "Pagamento recebido", message: "Pagamento via PIX confirmado para \"Apartamento Paula: sinal\".", transactionId: "demo_vid_txn_01", offset: -1, read: false },
    { id: "demo_vid_notif_aceite", type: "proposal_accepted", title: "Cliente aceitou a proposta", message: "Clínica Sorriso aceitou \"Fachada da Clínica Sorriso\" pelo link. Confirme para gerar o financeiro.", proposalId: "demo_vid_prop_3", offset: -2, read: true },
  ],
  tasks: [
    { id: "demo_vid_task_tempera", title: "Buscar os vidros da Paula na têmpera", dueOffset: 0, done: false, clientId: "demo_vid_client_paula", clientName: "Paula Andrade", proposalId: "demo_vid_prop_1", proposalTitle: "Apartamento Paula: banheiro e sacada" },
    { id: "demo_vid_task_vaos", title: "Levar a trena a laser para a medição da Construtora Horizonte", dueOffset: 2, done: false, leadId: "demo_vid_lead_construtora", leadName: "Construtora Horizonte" },
  ],
  fieldService: {
    equipment: [
      { id: "demo_vid_equip_box", clientId: "demo_vid_client_paula", name: "Box do banheiro da suíte", type: "Box de banheiro", brand: "Cristal", model: "Box de correr em inox", location: "Banheiro da suíte", installedDaysAgo: 160, warrantyMonths: 12 },
      { id: "demo_vid_equip_sacada", clientId: "demo_vid_client_paula", name: "Envidraçamento da sacada", type: "Guarda-corpo", brand: "Cristal", model: "Sacada de correr 8 mm", location: "Sacada", installedDaysAgo: 160, warrantyMonths: 24 },
      { id: "demo_vid_equip_janela", clientId: "demo_vid_client_clinica", name: "Janelas da recepção", type: "Janela", brand: "Alumax", model: "Correr 2 folhas", location: "Recepção", installedDaysAgo: 420, warrantyMonths: 12 },
    ],
    orders: [
      {
        id: "demo_vid_os_1",
        number: 1,
        clientId: "demo_vid_client_paula",
        type: "corrective",
        priority: "high",
        status: "completed",
        title: "Porta do box saindo do trilho",
        description: "A folha de correr do box sai do trilho ao abrir.",
        equipmentIds: ["demo_vid_equip_box"],
        schedule: { dayOffset: -5, hour: 14, durationMin: 60 },
        checklist: [{ text: "Regular roldanas e trilhos", done: true }, { text: "Verificar vedação e silicone", done: true }],
        items: [{ kind: "service", refId: "demo_vid_svc_instalacao", quantity: 1 }],
        report: "Roldanas reguladas e uma delas trocada. Silicone refeito na base do box.",
        signedBy: "Paula Andrade",
        createdDaysAgo: 7,
      },
      {
        id: "demo_vid_os_2",
        number: 2,
        clientId: "demo_vid_client_clinica",
        type: "preventive",
        priority: "normal",
        status: "scheduled",
        title: "Revisão anual das janelas",
        description: "Vedação e regulagem das janelas da recepção.",
        equipmentIds: ["demo_vid_equip_janela"],
        schedule: { dayOffset: 4, hour: 8, durationMin: 120 },
        checklist: [{ text: "Verificar vedação e silicone", done: false }, { text: "Regular roldanas e trilhos", done: false }, { text: "Limpar os drenos das esquadrias", done: false }],
        items: [{ kind: "service", refId: "demo_vid_svc_instalacao", quantity: 1 }],
        createdDaysAgo: 9,
      },
      {
        id: "demo_vid_os_3",
        number: 3,
        clientId: "demo_vid_client_paula",
        type: "corrective",
        priority: "normal",
        status: "open",
        title: "Infiltração na sacada com chuva forte",
        description: "Entra água pelo canto esquerdo quando chove com vento.",
        equipmentIds: ["demo_vid_equip_sacada"],
        checklist: [],
        items: [],
        createdDaysAgo: 1,
      },
    ],
    contracts: [
      { id: "demo_vid_ct_clinica", number: 1, clientId: "demo_vid_client_clinica", title: "Manutenção das esquadrias", type: "maintenance", lines: [{ refId: "demo_vid_svc_instalacao", quantity: 1, unitPrice: 90 }], billingDay: 10, equipmentIds: ["demo_vid_equip_janela"], visitIntervalMonths: 6, visitChecklist: ["Regular roldanas e fechos", "Refazer a vedação onde houver infiltração", "Limpar trilhos e drenos"] },
    ],
  },
};
