import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { logger } from "../lib/logger";
import { productRefsFields } from "../lib/proposal-product-refs";
import { DEMO_TENANT_IDS } from "../shared/demo-tenant";
import { calculateProposalProductPricing } from "../shared/dimension-pricing";

/**
 * Demonstração do nicho `seguranca_eletronica`: o que a conta free desse nicho
 * navega em somente-leitura.
 *
 * Segue o fluxo real do nicho, igual ao de automação: catálogo por unidade,
 * áreas com os produtos padrão, sistemas (kits de CFTV, alarme e controle de
 * acesso) agrupando áreas, e propostas montadas a partir dos sistemas. O
 * financeiro tem um contrato de manutenção mensal como recorrência, que é como
 * o nicho cobra depois da instalação.
 *
 * Idempotente: IDs determinísticos com prefixo `demo_seg_` e `set()`.
 * Rodar: `npx tsx src/scripts/seed-demo-seguranca.ts`, ou o endpoint interno
 * POST /internal/admin/seed-demo-tenant, que semeia todas as demonstrações.
 */

export const DEMO_SEGURANCA_TENANT_ID = DEMO_TENANT_IDS.seguranca_eletronica;

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
  camera: "demo_seg_prod_camera",
  nvr: "demo_seg_prod_nvr",
  sensor: "demo_seg_prod_sensor",
  central: "demo_seg_prod_central",
  leitor: "demo_seg_prod_leitor",
} as const;

const DEMO_PRODUCTS = [
  { id: P.camera, name: "Câmera Bullet Full HD 2MP", description: "Câmera externa com infravermelho de 30 m e proteção IP67.", price: 260, markup: 60, category: "CFTV", manufacturer: "VisionTec", inventoryValue: 48 },
  { id: P.nvr, name: "Gravador NVR 8 Canais", description: "Gravador de rede com HD de 2 TB e acesso remoto pelo aplicativo.", price: 980, markup: 45, category: "CFTV", manufacturer: "VisionTec", inventoryValue: 10 },
  { id: P.sensor, name: "Sensor de Presença Infravermelho", description: "Sensor sem fio com imunidade a animais de até 20 kg.", price: 95, markup: 70, category: "Alarme", manufacturer: "AlarmPro", inventoryValue: 60 },
  { id: P.central, name: "Central de Alarme Monitorável", description: "Central com comunicador 4G e Ethernet, pronta para monitoramento.", price: 720, markup: 50, category: "Alarme", manufacturer: "AlarmPro", inventoryValue: 12 },
  { id: P.leitor, name: "Leitor Facial com Senha", description: "Controle de acesso por reconhecimento facial, senha e cartão.", price: 1350, markup: 40, category: "Controle de Acesso", manufacturer: "AccessOne", inventoryValue: 8 },
] as const;

type DemoProduct = (typeof DEMO_PRODUCTS)[number];
const PRODUCT_BY_ID: Record<string, DemoProduct> = Object.fromEntries(
  DEMO_PRODUCTS.map((p) => [p.id, p]),
);

const DEMO_SERVICES = [
  { id: "demo_seg_svc_instalacao", name: "Instalação e Cabeamento", description: "Passagem de cabos, fixação dos equipamentos e testes de cada ponto.", price: 1200, category: "Instalação" },
  { id: "demo_seg_svc_config", name: "Configuração e Acesso Remoto", description: "Configuração da gravação, das zonas e do aplicativo no celular do cliente.", price: 450, category: "Configuração" },
  { id: "demo_seg_svc_manutencao", name: "Manutenção Mensal", description: "Visita preventiva mensal e atendimento prioritário.", price: 290, category: "Manutenção" },
] as const;

const C = {
  condominio: "demo_seg_client_condominio",
  lucas: "demo_seg_client_lucas",
  loja: "demo_seg_client_loja",
} as const;

const DEMO_CLIENTS = [
  { id: C.condominio, name: "Condomínio Vila Verde", email: "sindico.demo@vilaverde.com", phone: "1133332001" },
  { id: C.lucas, name: "Lucas Andrade", email: "lucas.demo@exemplo.com", phone: "11999992002" },
  { id: C.loja, name: "Loja Bela Moda", email: "contato.demo@belamoda.com", phone: "1133332003" },
] as const;

// --- Áreas e sistemas ----------------------------------------------------------
const A = {
  perimetro: "demo_seg_amb_perimetro",
  portaria: "demo_seg_amb_portaria",
  interno: "demo_seg_amb_interno",
} as const;

type Line = { productId: string; quantity: number };

const DEMO_AMBIENTES: Array<{ id: string; name: string; description: string; icon: string; order: number; lines: Line[] }> = [
  { id: A.perimetro, name: "Perímetro", description: "Muros, portões e área externa.", icon: "🧱", order: 1, lines: [{ productId: P.camera, quantity: 4 }] },
  { id: A.portaria, name: "Portaria", description: "Entrada de pessoas e veículos.", icon: "🚪", order: 2, lines: [{ productId: P.camera, quantity: 2 }, { productId: P.leitor, quantity: 1 }] },
  { id: A.interno, name: "Área Interna", description: "Corredores, salão e depósito.", icon: "🏢", order: 3, lines: [{ productId: P.sensor, quantity: 6 }, { productId: P.central, quantity: 1 }] },
];

const S = {
  cftv: "demo_seg_sys_cftv",
  alarme: "demo_seg_sys_alarme",
  acesso: "demo_seg_sys_acesso",
} as const;

const DEMO_SISTEMAS: Array<{
  id: string;
  name: string;
  description: string;
  icon: string;
  ambientes: Array<{ ambienteId: string; products: Line[] }>;
}> = [
  {
    id: S.cftv,
    name: "CFTV 8 Câmeras",
    description: "Oito câmeras com gravador e acesso remoto pelo celular.",
    icon: "📹",
    ambientes: [
      { ambienteId: A.perimetro, products: [{ productId: P.camera, quantity: 6 }, { productId: P.nvr, quantity: 1 }] },
      { ambienteId: A.portaria, products: [{ productId: P.camera, quantity: 2 }] },
    ],
  },
  {
    id: S.alarme,
    name: "Alarme Monitorado",
    description: "Central monitorável com sensores de presença nas áreas internas.",
    icon: "🚨",
    ambientes: [
      { ambienteId: A.interno, products: [{ productId: P.central, quantity: 1 }, { productId: P.sensor, quantity: 6 }] },
    ],
  },
  {
    id: S.acesso,
    name: "Controle de Acesso",
    description: "Leitor facial na portaria com registro de entradas.",
    icon: "🔐",
    ambientes: [{ ambienteId: A.portaria, products: [{ productId: P.leitor, quantity: 1 }] }],
  },
];

const AMBIENTE_NAME: Record<string, string> = Object.fromEntries(
  DEMO_AMBIENTES.map((a) => [a.id, a.name]),
);

function ambienteProduct(line: Line, index: number, prefix: string) {
  const product = PRODUCT_BY_ID[line.productId];
  return {
    lineItemId: `${prefix}_li_${index + 1}`,
    productId: product.id,
    itemType: "product" as const,
    productName: product.name,
    quantity: line.quantity,
    status: "active" as const,
  };
}

export interface SeedDemoSegurancaResult {
  tenant: number;
  products: number;
  services: number;
  clients: number;
  ambientes: number;
  sistemas: number;
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

export async function seedDemoSegurancaTenant(): Promise<SeedDemoSegurancaResult> {
  const db = getFirestore();
  const batch = db.batch();
  const tenantId = DEMO_SEGURANCA_TENANT_ID;
  const tenantTag = { tenantId } as const;

  batch.set(db.collection("tenants").doc(tenantId), {
    name: "ProOps Demo",
    slug: "proops-demo-seguranca",
    niche: "seguranca_eletronica",
    tenantNiche: "seguranca_eletronica",
    primaryColor: "#dc2626",
    isDemo: true,
    createdAt: ts(0),
    updatedAt: ts(0),
  });

  DEMO_PRODUCTS.forEach((p, i) => {
    batch.set(db.collection("products").doc(p.id), {
      ...tenantTag,
      name: p.name,
      description: p.description,
      price: String(p.price),
      markup: String(p.markup),
      pricingModel: { mode: "standard" },
      manufacturer: p.manufacturer,
      category: p.category,
      inventoryValue: p.inventoryValue,
      inventoryUnit: "unit",
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
      defaultProducts: a.lines.map((line, index) => ambienteProduct(line, index, a.id)),
      createdAt: ts(i),
      updatedAt: ts(i),
    });
  });

  DEMO_SISTEMAS.forEach((sys, i) => {
    const ambientes = sys.ambientes.map((amb) => ({
      ambienteId: amb.ambienteId,
      products: amb.products.map((line, index) =>
        ambienteProduct(line, index, `${sys.id}-${amb.ambienteId}`),
      ),
    }));
    const ambienteIds = ambientes.map((a) => a.ambienteId);
    batch.set(db.collection("sistemas").doc(sys.id), {
      ...tenantTag,
      name: sys.name,
      description: sys.description,
      icon: sys.icon,
      ambientes,
      availableAmbienteIds: ambienteIds,
      ambienteIds,
      defaultProducts: [],
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
    batch.set(db.collection("options").doc(`demo_seg_opt_${opt.type}_${i}`), {
      ...tenantTag,
      type: opt.type,
      label: opt.label,
      createdAt: ts(i),
    });
  });

  // --- Propostas a partir dos sistemas --------------------------------------
  const proposals = [
    { id: "demo_seg_prop_1", title: "Condomínio Vila Verde: CFTV e acesso", status: "approved" as const, client: DEMO_CLIENTS[0], sistemaIds: [S.cftv, S.acesso], day: 10 },
    { id: "demo_seg_prop_2", title: "Residência Lucas: alarme monitorado", status: "sent" as const, client: DEMO_CLIENTS[1], sistemaIds: [S.alarme], day: 14 },
    { id: "demo_seg_prop_3", title: "Loja Bela Moda: CFTV", status: "sent" as const, client: DEMO_CLIENTS[2], sistemaIds: [S.cftv], day: 18 },
  ];

  proposals.forEach((prop) => {
    const lineItems: Array<Record<string, unknown>> = [];
    const sistemas = prop.sistemaIds.map((sistemaId) => {
      const sys = DEMO_SISTEMAS.find((x) => x.id === sistemaId)!;
      const ambientes = sys.ambientes.map((amb) => {
        const instanceId = `${sistemaId}-${amb.ambienteId}`;
        const productIds: string[] = [];
        amb.products.forEach((line) => {
          const product = PRODUCT_BY_ID[line.productId];
          const pricing = calculateProposalProductPricing({
            price: product.price,
            markup: product.markup,
            quantity: line.quantity,
          });
          productIds.push(product.id);
          lineItems.push({
            lineItemId: `${instanceId}_${product.id}`,
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
          ambienteId: amb.ambienteId,
          ambienteName: AMBIENTE_NAME[amb.ambienteId],
          description: "",
          productIds,
        };
      });
      const primary = ambientes[0];
      return {
        sistemaId,
        sistemaName: sys.name,
        description: sys.description,
        ambientes,
        ambienteId: primary?.ambienteId,
        ambienteName: primary?.ambienteName,
        productIds: ambientes.flatMap((a) => a.productIds),
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

  // --- Financeiro, com a mensalidade de manutenção como recorrência -------
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
    { id: "demo_seg_wallet_main", name: "Conta Principal", type: "bank", color: "#dc2626", icon: "Landmark", isDefault: true },
    { id: "demo_seg_wallet_cash", name: "Caixa", type: "cash", color: "#22c55e", icon: "Wallet", isDefault: false },
  ] as const;

  type DemoTxn = {
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
    category: string;
    recurringGroupId?: string;
  };

  const DEMO_TRANSACTIONS: DemoTxn[] = [
    { id: "demo_seg_txn_01", type: "income", description: "Condomínio Vila Verde: entrada da instalação", amount: 7200, status: "paid", walletId: "demo_seg_wallet_main", dateOffset: -9, dueOffset: -9, paid: true, clientName: "Condomínio Vila Verde", category: "Propostas" },
    { id: "demo_seg_txn_02", type: "income", description: "Condomínio Vila Verde: saldo na entrega", amount: 7200, status: "pending", walletId: "demo_seg_wallet_main", dateOffset: -9, dueOffset: 7, clientName: "Condomínio Vila Verde", category: "Propostas" },
    // Contrato de manutenção: a mensalidade recorrente, que é a receita do nicho
    // depois da instalação.
    { id: "demo_seg_txn_03", type: "income", description: "Manutenção mensal: Loja Bela Moda", amount: 290, status: "paid", walletId: "demo_seg_wallet_main", dateOffset: -30, dueOffset: -30, paid: true, clientName: "Loja Bela Moda", category: "Manutenção", recurringGroupId: "demo_seg_rec_manutencao" },
    { id: "demo_seg_txn_04", type: "income", description: "Manutenção mensal: Loja Bela Moda", amount: 290, status: "paid", walletId: "demo_seg_wallet_main", dateOffset: 0, dueOffset: 0, paid: true, clientName: "Loja Bela Moda", category: "Manutenção", recurringGroupId: "demo_seg_rec_manutencao" },
    { id: "demo_seg_txn_05", type: "income", description: "Manutenção mensal: Loja Bela Moda", amount: 290, status: "pending", walletId: "demo_seg_wallet_main", dateOffset: 30, dueOffset: 30, clientName: "Loja Bela Moda", category: "Manutenção", recurringGroupId: "demo_seg_rec_manutencao" },
    { id: "demo_seg_txn_06", type: "income", description: "Visita técnica avulsa", amount: 180, status: "overdue", walletId: "demo_seg_wallet_cash", dateOffset: -15, dueOffset: -5, clientName: "Lucas Andrade", category: "Serviços" },
    { id: "demo_seg_txn_07", type: "expense", description: "Compra de câmeras e gravador", amount: 3900, status: "paid", walletId: "demo_seg_wallet_main", dateOffset: -12, dueOffset: -12, paid: true, category: "Fornecedores" },
    { id: "demo_seg_txn_08", type: "expense", description: "Cabos e conectores", amount: 640, status: "paid", walletId: "demo_seg_wallet_cash", dateOffset: -6, dueOffset: -6, paid: true, category: "Fornecedores" },
    { id: "demo_seg_txn_09", type: "expense", description: "Técnico terceirizado: instalação", amount: 1100, status: "pending", walletId: "demo_seg_wallet_main", dateOffset: -2, dueOffset: 5, category: "Operacional" },
  ];

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
      { id: "demo_seg_cat_propostas", name: "Propostas", kind: "income", group: "revenue" },
      { id: "demo_seg_cat_manutencao", name: "Manutenção", kind: "income", group: "revenue" },
      { id: "demo_seg_cat_servicos", name: "Serviços", kind: "income", group: "revenue" },
      { id: "demo_seg_cat_fornecedores", name: "Fornecedores", kind: "expense", group: "cost" },
      { id: "demo_seg_cat_operacional", name: "Operacional", kind: "expense", group: "cost" },
      { id: "demo_seg_cat_impostos", name: "Impostos", kind: "expense", group: "deduction" },
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
      ...(t.clientName ? { clientName: t.clientName } : {}),
      category: t.category,
      ...(t.paid ? { paidAt: isoAt(t.dateOffset) } : {}),
      ...(t.recurringGroupId ? { isRecurring: true, recurringGroupId: t.recurringGroupId } : {}),
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
  visitStart.setUTCDate(visitStart.getUTCDate() + 2);
  visitStart.setUTCHours(12, 0, 0, 0);
  const visitEnd = new Date(visitStart.getTime() + 3 * 60 * 60 * 1000);
  const VISIT_EVENT_ID = "demo_seg_event_configuracao";
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
    id: "proposal_demo_seg_prop_1",
    proposalId: "demo_seg_prop_1",
    title: proposals[0].title,
    client: DEMO_CLIENTS[0],
    stages: [
      demoStage("demo_seg_stage_1", "Levantamento", "done", [["Mapear os pontos de câmera e sensores", true], ["Definir a rota dos cabos e a energia", true], ["Confirmar o local do gravador e da central", true]], -8),
      demoStage("demo_seg_stage_2", "Infraestrutura", "done", [["Passar tubulação e cabeamento", true], ["Montar o rack ou a caixa do gravador", true]], -4),
      demoStage("demo_seg_stage_3", "Instalação", "in_progress", [["Instalar câmeras, sensores e central", true], ["Instalar fechaduras, leitores e cerca, se houver", false]], null),
      {
        ...demoStage("demo_seg_stage_4", "Configuração", "pending", [["Configurar gravação e acesso remoto no aplicativo", false], ["Cadastrar zonas, usuários e biometrias", false], ["Testar cada ponto", false]], null),
        schedule: visit,
      },
      demoStage("demo_seg_stage_5", "Entrega", "pending", [["Treinar o cliente", false], ["Entregar senhas e o termo de entrega", false], ["Registrar fotos finais", false]], null),
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
    dueDate: ymd(9),
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
    title: `Configuração: ${project.title}`,
    description: `Cliente: ${project.client.name}
Técnico: Equipe Demo`,
    location: null,
    status: "scheduled",
    color: "#dc2626",
    isAllDay: false,
    startsAt: visit.startsAt,
    endsAt: visit.endsAt,
    startDate: null,
    endDate: null,
    startMs: visit.startMs,
    endMs: visit.endMs,
    googleSync: { enabled: false, provider: "google", status: "disabled" },
    projectId: project.id,
    projectStageId: "demo_seg_stage_4",
    createdAt: isoAt(-1),
    updatedAt: isoAt(-1),
  });

  // --- CRM ------------------------------------------------------------------
  const DEMO_LEADS = [
    { id: "demo_seg_lead_clinica", name: "Clínica Sorriso", company: "Clínica Sorriso", phone: "11988882001", source: "indicacao", stage: "novo", estimatedValue: 9800, nextAction: "Agendar a vistoria técnica", nextActionOffset: 1 },
    { id: "demo_seg_lead_galpao", name: "Galpão Logística Sul", company: "Logística Sul", phone: "11988882002", source: "google", stage: "contato", estimatedValue: 36000, nextAction: "Enviar proposta de CFTV com 16 câmeras", nextActionOffset: 2 },
    { id: "demo_seg_lead_residencia", name: "Paulo Martins", phone: "11988882003", source: "instagram", stage: "qualificado", estimatedValue: 14500, nextAction: "Apresentar alarme monitorado com cerca", nextActionOffset: 3 },
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
    { id: "demo_seg_activity_galpao_1", leadId: "demo_seg_lead_galpao", type: "ligacao", title: "Primeiro contato: quer cobrir as docas e o estacionamento", offset: -2 },
    { id: "demo_seg_activity_residencia_1", leadId: "demo_seg_lead_residencia", type: "reuniao", title: "Visita à residência para ver o muro e os acessos", offset: -3 },
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
    { id: "demo_seg_notif_vista", type: "proposal_viewed", title: "Proposta visualizada", message: "Lucas Andrade abriu \"Residência Lucas: alarme monitorado\".", proposalId: "demo_seg_prop_2", offset: 0, read: false },
    { id: "demo_seg_notif_pago", type: "transaction_paid_online", title: "Pagamento recebido", message: "Pagamento via PIX confirmado para \"Manutenção mensal: Loja Bela Moda\".", transactionId: "demo_seg_txn_04", offset: 0, read: false },
    { id: "demo_seg_notif_aceite", type: "proposal_accepted", title: "Cliente aceitou a proposta", message: "Loja Bela Moda aceitou \"Loja Bela Moda: CFTV\" pelo link. Confirme para gerar o financeiro.", proposalId: "demo_seg_prop_3", offset: -2, read: true },
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
    { id: "demo_seg_task_config", title: "Levar o notebook para configurar o gravador do condomínio", dueOffset: 2, done: false, clientId: C.condominio, clientName: "Condomínio Vila Verde", proposalId: "demo_seg_prop_1", proposalTitle: proposals[0].title },
    { id: "demo_seg_task_proposta", title: "Montar proposta de 16 câmeras para o galpão", dueOffset: 1, done: false, leadId: "demo_seg_lead_galpao", leadName: "Galpão Logística Sul" },
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

  const result: SeedDemoSegurancaResult = {
    tenant: 1,
    products: DEMO_PRODUCTS.length,
    services: DEMO_SERVICES.length,
    clients: DEMO_CLIENTS.length,
    ambientes: DEMO_AMBIENTES.length,
    sistemas: DEMO_SISTEMAS.length,
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
  logger.info("seedDemoSegurancaTenant complete", { ...result });
  return result;
}

if (require.main === module) {
  import("../init")
    .then(() => seedDemoSegurancaTenant())
    .then((r) => {
      console.log("Demo tenant (seguranca) seeded:", r);
      process.exit(0);
    })
    .catch((err) => {
      console.error("Failed to seed demo tenant (seguranca):", err);
      process.exit(1);
    });
}
