import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { logger } from "../lib/logger";
import { productRefsFields } from "../lib/proposal-product-refs";
import { DEMO_TENANT_IDS } from "../shared/demo-tenant";
import {
  calculateProposalProductPricing,
  type ProductPricingModel,
  type ProposalProductPricingDetails,
} from "../shared/dimension-pricing";

/**
 * Demonstração do nicho `cortinas` (Persianas e Toldos): o que a conta free
 * desse nicho navega em somente-leitura, no lugar da demonstração de
 * automação, que mostrava Soluções e produto por unidade para quem vende por
 * medida.
 *
 * Segue o fluxo real do nicho: catálogo por medida (área, faixa de altura,
 * largura) e por unidade, ambientes com os produtos padrão e propostas por
 * ambiente, com as linhas precificadas pelo mesmo cálculo da tela
 * (`shared/dimension-pricing.ts`).
 *
 * Idempotente: IDs determinísticos com prefixo `demo_cort_` (não colidem com
 * os da demonstração de automação) e `set()` sobrescrevendo.
 * Rodar: `npx tsx src/scripts/seed-demo-cortinas.ts`, ou o endpoint interno
 * POST /internal/admin/seed-demo-tenant, que semeia todas as demonstrações.
 */

export const DEMO_CORTINAS_TENANT_ID = DEMO_TENANT_IDS.cortinas;

const BASE_MS = Date.UTC(2026, 0, 1, 12, 0, 0);
const ts = (dayOffset: number): Timestamp =>
  Timestamp.fromMillis(BASE_MS + dayOffset * 24 * 60 * 60 * 1000);

function buildSearchTokens(...parts: Array<string | undefined>): string[] {
  const tokens = new Set<string>();
  for (const part of parts) {
    if (!part) continue;
    const normalized = part
      .toLowerCase()
      .normalize("NFD")
      .replace(/[^\x00-\x7f]/g, "");
    for (const word of normalized.split(/\s+/).filter(Boolean)) {
      for (let i = 1; i <= word.length; i += 1) tokens.add(word.slice(0, i));
    }
  }
  return Array.from(tokens).slice(0, 100);
}

// --- Catálogo -----------------------------------------------------------------
const P = {
  rolo: "demo_cort_prod_rolo",
  wave: "demo_cort_prod_wave",
  toldo: "demo_cort_prod_toldo",
  motor: "demo_cort_prod_motor",
} as const;

interface DemoProduct {
  id: string;
  name: string;
  description: string;
  price: number;
  markup: number;
  category: string;
  manufacturer: string;
  inventoryValue: number;
  pricingModel: ProductPricingModel;
}

const DEMO_PRODUCTS: DemoProduct[] = [
  {
    id: P.rolo,
    name: "Persiana Rolô Blackout",
    description: "Tecido blackout em rolo, cobrado por metro quadrado do vão.",
    price: 180,
    markup: 60,
    category: "Persianas",
    manufacturer: "Tecidos Aurora",
    inventoryValue: 120,
    pricingModel: { mode: "curtain_meter" },
  },
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
  {
    id: P.toldo,
    name: "Toldo Retrátil de Braço Articulado",
    description: "Lona acrílica com braços articulados, cobrado por metro de largura.",
    price: 650,
    markup: 55,
    category: "Toldos",
    manufacturer: "Sol & Sombra",
    inventoryValue: 30,
    pricingModel: { mode: "curtain_width" },
  },
  {
    id: P.motor,
    name: "Motor Tubular com Controle",
    description: "Motor silencioso com controle remoto e integração a assistentes de voz.",
    price: 890,
    markup: 40,
    category: "Motorização",
    manufacturer: "Somfy",
    inventoryValue: 25,
    pricingModel: { mode: "standard" },
  },
];

const PRODUCT_BY_ID: Record<string, DemoProduct> = Object.fromEntries(
  DEMO_PRODUCTS.map((p) => [p.id, p]),
);

const DEMO_SERVICES = [
  {
    id: "demo_cort_svc_medicao",
    name: "Medição Técnica",
    description: "Visita para medir vãos, conferir a alvenaria e o ponto elétrico.",
    price: 150,
    category: "Medição",
  },
  {
    id: "demo_cort_svc_instalacao",
    name: "Instalação e Regulagem",
    description: "Fixação de trilhos e suportes, instalação e regulagem do acionamento.",
    price: 380,
    category: "Instalação",
  },
] as const;

const C = {
  marina: "demo_cort_client_marina",
  rafael: "demo_cort_client_rafael",
  studio: "demo_cort_client_studio",
} as const;

const DEMO_CLIENTS = [
  { id: C.marina, name: "Marina Costa", email: "marina.demo@exemplo.com", phone: "11999991001" },
  { id: C.rafael, name: "Rafael Nogueira", email: "rafael.demo@exemplo.com", phone: "11999991002" },
  { id: C.studio, name: "Studio Casa Viva", email: "contato.demo@casaviva.com", phone: "1133331003" },
] as const;

// --- Linhas precificadas ------------------------------------------------------
interface DemoLine {
  productId: string;
  quantity?: number;
  pricingDetails?: ProposalProductPricingDetails;
}

function pricedLine(line: DemoLine) {
  const product = PRODUCT_BY_ID[line.productId];
  const pricing = calculateProposalProductPricing({
    price: product.price,
    markup: product.markup,
    pricingModel: product.pricingModel,
    quantity: line.quantity,
    pricingDetails: line.pricingDetails,
  });
  return { product, pricing };
}

// --- Ambientes: cada um com os produtos padrão e as medidas típicas ---------
const A = {
  sala: "demo_cort_amb_sala",
  suite: "demo_cort_amb_suite",
  varanda: "demo_cort_amb_varanda",
} as const;

const DEMO_AMBIENTES: Array<{
  id: string;
  name: string;
  description: string;
  icon: string;
  order: number;
  lines: DemoLine[];
}> = [
  {
    id: A.sala,
    name: "Sala de Estar",
    description: "Cortina wave no janelão e motorização.",
    icon: "🛋️",
    order: 1,
    lines: [
      {
        productId: P.wave,
        pricingDetails: { mode: "curtain_height", width: 3.2, tierId: "demo_cort_tier_30", maxHeight: 3, panels: 2 },
      },
      { productId: P.motor, quantity: 1 },
    ],
  },
  {
    id: A.suite,
    name: "Suíte Principal",
    description: "Persiana blackout para dormir no escuro.",
    icon: "🛏️",
    order: 2,
    lines: [
      {
        productId: P.rolo,
        pricingDetails: { mode: "curtain_meter", width: 1.8, height: 2.4, area: 0, panels: 2 },
      },
    ],
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
];

function ambienteDefaultProduct(ambienteId: string, line: DemoLine, index: number) {
  const { product, pricing } = pricedLine(line);
  return {
    lineItemId: `${ambienteId}_li_${index + 1}`,
    productId: product.id,
    itemType: "product" as const,
    productName: product.name,
    quantity: pricing.quantity,
    pricingDetails: pricing.pricingDetails,
    status: "active" as const,
  };
}

export interface SeedDemoCortinasResult {
  tenant: number;
  products: number;
  services: number;
  clients: number;
  ambientes: number;
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

export async function seedDemoCortinasTenant(): Promise<SeedDemoCortinasResult> {
  const db = getFirestore();
  const batch = db.batch();
  const tenantId = DEMO_CORTINAS_TENANT_ID;
  const tenantTag = { tenantId } as const;

  batch.set(db.collection("tenants").doc(tenantId), {
    name: "ProOps Demo",
    slug: "proops-demo-persianas",
    niche: "cortinas",
    tenantNiche: "cortinas",
    primaryColor: "#b45309",
    isDemo: true,
    createdAt: ts(0),
    updatedAt: ts(0),
  });

  DEMO_PRODUCTS.forEach((p, i) => {
    const byMeasure = p.pricingModel.mode !== "standard";
    batch.set(db.collection("products").doc(p.id), {
      ...tenantTag,
      name: p.name,
      description: p.description,
      price: String(p.price),
      markup: String(p.markup),
      pricingModel: p.pricingModel,
      manufacturer: p.manufacturer,
      category: p.category,
      inventoryValue: p.inventoryValue,
      inventoryUnit: byMeasure ? "meter" : "unit",
      stock: p.inventoryValue,
      status: "active",
      images: [],
      createdAt: ts(i),
      updatedAt: ts(i),
    });
  });

  DEMO_SERVICES.forEach((s, i) => {
    batch.set(db.collection("services").doc(s.id), {
      ...tenantTag,
      name: s.name,
      description: s.description,
      price: String(s.price),
      category: s.category,
      images: [],
      status: "active",
      createdAt: ts(i),
      updatedAt: ts(i),
    });
  });

  DEMO_CLIENTS.forEach((c, i) => {
    batch.set(db.collection("clients").doc(c.id), {
      ...tenantTag,
      name: c.name,
      email: c.email,
      phone: c.phone,
      types: ["cliente"],
      source: "demo",
      sourceId: null,
      searchTokens: buildSearchTokens(c.name, c.email, c.phone),
      createdAt: ts(i),
      updatedAt: ts(i),
    });
  });

  DEMO_AMBIENTES.forEach((a, i) => {
    batch.set(db.collection("ambientes").doc(a.id), {
      ...tenantTag,
      name: a.name,
      description: a.description,
      icon: a.icon,
      order: a.order,
      defaultProducts: a.lines.map((line, index) => ambienteDefaultProduct(a.id, line, index)),
      createdAt: ts(i),
      updatedAt: ts(i),
    });
  });

  const categoryLabels = Array.from(
    new Set([...DEMO_PRODUCTS.map((p) => p.category), ...DEMO_SERVICES.map((s) => s.category)]),
  );
  const manufacturerLabels = Array.from(new Set(DEMO_PRODUCTS.map((p) => p.manufacturer)));
  const optionDocs: Array<{ type: string; label: string }> = [
    ...categoryLabels.map((label) => ({ type: "product_categories", label })),
    ...manufacturerLabels.map((label) => ({ type: "product_manufacturers", label })),
  ];
  optionDocs.forEach((opt, i) => {
    batch.set(db.collection("options").doc(`demo_cort_opt_${opt.type}_${i}`), {
      ...tenantTag,
      type: opt.type,
      label: opt.label,
      createdAt: ts(i),
    });
  });

  // --- Propostas por ambiente ---------------------------------------------
  // Proposta por ambiente = um grupo por ambiente, com sistemaId igual ao
  // ambienteId (é o que `isEnvironmentProposalSystemInstance` reconhece), e as
  // linhas ligadas pelo instanceId `${ambienteId}-${ambienteId}`.
  const proposals = [
    { id: "demo_cort_prop_1", title: "Apartamento Marina: sala e suíte", status: "approved" as const, client: DEMO_CLIENTS[0], ambienteIds: [A.sala, A.suite], day: 10 },
    { id: "demo_cort_prop_2", title: "Toldo da varanda gourmet", status: "sent" as const, client: DEMO_CLIENTS[1], ambienteIds: [A.varanda], day: 14 },
    { id: "demo_cort_prop_3", title: "Showroom Studio Casa Viva", status: "sent" as const, client: DEMO_CLIENTS[2], ambienteIds: [A.sala, A.suite, A.varanda], day: 18 },
  ];

  proposals.forEach((prop) => {
    const lineItems: Array<Record<string, unknown>> = [];
    const sistemas = prop.ambienteIds.map((ambienteId) => {
      const ambiente = DEMO_AMBIENTES.find((a) => a.id === ambienteId)!;
      const instanceId = `${ambienteId}-${ambienteId}`;
      const productIds: string[] = [];
      ambiente.lines.forEach((line, index) => {
        const { product, pricing } = pricedLine(line);
        productIds.push(product.id);
        lineItems.push({
          lineItemId: `${instanceId}_${index + 1}`,
          productId: product.id,
          itemType: "product",
          productName: product.name,
          quantity: pricing.quantity,
          unitPrice: pricing.unitPrice,
          markup: pricing.markup,
          priceManuallyEdited: false,
          pricingDetails: pricing.pricingDetails,
          total: pricing.total,
          productImage: "",
          productImages: [],
          ambienteInstanceId: instanceId,
          systemInstanceId: instanceId,
          isExtra: false,
          status: "active",
        });
      });
      return {
        sistemaId: ambienteId,
        sistemaName: ambiente.name,
        description: ambiente.description,
        ambientes: [
          { ambienteId, ambienteName: ambiente.name, description: ambiente.description, productIds },
        ],
        ambienteId,
        ambienteName: ambiente.name,
        productIds,
      };
    });

    const totalValue =
      Math.round(lineItems.reduce((sum, li) => sum + (li.total as number), 0) * 100) / 100;

    batch.set(db.collection("proposals").doc(prop.id), {
      ...tenantTag,
      title: prop.title,
      status: prop.status,
      clientId: prop.client.id,
      clientName: prop.client.name,
      clientEmail: prop.client.email,
      products: lineItems,
      ...productRefsFields(lineItems),
      sistemas,
      sections: [],
      totalValue,
      primarySystem: sistemas[0]?.sistemaName ?? "",
      primaryEnvironment: sistemas[0]?.ambienteName ?? "",
      validUntil: new Date(Date.UTC(2035, 0, 1)).toISOString(),
      searchTokens: buildSearchTokens(prop.title, prop.client.name),
      createdAt: ts(prop.day),
      updatedAt: ts(prop.day),
    });
  });

  // --- Financeiro ---------------------------------------------------------
  const now = new Date();
  const ymd = (offsetDays: number): string => {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() + offsetDays);
    return d.toISOString().split("T")[0];
  };
  const isoAt = (offsetDays: number): string => {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() + offsetDays);
    return d.toISOString();
  };

  const DEMO_WALLETS = [
    { id: "demo_cort_wallet_main", name: "Conta Principal", type: "bank", color: "#b45309", icon: "Landmark", isDefault: true },
    { id: "demo_cort_wallet_cash", name: "Caixa", type: "cash", color: "#22c55e", icon: "Wallet", isDefault: false },
  ] as const;

  const DEMO_TRANSACTIONS = [
    { id: "demo_cort_txn_01", type: "income", description: "Apartamento Marina: sinal", amount: 3800, status: "paid", walletId: "demo_cort_wallet_main", dateOffset: -9, dueOffset: -9, paid: true, clientName: "Marina Costa", category: "Propostas" },
    { id: "demo_cort_txn_02", type: "income", description: "Apartamento Marina: saldo na entrega", amount: 3900, status: "pending", walletId: "demo_cort_wallet_main", dateOffset: -9, dueOffset: 6, clientName: "Marina Costa", category: "Propostas" },
    { id: "demo_cort_txn_03", type: "income", description: "Medição técnica avulsa", amount: 150, status: "paid", walletId: "demo_cort_wallet_cash", dateOffset: -4, dueOffset: -4, paid: true, clientName: "Rafael Nogueira", category: "Serviços" },
    { id: "demo_cort_txn_04", type: "income", description: "Persianas do escritório: parcela em atraso", amount: 1600, status: "overdue", walletId: "demo_cort_wallet_main", dateOffset: -20, dueOffset: -6, clientName: "Studio Casa Viva", category: "Propostas" },
    { id: "demo_cort_txn_05", type: "expense", description: "Compra de tecidos blackout", amount: 2400, status: "paid", walletId: "demo_cort_wallet_main", dateOffset: -12, dueOffset: -12, paid: true, category: "Fornecedores" },
    { id: "demo_cort_txn_06", type: "expense", description: "Motores tubulares (lote)", amount: 3100, status: "pending", walletId: "demo_cort_wallet_main", dateOffset: -2, dueOffset: 10, category: "Fornecedores" },
    { id: "demo_cort_txn_07", type: "expense", description: "Costura e confecção terceirizada", amount: 950, status: "paid", walletId: "demo_cort_wallet_cash", dateOffset: -5, dueOffset: -5, paid: true, category: "Operacional" },
    { id: "demo_cort_txn_08", type: "expense", description: "Anúncios online", amount: 600, status: "paid", walletId: "demo_cort_wallet_cash", dateOffset: -11, dueOffset: -11, paid: true, category: "Marketing" },
  ] as const;

  const walletNameById: Record<string, string> = {};
  const walletBalances: Record<string, number> = {};
  for (const w of DEMO_WALLETS) {
    walletNameById[w.id] = w.name;
    walletBalances[w.id] = 0;
  }
  for (const t of DEMO_TRANSACTIONS) {
    if (t.status === "paid") walletBalances[t.walletId] += t.type === "income" ? t.amount : -t.amount;
  }

  DEMO_WALLETS.forEach((w) => {
    batch.set(db.collection("wallets").doc(w.id), {
      ...tenantTag,
      name: w.name,
      type: w.type,
      balance: walletBalances[w.id],
      color: w.color,
      icon: w.icon,
      isDefault: w.isDefault,
      status: "active",
      createdAt: ts(0),
      updatedAt: ts(0),
    });
  });

  batch.set(db.collection("transaction_categories").doc(tenantId), {
    ...tenantTag,
    items: [
      { id: "demo_cort_cat_propostas", name: "Propostas", kind: "income", group: "revenue" },
      { id: "demo_cort_cat_servicos_receita", name: "Serviços", kind: "income", group: "revenue" },
      { id: "demo_cort_cat_fornecedores", name: "Fornecedores", kind: "expense", group: "cost" },
      { id: "demo_cort_cat_operacional", name: "Operacional", kind: "expense", group: "cost" },
      { id: "demo_cort_cat_marketing", name: "Marketing", kind: "expense", group: "operating" },
      { id: "demo_cort_cat_impostos", name: "Impostos", kind: "expense", group: "deduction" },
    ],
    seededAt: ts(0),
  });

  DEMO_TRANSACTIONS.forEach((t) => {
    batch.set(db.collection("transactions").doc(t.id), {
      ...tenantTag,
      type: t.type,
      description: t.description,
      amount: t.amount,
      date: ymd(t.dateOffset),
      dueDate: ymd(t.dueOffset),
      status: t.status,
      wallet: walletNameById[t.walletId] ?? t.walletId,
      ...("clientName" in t ? { clientName: t.clientName } : {}),
      category: t.category,
      ...("paid" in t && t.paid ? { paidAt: isoAt(t.dateOffset) } : {}),
      grouped: false,
      createdAt: ts(0),
      updatedAt: ts(0),
    });
  });

  // --- Projeto de instalação ---------------------------------------------
  const demoStage = (
    id: string,
    name: string,
    status: "pending" | "in_progress" | "done",
    items: Array<[string, boolean]>,
    completedOffset: number | null,
  ) => ({
    id,
    name,
    status,
    checklist: items.map(([text, done], i) => ({
      id: `${id}_item_${i + 1}`,
      text,
      done,
      doneAt: done ? isoAt(completedOffset ?? -1) : null,
      doneBy: null,
    })),
    photos: [],
    completedAt: status === "done" && completedOffset !== null ? isoAt(completedOffset) : null,
  });

  const visitStart = new Date(now);
  visitStart.setUTCDate(visitStart.getUTCDate() + 3);
  visitStart.setUTCHours(12, 0, 0, 0);
  const visitEnd = new Date(visitStart.getTime() + 2 * 60 * 60 * 1000);
  const VISIT_EVENT_ID = "demo_cort_event_instalacao";
  const visit = {
    eventId: VISIT_EVENT_ID,
    isAllDay: false,
    startsAt: visitStart.toISOString(),
    endsAt: visitEnd.toISOString(),
    startDate: null,
    endDate: null,
    startMs: visitStart.getTime(),
    endMs: visitEnd.getTime(),
  };

  const project = {
    id: "proposal_demo_cort_prop_1",
    proposalId: "demo_cort_prop_1",
    title: proposals[0].title,
    client: DEMO_CLIENTS[0],
    stages: [
      demoStage("demo_cort_stage_1", "Medição", "done", [["Medir vãos e altura", true], ["Confirmar tecidos e acionamento", true]], -8),
      demoStage("demo_cort_stage_2", "Produção", "in_progress", [["Enviar pedido", true], ["Conferir peças recebidas", false]], null),
      {
        ...demoStage("demo_cort_stage_3", "Instalação", "pending", [["Fixar trilhos e suportes", false], ["Instalar as cortinas", false], ["Regular e testar o acionamento", false]], null),
        schedule: visit,
      },
      demoStage("demo_cort_stage_4", "Entrega", "pending", [["Orientar o cliente", false], ["Registrar fotos finais", false]], null),
    ],
  };

  batch.set(db.collection("projects").doc(project.id), {
    ...tenantTag,
    proposalId: project.proposalId,
    proposalTitle: project.title,
    proposalCode: null,
    clientId: project.client.id,
    clientName: project.client.name,
    clientPhone: project.client.phone,
    clientEmail: project.client.email,
    address: null,
    title: project.title,
    status: "active",
    stages: project.stages,
    assigneeId: null,
    assigneeName: "Equipe Demo",
    startDate: ymd(-9),
    dueDate: ymd(10),
    notes: null,
    delivery: { status: "none", sharedProjectId: null, acceptance: null },
    createdAt: isoAt(-9),
    updatedAt: isoAt(-1),
    createdBy: null,
  });

  batch.set(db.collection("calendar_events").doc(VISIT_EVENT_ID), {
    ...tenantTag,
    ownerUserId: "demo",
    createdByUserId: "demo",
    updatedByUserId: "demo",
    title: `Instalação: ${project.title}`,
    description: `Cliente: ${project.client.name}
Técnico: Equipe Demo`,
    location: null,
    status: "scheduled",
    color: "#b45309",
    isAllDay: false,
    startsAt: visit.startsAt,
    endsAt: visit.endsAt,
    startDate: null,
    endDate: null,
    startMs: visit.startMs,
    endMs: visit.endMs,
    googleSync: { enabled: false, provider: "google", status: "disabled" },
    projectId: project.id,
    projectStageId: "demo_cort_stage_3",
    createdAt: isoAt(-1),
    updatedAt: isoAt(-1),
  });

  // --- CRM ------------------------------------------------------------------
  const DEMO_LEADS = [
    { id: "demo_cort_lead_helena", name: "Helena Prado", phone: "11988881001", source: "instagram", stage: "novo", estimatedValue: 6500, nextAction: "Agendar a medição", nextActionOffset: 1 },
    { id: "demo_cort_lead_pousada", name: "Pousada Vento Sul", company: "Pousada Vento Sul", phone: "11988881002", source: "indicacao", stage: "contato", estimatedValue: 28000, nextAction: "Levar amostras de lona para os toldos", nextActionOffset: 2 },
    { id: "demo_cort_lead_arq", name: "Arq. Beatriz Lemos", company: "Lemos Arquitetura", phone: "11988881003", source: "arquiteto", stage: "qualificado", estimatedValue: 41000, nextAction: "Enviar proposta da cobertura", nextActionOffset: 3 },
  ] as const;

  DEMO_LEADS.forEach((l, i) => {
    batch.set(db.collection("leads").doc(l.id), {
      ...tenantTag,
      name: l.name,
      phone: l.phone,
      ...("company" in l ? { company: l.company } : {}),
      source: l.source,
      stage: l.stage,
      estimatedValue: l.estimatedValue,
      nextAction: l.nextAction,
      nextActionAt: ymd(l.nextActionOffset),
      ownerName: "Equipe Demo",
      createdAt: isoAt(-(i + 2)),
      updatedAt: isoAt(-(i + 1)),
    });
  });

  const DEMO_ACTIVITIES = [
    { id: "demo_cort_activity_pousada_1", leadId: "demo_cort_lead_pousada", type: "ligacao", title: "Primeiro contato: quer toldos nas seis varandas", offset: -2 },
    { id: "demo_cort_activity_arq_1", leadId: "demo_cort_lead_arq", type: "reuniao", title: "Reunião com a arquiteta sobre as persianas da cobertura", offset: -3 },
  ] as const;

  DEMO_ACTIVITIES.forEach((a) => {
    batch.set(db.collection("activities").doc(a.id), {
      ...tenantTag,
      leadId: a.leadId,
      clientId: null,
      type: a.type,
      title: a.title,
      dueAt: null,
      doneAt: isoAt(a.offset),
      createdByName: "Equipe Demo",
      createdAt: isoAt(Math.min(a.offset, -1)),
    });
  });

  // --- Notificações e tarefas ----------------------------------------------
  const DEMO_NOTIFICATIONS = [
    { id: "demo_cort_notif_vista", type: "proposal_viewed", title: "Proposta visualizada", message: "Rafael Nogueira abriu \"Toldo da varanda gourmet\".", proposalId: "demo_cort_prop_2", offset: 0, read: false },
    { id: "demo_cort_notif_pago", type: "transaction_paid_online", title: "Pagamento recebido", message: "Pagamento via PIX confirmado para \"Apartamento Marina: sinal\".", transactionId: "demo_cort_txn_01", offset: -1, read: false },
    { id: "demo_cort_notif_aceite", type: "proposal_accepted", title: "Cliente aceitou a proposta", message: "Studio Casa Viva aceitou \"Showroom Studio Casa Viva\" pelo link. Confirme para gerar o financeiro.", proposalId: "demo_cort_prop_3", offset: -2, read: true },
  ] as const;

  DEMO_NOTIFICATIONS.forEach((n) => {
    batch.set(db.collection("notifications").doc(n.id), {
      ...tenantTag,
      type: n.type,
      title: n.title,
      message: n.message,
      ...("proposalId" in n ? { proposalId: n.proposalId } : {}),
      ...("transactionId" in n ? { transactionId: n.transactionId } : {}),
      recipientUids: [],
      readBy: [],
      isRead: n.read,
      createdAt: isoAt(n.offset),
    });
  });

  const DEMO_TASKS = [
    { id: "demo_cort_task_pedido", title: "Conferir a chegada dos motores do pedido da Marina", dueOffset: 0, done: false, clientId: C.marina, clientName: "Marina Costa", proposalId: "demo_cort_prop_1", proposalTitle: proposals[0].title },
    { id: "demo_cort_task_amostras", title: "Separar amostras de lona para a Pousada Vento Sul", dueOffset: 2, done: false, leadId: "demo_cort_lead_pousada", leadName: "Pousada Vento Sul" },
  ] as const;

  DEMO_TASKS.forEach((t) => {
    batch.set(db.collection("tasks").doc(t.id), {
      ...tenantTag,
      title: t.title,
      notes: null,
      dueAt: ymd(t.dueOffset),
      assigneeId: null,
      assigneeName: "Equipe Demo",
      mentionUids: [],
      audienceUids: [],
      clientId: "clientId" in t ? t.clientId : null,
      clientName: "clientName" in t ? t.clientName : null,
      proposalId: "proposalId" in t ? t.proposalId : null,
      proposalTitle: "proposalTitle" in t ? t.proposalTitle : null,
      leadId: "leadId" in t ? t.leadId : null,
      leadName: "leadName" in t ? t.leadName : null,
      doneAt: t.done ? isoAt(t.dueOffset) : null,
      doneBy: null,
      createdBy: null,
      createdByName: "Equipe Demo",
      createdAt: isoAt(Math.min(t.dueOffset, 0) - 1),
      updatedAt: isoAt(Math.min(t.dueOffset, 0) - 1),
    });
  });

  await batch.commit();

  const result: SeedDemoCortinasResult = {
    tenant: 1,
    products: DEMO_PRODUCTS.length,
    services: DEMO_SERVICES.length,
    clients: DEMO_CLIENTS.length,
    ambientes: DEMO_AMBIENTES.length,
    options: optionDocs.length,
    proposals: proposals.length,
    wallets: DEMO_WALLETS.length,
    transactions: DEMO_TRANSACTIONS.length,
    leads: DEMO_LEADS.length,
    activities: DEMO_ACTIVITIES.length,
    projects: 1,
    notifications: DEMO_NOTIFICATIONS.length,
    tasks: DEMO_TASKS.length,
  };
  logger.info("seedDemoCortinasTenant complete", { ...result });
  return result;
}

if (require.main === module) {
  import("../init")
    .then(() => seedDemoCortinasTenant())
    .then((r) => {
      console.log("Demo tenant (cortinas) seeded:", r);
      process.exit(0);
    })
    .catch((err) => {
      console.error("Failed to seed demo tenant (cortinas):", err);
      process.exit(1);
    });
}
