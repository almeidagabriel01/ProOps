import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { logger } from "../lib/logger";

/**
 * Shared, read-only demo dataset for the free-tier demo mode (Feature B).
 *
 * Free accounts (and expired trials) browse the ERP against this fixed
 * `demo` tenant instead of their own empty tenant: some products, services,
 * proposals (with automation "sistemas"/"ambientes" = Soluções) and clients.
 * Firestore rules allow any authenticated user to READ docs tagged
 * `tenantId: "demo"`, and NEVER write them (Admin SDK seed only).
 *
 * Idempotent: deterministic doc IDs + `set()` overwrite, safe to re-run.
 * Run with: `npx tsx src/scripts/seed-demo-tenant.ts` (or via the internal
 * cron-secret endpoint).
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

// --- Product ids referenced by the demo proposals ------------------------------
const P = {
  central: "demo_prod_central",
  sensor: "demo_prod_sensor",
  lock: "demo_prod_lock",
  speaker: "demo_prod_speaker",
} as const;

const DEMO_PRODUCTS = [
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
] as const;

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

export interface SeedDemoTenantResult {
  tenant: number;
  products: number;
  services: number;
  clients: number;
  proposals: number;
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
      price: p.price,
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
      price: s.price,
      category: s.category,
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

  // Proposals with automation sistemas/ambientes (= Soluções).
  const proposals = [
    {
      id: "demo_prop_1",
      title: "Automação Residencial Completa",
      status: "approved",
      client: DEMO_CLIENTS[0],
      totalValue: 6870,
      day: 10,
      sistemas: [
        {
          sistemaId: "demo_sys_living",
          sistemaName: "Sala de Estar",
          ambientes: [
            {
              ambienteId: "demo_amb_living",
              ambienteName: "Sala principal",
              productIds: [P.central, P.speaker],
            },
          ],
        },
        {
          sistemaId: "demo_sys_entrance",
          sistemaName: "Entrada",
          ambientes: [
            {
              ambienteId: "demo_amb_entrance",
              ambienteName: "Hall de entrada",
              productIds: [P.lock, P.sensor],
            },
          ],
        },
      ],
    },
    {
      id: "demo_prop_2",
      title: "Segurança e Controle de Acesso",
      status: "sent",
      client: DEMO_CLIENTS[1],
      totalValue: 2758,
      day: 14,
      sistemas: [
        {
          sistemaId: "demo_sys_security",
          sistemaName: "Segurança",
          ambientes: [
            {
              ambienteId: "demo_amb_perimeter",
              ambienteName: "Perímetro",
              productIds: [P.lock, P.sensor],
            },
          ],
        },
      ],
    },
    {
      id: "demo_prop_3",
      title: "Som Ambiente Multizona",
      status: "draft",
      client: DEMO_CLIENTS[2],
      totalValue: 1920,
      day: 18,
      sistemas: [
        {
          sistemaId: "demo_sys_audio",
          sistemaName: "Áudio",
          ambientes: [
            {
              ambienteId: "demo_amb_common",
              ambienteName: "Áreas comuns",
              productIds: [P.speaker],
            },
          ],
        },
      ],
    },
  ] as const;

  proposals.forEach((prop) => {
    batch.set(db.collection("proposals").doc(prop.id), {
      ...tenantTag,
      title: prop.title,
      status: prop.status,
      clientId: prop.client.id,
      clientName: prop.client.name,
      clientEmail: prop.client.email,
      products: [],
      sistemas: prop.sistemas,
      sections: [],
      totalValue: prop.totalValue,
      // Far-future validity so the checkDueDates cron never flags the demo
      // proposals as "expiring" and never creates junk notifications for demo.
      validUntil: new Date(Date.UTC(2035, 0, 1)).toISOString(),
      searchTokens: buildSearchTokens(prop.title, prop.client.name),
      createdAt: ts(prop.day),
      updatedAt: ts(prop.day),
    });
  });

  await batch.commit();

  const result: SeedDemoTenantResult = {
    tenant: 1,
    products: DEMO_PRODUCTS.length,
    services: DEMO_SERVICES.length,
    clients: DEMO_CLIENTS.length,
    proposals: proposals.length,
  };
  logger.info("seedDemoTenant complete", { ...result });
  return result;
}

// Allow direct execution: `npx tsx src/scripts/seed-demo-tenant.ts`
if (require.main === module) {
  // Lazily init the Admin app for standalone runs.
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
