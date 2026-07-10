import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { logger } from "../lib/logger";

/**
 * Shared, read-only demo dataset for the free-tier demo mode (Feature B).
 *
 * Free accounts (and expired trials) browse the ERP against this fixed "demo"
 * tenant instead of their own empty tenant. The dataset mirrors the real
 * authoring flow of the automacao_residencial niche:
 *   products/services  → catalog items
 *   ambientes          → rooms, each carrying its standard product list
 *   sistemas (Soluções)→ solutions grouping rooms + their products
 *   proposals          → built from the solutions, with PRICED line items
 *
 * Firestore rules allow any authenticated user to READ docs tagged
 * `tenantId: "demo"`, and NEVER write them (Admin SDK seed only).
 *
 * Idempotent: deterministic doc IDs + `set()` overwrite, safe to re-run.
 * Run with: `npx tsx src/scripts/seed-demo-tenant.ts` (or the internal
 * cron-secret endpoint POST /internal/admin/seed-demo-tenant).
 */

export const DEMO_TENANT_ID = "demo";

// Fixed base date so re-runs and orderBy(createdAt) are deterministic.
const BASE_MS = Date.UTC(2026, 0, 1, 12, 0, 0);
const ts = (dayOffset: number): Timestamp =>
  Timestamp.fromMillis(BASE_MS + dayOffset * 24 * 60 * 60 * 1000);

function buildSearchTokens(...parts: Array<string | undefined>): string[] {
  const tokens = new Set<string>();
  for (const part of parts) {
    if (!part) continue;
    // NFD + strip non-ASCII removes accents (combining marks are > 0x7f).
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

// --- Catalog -------------------------------------------------------------------
const P = {
  central: "demo_prod_central",
  sensor: "demo_prod_sensor",
  lock: "demo_prod_lock",
  speaker: "demo_prod_speaker",
} as const;

interface DemoProduct {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  manufacturer: string;
  inventoryValue: number;
}

const DEMO_PRODUCTS: DemoProduct[] = [
  {
    id: P.central,
    name: "Central de Automação Smart Hub",
    description: "Controlador central para integrar iluminação, climatização e segurança.",
    price: 2490,
    category: "Automação",
    manufacturer: "SmartHome",
    inventoryValue: 12,
  },
  {
    id: P.sensor,
    name: "Sensor de Presença Wireless",
    description: "Sensor de movimento sem fio com alcance de 8 metros.",
    price: 189,
    category: "Sensores",
    manufacturer: "SensorTech",
    inventoryValue: 60,
  },
  {
    id: P.lock,
    name: "Fechadura Digital Biométrica",
    description: "Fechadura com leitor de digital, senha e desbloqueio por app.",
    price: 1290,
    category: "Segurança",
    manufacturer: "SecureLock",
    inventoryValue: 20,
  },
  {
    id: P.speaker,
    name: "Caixa de Som Embutida",
    description: "Alto-falante de teto para som ambiente multizona.",
    price: 640,
    category: "Áudio",
    manufacturer: "AudioPro",
    inventoryValue: 35,
  },
];

const PRICE_BY_ID: Record<string, number> = Object.fromEntries(
  DEMO_PRODUCTS.map((p) => [p.id, p.price]),
);
const NAME_BY_ID: Record<string, string> = Object.fromEntries(
  DEMO_PRODUCTS.map((p) => [p.id, p.name]),
);

const DEMO_SERVICES = [
  {
    id: "demo_svc_install",
    name: "Instalação e Comissionamento",
    description: "Instalação completa dos equipamentos e testes de comissionamento.",
    price: 850,
    category: "Instalação",
  },
  {
    id: "demo_svc_config",
    name: "Configuração de Cenários",
    description: "Programação de cenas e automações personalizadas por ambiente.",
    price: 420,
    category: "Configuração",
  },
  {
    id: "demo_svc_support",
    name: "Manutenção Anual",
    description: "Plano de manutenção preventiva com visitas trimestrais.",
    price: 1200,
    category: "Suporte",
  },
] as const;

const C = {
  ana: "demo_client_ana",
  bruno: "demo_client_bruno",
  condo: "demo_client_condo",
} as const;

const DEMO_CLIENTS = [
  { id: C.ana, name: "Ana Ribeiro", email: "ana.demo@exemplo.com", phone: "11999990001" },
  { id: C.bruno, name: "Bruno Carvalho", email: "bruno.demo@exemplo.com", phone: "11999990002" },
  { id: C.condo, name: "Condomínio Jardins", email: "contato.demo@jardins.com", phone: "1133330003" },
] as const;

// --- Ambientes (rooms) — each carries its standard product list ---------------
const A = {
  sala: "demo_amb_sala",
  entrada: "demo_amb_entrada",
  comuns: "demo_amb_comuns",
} as const;

function ambienteProduct(productId: string, quantity: number) {
  return {
    lineItemId: `${productId}_li`,
    productId,
    itemType: "product" as const,
    productName: NAME_BY_ID[productId],
    quantity,
    status: "active" as const,
  };
}

const DEMO_AMBIENTES = [
  {
    id: A.sala,
    name: "Sala de Estar",
    description: "Automação de iluminação, som e clima da sala principal.",
    icon: "🛋️",
    order: 1,
    defaultProducts: [ambienteProduct(P.central, 1), ambienteProduct(P.speaker, 2)],
  },
  {
    id: A.entrada,
    name: "Hall de Entrada",
    description: "Controle de acesso e segurança da entrada.",
    icon: "🚪",
    order: 2,
    defaultProducts: [ambienteProduct(P.lock, 1), ambienteProduct(P.sensor, 2)],
  },
  {
    id: A.comuns,
    name: "Áreas Comuns",
    description: "Som ambiente multizona nas áreas de convivência.",
    icon: "🔊",
    order: 3,
    defaultProducts: [ambienteProduct(P.speaker, 4)],
  },
] as const;

// --- Sistemas (Soluções) — solutions grouping rooms + products ----------------
const S = {
  residencial: "demo_sys_residencial",
  seguranca: "demo_sys_seguranca",
  audio: "demo_sys_audio",
} as const;

interface SistemaAmbiente {
  ambienteId: string;
  products: Array<{ productId: string; quantity: number }>;
}

const DEMO_SISTEMAS: Array<{
  id: string;
  name: string;
  description: string;
  icon: string;
  ambientes: SistemaAmbiente[];
}> = [
  {
    id: S.residencial,
    name: "Automação Residencial Completa",
    description: "Solução integrada de iluminação, som, clima e segurança para a casa toda.",
    icon: "🏠",
    ambientes: [
      {
        ambienteId: A.sala,
        products: [
          { productId: P.central, quantity: 1 },
          { productId: P.speaker, quantity: 2 },
        ],
      },
      {
        ambienteId: A.entrada,
        products: [
          { productId: P.lock, quantity: 1 },
          { productId: P.sensor, quantity: 2 },
        ],
      },
    ],
  },
  {
    id: S.seguranca,
    name: "Segurança e Controle de Acesso",
    description: "Fechadura biométrica e sensores de presença para o perímetro.",
    icon: "🔒",
    ambientes: [
      {
        ambienteId: A.entrada,
        products: [
          { productId: P.lock, quantity: 1 },
          { productId: P.sensor, quantity: 3 },
        ],
      },
    ],
  },
  {
    id: S.audio,
    name: "Som Ambiente Multizona",
    description: "Áudio distribuído com controle por zona nas áreas comuns.",
    icon: "🎵",
    ambientes: [
      { ambienteId: A.comuns, products: [{ productId: P.speaker, quantity: 4 }] },
    ],
  },
];

const AMBIENTE_NAME: Record<string, string> = Object.fromEntries(
  DEMO_AMBIENTES.map((a) => [a.id, a.name]),
);

export interface SeedDemoTenantResult {
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
}

export async function seedDemoTenant(): Promise<SeedDemoTenantResult> {
  const db = getFirestore();
  const batch = db.batch();
  const tenantTag = { tenantId: DEMO_TENANT_ID } as const;

  // Tenant doc — automacao_residencial niche so "Soluções" renders.
  batch.set(db.collection("tenants").doc(DEMO_TENANT_ID), {
    name: "ProOps Demo",
    slug: "proops-demo",
    niche: "automacao_residencial",
    tenantNiche: "automacao_residencial",
    primaryColor: "#4f46e5",
    isDemo: true,
    createdAt: ts(0),
    updatedAt: ts(0),
  });

  DEMO_PRODUCTS.forEach((p, i) => {
    batch.set(db.collection("products").doc(p.id), {
      ...tenantTag,
      name: p.name,
      description: p.description,
      // Product.price/markup are strings in the domain type.
      price: String(p.price),
      markup: "0",
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
      defaultProducts: a.defaultProducts,
      createdAt: ts(i),
      updatedAt: ts(i),
    });
  });

  DEMO_SISTEMAS.forEach((sys, i) => {
    const ambientes = sys.ambientes.map((amb) => ({
      ambienteId: amb.ambienteId,
      products: amb.products.map((pr) => ambienteProduct(pr.productId, pr.quantity)),
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

  // Options — category/manufacturer suggestions for the product form dropdowns.
  const categoryLabels = Array.from(
    new Set([
      ...DEMO_PRODUCTS.map((p) => p.category),
      ...DEMO_SERVICES.map((s) => s.category),
    ]),
  );
  const manufacturerLabels = Array.from(
    new Set(DEMO_PRODUCTS.map((p) => p.manufacturer)),
  );
  const optionDocs: Array<{ type: string; label: string }> = [
    ...categoryLabels.map((label) => ({ type: "product_categories", label })),
    ...manufacturerLabels.map((label) => ({ type: "product_manufacturers", label })),
  ];
  optionDocs.forEach((opt, i) => {
    batch.set(
      db.collection("options").doc(`demo_opt_${opt.type}_${i}`),
      { ...tenantTag, type: opt.type, label: opt.label, createdAt: ts(i) },
    );
  });

  // --- Proposals: built from the solutions, with PRICED line items -----------
  interface DemoProposal {
    id: string;
    title: string;
    status: "approved" | "sent";
    client: (typeof DEMO_CLIENTS)[number];
    sistemaIds: string[];
    day: number;
  }

  const proposals: DemoProposal[] = [
    {
      id: "demo_prop_1",
      title: "Automação Residencial Completa",
      status: "approved",
      client: DEMO_CLIENTS[0],
      sistemaIds: [S.residencial],
      day: 10,
    },
    {
      id: "demo_prop_2",
      title: "Segurança e Controle de Acesso",
      status: "sent",
      client: DEMO_CLIENTS[1],
      sistemaIds: [S.seguranca],
      day: 14,
    },
    {
      id: "demo_prop_3",
      title: "Som Ambiente Multizona",
      status: "sent",
      client: DEMO_CLIENTS[2],
      sistemaIds: [S.audio],
      day: 18,
    },
  ];

  const MARKUP = 30; // % de lucro — deixa "Valor Final (c/ Lucro)" > "Custo (Bruto)"

  proposals.forEach((prop) => {
    const lineItems: Array<Record<string, unknown>> = [];
    const sistemas = prop.sistemaIds.map((sistemaId) => {
      const sys = DEMO_SISTEMAS.find((x) => x.id === sistemaId)!;
      const ambientes = sys.ambientes.map((amb) => {
        // instanceId liga o line item ao ambiente da solução. O form filtra os
        // produtos por `systemInstanceId` (NÃO por ambienteInstanceId), então
        // ambos precisam existir e ser iguais a `${sistemaId}-${ambienteId}`.
        const instanceId = `${sistemaId}-${amb.ambienteId}`;
        const productIds: string[] = [];
        amb.products.forEach((pr) => {
          const unitPrice = PRICE_BY_ID[pr.productId];
          const total = Math.round(unitPrice * pr.quantity * (1 + MARKUP / 100));
          productIds.push(pr.productId);
          lineItems.push({
            lineItemId: `${instanceId}_${pr.productId}`,
            productId: pr.productId,
            itemType: "product",
            productName: NAME_BY_ID[pr.productId],
            quantity: pr.quantity,
            unitPrice, // custo base por unidade
            markup: MARKUP,
            priceManuallyEdited: false,
            pricingDetails: { mode: "standard" },
            total, // quantity * unitPrice * (1 + markup/100)
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
        // Campos legados de compat (o loader os tolera; o save real os grava).
        ambienteId: primary?.ambienteId,
        ambienteName: primary?.ambienteName,
        productIds: ambientes.flatMap((a) => a.productIds),
      };
    });

    const totalValue = lineItems.reduce(
      (sum, li) => sum + (li.total as number),
      0,
    );

    batch.set(db.collection("proposals").doc(prop.id), {
      ...tenantTag,
      title: prop.title,
      status: prop.status,
      clientId: prop.client.id,
      clientName: prop.client.name,
      clientEmail: prop.client.email,
      products: lineItems,
      sistemas,
      sections: [],
      totalValue,
      // Far-future validity so the checkDueDates cron never flags the demo
      // proposals as "expiring" and never creates junk notifications for demo.
      validUntil: new Date(Date.UTC(2035, 0, 1)).toISOString(),
      searchTokens: buildSearchTokens(prop.title, prop.client.name),
      createdAt: ts(prop.day),
      updatedAt: ts(prop.day),
    });
  });

  // --- Financeiro: carteiras + lançamentos --------------------------------
  // Dá conteúdo ao módulo Financeiro e ao Dashboard no modo demo. As datas são
  // ancoradas no momento do seed (`now`) para o demo sempre parecer atual; os
  // doc IDs são determinísticos (`demo_wallet_*` / `demo_txn_*`), então re-runs
  // sobrescrevem em vez de duplicar. Só afeta o tenant fixo "demo".
  const now = new Date();
  const ymd = (offsetDays: number): string => {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() + offsetDays);
    return d.toISOString().split("T")[0]; // YYYY-MM-DD (igual ao formato date/dueDate)
  };
  const isoAt = (offsetDays: number): string => {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() + offsetDays);
    return d.toISOString(); // ISO completo para paidAt
  };

  const DEMO_WALLETS = [
    {
      id: "demo_wallet_main",
      name: "Conta Principal",
      type: "bank",
      color: "#4f46e5",
      icon: "Landmark",
      isDefault: true,
    },
    {
      id: "demo_wallet_cash",
      name: "Caixa",
      type: "cash",
      color: "#22c55e",
      icon: "Wallet",
      isDefault: false,
    },
  ] as const;

  type DemoTxn = {
    id: string;
    type: "income" | "expense";
    description: string;
    amount: number;
    status: "paid" | "pending" | "overdue";
    walletId: string;
    dateOffset: number; // data de lançamento (dias a partir de hoje)
    dueOffset: number; // vencimento (dias a partir de hoje)
    paid?: boolean; // paidAt = dateOffset quando pago
    clientName?: string;
    category?: string;
    // Parcelamento: membros de um mesmo installmentGroupId. O trigger
    // onTransactionTotals agrupa (transaction_groups) e ajusta `grouped`.
    isInstallment?: boolean;
    installmentCount?: number;
    installmentNumber?: number;
    installmentGroupId?: string;
  };

  const DEMO_TRANSACTIONS: DemoTxn[] = [
    // Receitas
    { id: "demo_txn_01", type: "income", description: "Automação residencial — entrada do projeto", amount: 8500, status: "paid", walletId: "demo_wallet_main", dateOffset: -10, dueOffset: -10, paid: true, clientName: "Ana Paula Ribeiro" },
    { id: "demo_txn_02", type: "income", description: "Manutenção preventiva — contrato mensal", amount: 5000, status: "paid", walletId: "demo_wallet_cash", dateOffset: -4, dueOffset: -4, paid: true, clientName: "Carla Menezes" },
    { id: "demo_txn_03", type: "income", description: "Cortinas motorizadas — instalação", amount: 12000, status: "paid", walletId: "demo_wallet_main", dateOffset: -25, dueOffset: -25, paid: true, clientName: "Bruno Carvalho" },
    { id: "demo_txn_04", type: "income", description: "Saldo do projeto de automação", amount: 9500, status: "pending", walletId: "demo_wallet_main", dateOffset: -2, dueOffset: 5, clientName: "Carla Menezes" },
    { id: "demo_txn_05", type: "income", description: "Parcela em atraso", amount: 4200, status: "overdue", walletId: "demo_wallet_main", dateOffset: -20, dueOffset: -8, clientName: "Bruno Carvalho" },
    // Despesas
    { id: "demo_txn_06", type: "expense", description: "Compra de equipamentos KNX", amount: 3200, status: "paid", walletId: "demo_wallet_main", dateOffset: -8, dueOffset: -8, paid: true, category: "Fornecedores" },
    { id: "demo_txn_07", type: "expense", description: "Mão de obra — instalação", amount: 1500, status: "paid", walletId: "demo_wallet_cash", dateOffset: -3, dueOffset: -3, paid: true, category: "Operacional" },
    { id: "demo_txn_08", type: "expense", description: "Anúncios online", amount: 900, status: "paid", walletId: "demo_wallet_cash", dateOffset: -12, dueOffset: -12, paid: true, category: "Marketing" },
    { id: "demo_txn_09", type: "expense", description: "Lote de sensores de presença", amount: 2800, status: "pending", walletId: "demo_wallet_main", dateOffset: -1, dueOffset: 6, category: "Fornecedores" },
    { id: "demo_txn_10", type: "expense", description: "Assinatura de software de projeto", amount: 1800, status: "pending", walletId: "demo_wallet_main", dateOffset: -1, dueOffset: 18, category: "Serviços" },
    // Receita parcelada 3x — projeto de automação da Ana (1ª paga, 2 pendentes)
    { id: "demo_txn_11", type: "income", description: "Automação Residência Ana — projeto (parcelado)", amount: 4000, status: "paid", walletId: "demo_wallet_main", dateOffset: -30, dueOffset: -30, paid: true, clientName: "Ana Paula Ribeiro", isInstallment: true, installmentCount: 3, installmentNumber: 1, installmentGroupId: "demo_inst_income_1" },
    { id: "demo_txn_12", type: "income", description: "Automação Residência Ana — projeto (parcelado)", amount: 4000, status: "pending", walletId: "demo_wallet_main", dateOffset: -30, dueOffset: 2, clientName: "Ana Paula Ribeiro", isInstallment: true, installmentCount: 3, installmentNumber: 2, installmentGroupId: "demo_inst_income_1" },
    { id: "demo_txn_13", type: "income", description: "Automação Residência Ana — projeto (parcelado)", amount: 4000, status: "pending", walletId: "demo_wallet_main", dateOffset: -30, dueOffset: 32, clientName: "Ana Paula Ribeiro", isInstallment: true, installmentCount: 3, installmentNumber: 3, installmentGroupId: "demo_inst_income_1" },
    // Despesa parcelada 3x — compra de equipamentos (1ª paga, 2 pendentes)
    { id: "demo_txn_14", type: "expense", description: "Compra de equipamentos — parcelado", amount: 1500, status: "paid", walletId: "demo_wallet_main", dateOffset: -25, dueOffset: -25, paid: true, category: "Fornecedores", isInstallment: true, installmentCount: 3, installmentNumber: 1, installmentGroupId: "demo_inst_expense_1" },
    { id: "demo_txn_15", type: "expense", description: "Compra de equipamentos — parcelado", amount: 1500, status: "pending", walletId: "demo_wallet_main", dateOffset: -25, dueOffset: 8, category: "Fornecedores", isInstallment: true, installmentCount: 3, installmentNumber: 2, installmentGroupId: "demo_inst_expense_1" },
    { id: "demo_txn_16", type: "expense", description: "Compra de equipamentos — parcelado", amount: 1500, status: "pending", walletId: "demo_wallet_main", dateOffset: -25, dueOffset: 38, category: "Fornecedores", isInstallment: true, installmentCount: 3, installmentNumber: 3, installmentGroupId: "demo_inst_expense_1" },
  ];

  // Saldo desnormalizado de cada carteira, espelhando getWalletImpacts: só
  // lançamentos "paid" com carteira afetam o saldo (income +, expense -).
  const walletBalances: Record<string, number> = {};
  for (const w of DEMO_WALLETS) walletBalances[w.id] = 0;
  for (const t of DEMO_TRANSACTIONS) {
    if (t.status === "paid") {
      walletBalances[t.walletId] += t.type === "income" ? t.amount : -t.amount;
    }
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

  DEMO_TRANSACTIONS.forEach((t) => {
    batch.set(db.collection("transactions").doc(t.id), {
      ...tenantTag,
      type: t.type,
      description: t.description,
      amount: t.amount,
      date: ymd(t.dateOffset),
      dueDate: ymd(t.dueOffset),
      status: t.status,
      wallet: t.walletId,
      ...(t.clientName ? { clientName: t.clientName } : {}),
      ...(t.category ? { category: t.category } : {}),
      ...(t.paid ? { paidAt: isoAt(t.dateOffset) } : {}),
      ...(t.isInstallment
        ? {
            isInstallment: true,
            installmentCount: t.installmentCount,
            installmentNumber: t.installmentNumber,
            installmentGroupId: t.installmentGroupId,
          }
        : {}),
      // Lançamentos avulsos (sem grupo de proposta): grouped=false explícito
      // garante que a query de avulsos (where grouped == false) os retorne
      // mesmo em ambiente onde o trigger onTransactionTotals não rode.
      grouped: false,
      createdAt: ts(0),
      updatedAt: ts(0),
    });
  });
  // ------------------------------------------------------------------------

  await batch.commit();

  const result: SeedDemoTenantResult = {
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
  };
  logger.info("seedDemoTenant complete", { ...result });
  return result;
}

// Allow direct execution: `npx tsx src/scripts/seed-demo-tenant.ts`
if (require.main === module) {
  import("../init")
    .then(() => seedDemoTenant())
    .then((r) => {
      console.log("Demo tenant seeded:", r);
      process.exit(0);
    })
    .catch((err) => {
      console.error("Failed to seed demo tenant:", err);
      process.exit(1);
    });
}
