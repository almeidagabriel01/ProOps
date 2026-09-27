import { productRefsFields } from "../../lib/proposal-product-refs";
import { computeProposalSortFields } from "../../lib/proposal-sort-fields";
import { calculateProposalProductPricing } from "../../shared/dimension-pricing";
import type {
  DemoDataset,
  DemoFormat,
  DemoLine,
  DemoProduct,
  DemoStage,
  SeedDemoResult,
} from "./types";

/**
 * O motor único das demonstrações: transforma um `DemoDataset` na lista de
 * escritas do Firestore. Puro (as datas vêm de `now` e o Timestamp vem de
 * `timestamp`), para o teste comparar a saída sem banco nenhum; quem grava é
 * `seedDemo` (`./seed.ts`).
 */

export type DemoWrite =
  | { op: "set"; path: string; data: Record<string, unknown> }
  | { op: "delete"; path: string };

export interface BuildDemoOptions {
  now: Date;
  timestamp: (ms: number) => unknown;
}

/** Datas fixas: re-semear e ordenar por createdAt é determinístico. */
const BASE_MS = Date.UTC(2026, 0, 1, 12, 0, 0);
const DAY_MS = 24 * 60 * 60 * 1000;

/** Formato padrão para dataset novo: preço pelo catálogo e ids por posição. */
export function catalogFormat(): DemoFormat {
  return {
    ambienteLineId: "byIndex",
    ambienteLinePricing: true,
    sistemaLineId: "byInstanceIndex",
    proposalLineId: "byProduct",
    pricing: { kind: "catalog" },
    totalInCents: true,
  };
}

function buildSearchTokens(...parts: Array<string | undefined>): string[] {
  const tokens = new Set<string>();
  for (const part of parts) {
    if (!part) continue;
    // NFD + tirar o que não é ASCII remove os acentos.
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

export function buildDemoDocs(ds: DemoDataset, opts: BuildDemoOptions): DemoWrite[] {
  const writes: DemoWrite[] = [];
  const set = (path: string, data: Record<string, unknown>) =>
    writes.push({ op: "set", path, data });
  const ts = (day: number) => opts.timestamp(BASE_MS + day * DAY_MS);
  const ymd = (offsetDays: number): string => {
    const d = new Date(opts.now);
    d.setUTCDate(d.getUTCDate() + offsetDays);
    return d.toISOString().split("T")[0];
  };
  const isoAt = (offsetDays: number): string => {
    const d = new Date(opts.now);
    d.setUTCDate(d.getUTCDate() + offsetDays);
    return d.toISOString();
  };
  const tenantTag = { tenantId: ds.tenantId };
  const productById = new Map(ds.products.map((p) => [p.id, p]));
  const product = (id: string): DemoProduct => {
    const found = productById.get(id);
    if (!found) throw new Error(`Demo ${ds.niche}: produto ${id} não existe no dataset.`);
    return found;
  };
  const clientById = new Map(ds.clients.map((c) => [c.id, c]));
  const client = (id: string) => {
    const found = clientById.get(id);
    if (!found) throw new Error(`Demo ${ds.niche}: contato ${id} não existe no dataset.`);
    return found;
  };
  const { format } = ds;

  /** Preço da linha: pelo catálogo, ou o markup único do seed antigo. */
  const priceLine = (line: DemoLine) => {
    const p = product(line.productId);
    if (format.pricing.kind === "legacyFlatMarkup") {
      const quantity = line.quantity ?? 0;
      const markup = format.pricing.markup;
      return {
        quantity,
        unitPrice: p.price,
        markup,
        total: Math.round(p.price * quantity * (1 + markup / 100)),
        pricingDetails: { mode: "standard" } as const,
      };
    }
    const pricing = calculateProposalProductPricing({
      price: p.price,
      markup: p.markup,
      pricingModel: p.pricingModel ?? { mode: "standard" },
      quantity: line.quantity,
      pricingDetails: line.pricingDetails,
    });
    return {
      quantity: pricing.quantity,
      unitPrice: pricing.unitPrice,
      markup: pricing.markup,
      total: pricing.total,
      pricingDetails: pricing.pricingDetails,
    };
  };

  const templateLine = (line: DemoLine, lineItemId: string, withPricing: boolean) => {
    const p = product(line.productId);
    const base = {
      lineItemId,
      productId: p.id,
      itemType: "product" as const,
      productName: p.name,
      quantity: line.quantity,
      status: "active" as const,
    };
    if (!withPricing) return base;
    const priced = priceLine(line);
    return { ...base, quantity: priced.quantity, pricingDetails: priced.pricingDetails };
  };

  // --- Tenant -------------------------------------------------------------
  set(`tenants/${ds.tenantId}`, {
    name: "ProOps Demo",
    slug: ds.tenant.slug,
    niche: ds.niche,
    tenantNiche: ds.niche,
    primaryColor: ds.tenant.primaryColor,
    isDemo: true,
    createdAt: ts(0),
    updatedAt: ts(0),
  });

  // --- Catálogo -----------------------------------------------------------
  ds.products.forEach((p, i) => {
    const pricingModel = p.pricingModel ?? { mode: "standard" };
    set(`products/${p.id}`, {
      ...tenantTag,
      name: p.name,
      description: p.description,
      price: String(p.price),
      markup: p.markup === undefined ? "0" : String(p.markup),
      pricingModel,
      manufacturer: p.manufacturer,
      category: p.category,
      inventoryValue: p.inventoryValue,
      inventoryUnit: pricingModel.mode === "standard" ? "unit" : "meter",
      stock: p.inventoryValue,
      status: "active",
      images: [],
      createdAt: ts(i),
      updatedAt: ts(i),
    });
  });

  ds.services.forEach((s, i) => {
    set(`services/${s.id}`, {
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

  ds.clients.forEach((c, i) => {
    set(`clients/${c.id}`, {
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

  ds.ambientes.forEach((a, i) => {
    set(`ambientes/${a.id}`, {
      ...tenantTag,
      name: a.name,
      description: a.description,
      icon: a.icon,
      order: a.order,
      defaultProducts: a.lines.map((line, index) =>
        templateLine(
          line,
          format.ambienteLineId === "byProduct" ? `${line.productId}_li` : `${a.id}_li_${index + 1}`,
          format.ambienteLinePricing,
        ),
      ),
      createdAt: ts(i),
      updatedAt: ts(i),
    });
  });

  (ds.sistemas ?? []).forEach((sys, i) => {
    const ambientes = sys.ambientes.map((amb) => ({
      ambienteId: amb.ambienteId,
      products: amb.lines.map((line, index) =>
        templateLine(
          line,
          format.sistemaLineId === "byInstanceIndex"
            ? `${sys.id}-${amb.ambienteId}_li_${index + 1}`
            : `${line.productId}_li`,
          false,
        ),
      ),
    }));
    const ambienteIds = ambientes.map((a) => a.ambienteId);
    set(`sistemas/${sys.id}`, {
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

  // Sugestões de categoria e fabricante do formulário de produto. O índice é
  // global (categorias, depois fabricantes): mudar a ordem muda os ids.
  const categoryLabels = Array.from(
    new Set([...ds.products.map((p) => p.category), ...ds.services.map((s) => s.category)]),
  );
  const manufacturerLabels = Array.from(new Set(ds.products.map((p) => p.manufacturer)));
  const optionDocs = [
    ...categoryLabels.map((label) => ({ type: "product_categories", label })),
    ...manufacturerLabels.map((label) => ({ type: "product_manufacturers", label })),
  ];
  optionDocs.forEach((opt, i) => {
    set(`options/${ds.optionIdPrefix}_opt_${opt.type}_${i}`, {
      ...tenantTag,
      type: opt.type,
      label: opt.label,
      createdAt: ts(i),
    });
  });

  // --- Propostas ------------------------------------------------------------
  const ambienteById = new Map(ds.ambientes.map((a) => [a.id, a]));
  const sistemaById = new Map((ds.sistemas ?? []).map((s) => [s.id, s]));

  ds.proposals.items.forEach((prop) => {
    const lineItems: Array<Record<string, unknown>> = [];
    const pushLine = (line: DemoLine, instanceId: string, index: number) => {
      const p = product(line.productId);
      const priced = priceLine(line);
      lineItems.push({
        lineItemId:
          format.proposalLineId === "byProduct" ? `${instanceId}_${p.id}` : `${instanceId}_${index + 1}`,
        productId: p.id,
        itemType: "product",
        productName: p.name,
        quantity: priced.quantity,
        unitPrice: priced.unitPrice,
        markup: priced.markup,
        priceManuallyEdited: false,
        pricingDetails: priced.pricingDetails,
        total: priced.total,
        productImage: "",
        productImages: [],
        ambienteInstanceId: instanceId,
        systemInstanceId: instanceId,
        isExtra: false,
        status: "active",
      });
      return p.id;
    };

    const sistemas =
      ds.proposals.workflow === "environment"
        ? // Proposta por ambiente: cada grupo é o próprio ambiente, com
          // sistemaId igual ao ambienteId (é o que o formulário reconhece).
          prop.groupIds.map((ambienteId) => {
            const ambiente = ambienteById.get(ambienteId)!;
            const instanceId = `${ambienteId}-${ambienteId}`;
            const productIds = ambiente.lines.map((line, index) => pushLine(line, instanceId, index));
            return {
              sistemaId: ambienteId,
              sistemaName: ambiente.name,
              description: ambiente.description,
              ambientes: [
                {
                  ambienteId,
                  ambienteName: ambiente.name,
                  description: ambiente.description,
                  productIds,
                },
              ],
              ambienteId,
              ambienteName: ambiente.name,
              productIds,
            };
          })
        : prop.groupIds.map((sistemaId) => {
            const sys = sistemaById.get(sistemaId)!;
            const ambientes = sys.ambientes.map((amb) => {
              const instanceId = `${sistemaId}-${amb.ambienteId}`;
              const productIds = amb.lines.map((line, index) => pushLine(line, instanceId, index));
              return {
                ambienteId: amb.ambienteId,
                ambienteName: ambienteById.get(amb.ambienteId)!.name,
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

    const rawTotal = lineItems.reduce((sum, li) => sum + (li.total as number), 0);
    const totalValue = format.totalInCents ? Math.round(rawTotal * 100) / 100 : rawTotal;
    const c = client(prop.clientId);

    set(`proposals/${prop.id}`, {
      ...tenantTag,
      title: prop.title,
      status: prop.status,
      clientId: c.id,
      clientName: c.name,
      clientEmail: c.email,
      products: lineItems,
      ...productRefsFields(lineItems),
      sistemas,
      sections: [],
      totalValue,
      // Campos de ordenação da lista, pela mesma derivação do app.
      ...computeProposalSortFields({ sistemas }),
      // Validade distante: o cron de vencimento nunca avisa sobre a demonstração.
      validUntil: new Date(Date.UTC(2035, 0, 1)).toISOString(),
      searchTokens: buildSearchTokens(prop.title, c.name),
      createdAt: ts(prop.day),
      updatedAt: ts(prop.day),
    });
  });

  // --- Financeiro -------------------------------------------------------------
  const { wallets, categories, transactions } = ds.finance;
  const walletName = new Map(wallets.map((w) => [w.id, w.name]));
  const balances = new Map(wallets.map((w) => [w.id, 0]));
  for (const t of transactions) {
    // Espelha getWalletImpacts: só o que está pago mexe no saldo.
    if (t.status === "paid") {
      balances.set(t.walletId, (balances.get(t.walletId) ?? 0) + (t.type === "income" ? t.amount : -t.amount));
    }
  }
  wallets.forEach((w) => {
    set(`wallets/${w.id}`, {
      ...tenantTag,
      name: w.name,
      type: w.type,
      balance: balances.get(w.id) ?? 0,
      color: w.color,
      icon: w.icon,
      isDefault: w.isDefault,
      status: "active",
      createdAt: ts(0),
      updatedAt: ts(0),
    });
  });

  set(`transaction_categories/${ds.tenantId}`, { ...tenantTag, items: categories, seededAt: ts(0) });

  transactions.forEach((t) => {
    set(`transactions/${t.id}`, {
      ...tenantTag,
      type: t.type,
      description: t.description,
      amount: t.amount,
      date: ymd(t.dateOffset),
      dueDate: ymd(t.dueOffset),
      status: t.status,
      // O NOME da carteira, como o fluxo real de propostas grava.
      wallet: walletName.get(t.walletId) ?? t.walletId,
      ...(t.clientName ? { clientName: t.clientName } : {}),
      ...(t.category ? { category: t.category } : {}),
      ...(t.paid ? { paidAt: isoAt(t.dateOffset) } : {}),
      ...(t.installment
        ? {
            isInstallment: true,
            installmentCount: t.installment.count,
            installmentNumber: t.installment.number,
            installmentGroupId: t.installment.groupId,
          }
        : {}),
      ...(t.recurringGroupId ? { isRecurring: true, recurringGroupId: t.recurringGroupId } : {}),
      // Sem o trigger (emulador), a consulta de avulsos precisa do campo.
      grouped: false,
      createdAt: ts(0),
      updatedAt: ts(0),
    });
  });

  // --- Obra -----------------------------------------------------------------
  const { project } = ds;
  const projectProposal = ds.proposals.items.find((p) => p.id === project.proposalId);
  if (!projectProposal) throw new Error(`Demo ${ds.niche}: a obra aponta para proposta inexistente.`);
  const projectClient = client(project.clientId);
  const projectId = `proposal_${project.proposalId}`;

  const visitStart = new Date(opts.now);
  visitStart.setUTCDate(visitStart.getUTCDate() + project.visit.dayOffset);
  visitStart.setUTCHours(12, 0, 0, 0);
  const visitEnd = new Date(visitStart.getTime() + project.visit.hours * 60 * 60 * 1000);
  const visit = {
    eventId: project.visit.eventId,
    isAllDay: false,
    startsAt: visitStart.toISOString(),
    endsAt: visitEnd.toISOString(),
    startDate: null,
    endDate: null,
    startMs: visitStart.getTime(),
    endMs: visitEnd.getTime(),
  };

  const stageDoc = (stage: DemoStage) => {
    const base = {
      id: stage.id,
      name: stage.name,
      status: stage.status,
      checklist: stage.items.map(([text, done], i) => ({
        id: `${stage.id}_item_${i + 1}`,
        text,
        done,
        doneAt: done ? isoAt(stage.completedOffset ?? -1) : null,
        doneBy: null,
      })),
      photos: [],
      completedAt:
        stage.status === "done" && stage.completedOffset !== null ? isoAt(stage.completedOffset) : null,
    };
    return stage.id === project.visit.stageId ? { ...base, schedule: visit } : base;
  };

  set(`projects/${projectId}`, {
    ...tenantTag,
    proposalId: project.proposalId,
    proposalTitle: projectProposal.title,
    proposalCode: null,
    clientId: projectClient.id,
    clientName: projectClient.name,
    clientPhone: projectClient.phone,
    clientEmail: projectClient.email,
    address: null,
    title: projectProposal.title,
    status: "active",
    stages: project.stages.map(stageDoc),
    assigneeId: null,
    assigneeName: "Equipe Demo",
    startDate: ymd(project.startOffset),
    dueDate: ymd(project.dueOffset),
    notes: null,
    delivery: { status: "none", sharedProjectId: null, acceptance: null },
    createdAt: isoAt(project.createdOffset),
    updatedAt: isoAt(-1),
    createdBy: null,
  });

  const scheduledStage = project.stages.find((s) => s.id === project.visit.stageId);
  if (!scheduledStage) throw new Error(`Demo ${ds.niche}: a visita aponta para etapa inexistente.`);
  set(`calendar_events/${project.visit.eventId}`, {
    ...tenantTag,
    ownerUserId: "demo",
    createdByUserId: "demo",
    updatedByUserId: "demo",
    title: `${scheduledStage.name}: ${projectProposal.title}`,
    description: `Cliente: ${projectClient.name}\nTécnico: Equipe Demo`,
    location: null,
    status: "scheduled",
    color: project.visit.color,
    isAllDay: false,
    startsAt: visit.startsAt,
    endsAt: visit.endsAt,
    startDate: null,
    endDate: null,
    startMs: visit.startMs,
    endMs: visit.endMs,
    googleSync: { enabled: false, provider: "google", status: "disabled" },
    projectId,
    projectStageId: project.visit.stageId,
    createdAt: isoAt(-1),
    updatedAt: isoAt(-1),
  });

  // --- CRM, notificações e tarefas ------------------------------------------
  ds.leads.forEach((l, i) => {
    set(`leads/${l.id}`, {
      ...tenantTag,
      name: l.name,
      phone: l.phone,
      ...(l.company ? { company: l.company } : {}),
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

  ds.activities.forEach((a) => {
    const done = a.done ?? true;
    set(`activities/${a.id}`, {
      ...tenantTag,
      leadId: a.leadId,
      clientId: null,
      type: a.type,
      title: a.title,
      dueAt: done ? null : ymd(a.offset),
      doneAt: done ? isoAt(a.offset) : null,
      createdByName: "Equipe Demo",
      createdAt: isoAt(Math.min(a.offset, -1)),
    });
  });

  // A conta free lê a demonstração direto (isDemoRead), sem destinatário.
  ds.notifications.forEach((n) => {
    set(`notifications/${n.id}`, {
      ...tenantTag,
      type: n.type,
      title: n.title,
      message: n.message,
      ...(n.proposalId ? { proposalId: n.proposalId } : {}),
      ...(n.transactionId ? { transactionId: n.transactionId } : {}),
      ...(n.projectId ? { projectId: n.projectId } : {}),
      recipientUids: [],
      readBy: [],
      isRead: n.read,
      createdAt: isoAt(n.offset),
    });
  });

  ds.tasks.forEach((t) => {
    set(`tasks/${t.id}`, {
      ...tenantTag,
      title: t.title,
      notes: null,
      dueAt: ymd(t.dueOffset),
      assigneeId: null,
      assigneeName: "Equipe Demo",
      mentionUids: [],
      audienceUids: [],
      clientId: t.clientId ?? null,
      clientName: t.clientName ?? null,
      proposalId: t.proposalId ?? null,
      proposalTitle: t.proposalTitle ?? null,
      leadId: t.leadId ?? null,
      leadName: t.leadName ?? null,
      doneAt: t.done ? isoAt(t.dueOffset) : null,
      doneBy: null,
      createdBy: null,
      createdByName: "Equipe Demo",
      createdAt: isoAt(Math.min(t.dueOffset, 0) - 1),
      updatedAt: isoAt(Math.min(t.dueOffset, 0) - 1),
    });
  });

  for (const path of ds.legacyDeletes ?? []) writes.push({ op: "delete", path });

  return writes;
}

export function demoResultCounts(ds: DemoDataset): SeedDemoResult {
  const categoryCount = new Set([
    ...ds.products.map((p) => p.category),
    ...ds.services.map((s) => s.category),
  ]).size;
  const manufacturerCount = new Set(ds.products.map((p) => p.manufacturer)).size;
  return {
    tenant: 1,
    products: ds.products.length,
    services: ds.services.length,
    clients: ds.clients.length,
    ambientes: ds.ambientes.length,
    ...(ds.sistemas ? { sistemas: ds.sistemas.length } : {}),
    options: categoryCount + manufacturerCount,
    proposals: ds.proposals.items.length,
    wallets: ds.finance.wallets.length,
    transactions: ds.finance.transactions.length,
    leads: ds.leads.length,
    activities: ds.activities.length,
    projects: 1,
    notifications: ds.notifications.length,
    tasks: ds.tasks.length,
  };
}
