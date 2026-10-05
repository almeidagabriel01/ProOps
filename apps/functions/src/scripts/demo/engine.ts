import { productRefsFields } from "../../lib/proposal-product-refs";
import { computeProposalSortFields } from "../../lib/proposal-sort-fields";
import { calculateProposalProductPricing } from "../../shared/dimension-pricing";
import { NICHE_REGISTRY } from "../../shared/niches";
import {
  computeOrderTotals,
  formatOrderCode,
  signatureContentHash,
  type ServiceOrderItem,
} from "../../api/services/field-service/field-service-model";
import {
  CONTRACT_INCOME_CATEGORY,
  addMonthsOnDay,
  chargeTransactionId,
  computeMonthlyAmount,
  formatContractCode,
  formatPeriod,
  periodOf,
} from "../../api/services/field-service/contract-model";
import {
  buildProjectItemsFromProposal,
  type ProjectItem,
  type ProjectItemStatus,
} from "../../api/services/projects/project-items";
import { buildPmocItems, pmocItemsForVisit, pmocOrderChecklist, type PmocItem } from "../../shared/pmoc";
import type {
  DemoContract,
  DemoDataset,
  DemoServiceOrder,
  DemoLine,
  DemoProduct,
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

/** Mensalidades já recebidas em cada contrato de exemplo. */
const DEMO_PAID_CHARGES = 2;

/** A próxima visita do PMOC de exemplo, em dias a partir de hoje. */
const PMOC_NEXT_VISIT_DAYS = 12;

/** OS gerada pelo motor (a visita do PMOC), com o contrato e os ids do checklist. */
type EngineOrder = DemoServiceOrder & { contractId?: string; checklistIds?: string[] };

interface DemoPmocPlan {
  items: PmocItem[];
  anchorDate: string;
  nextVisitDate: string;
  visits: EngineOrder[];
}

function daysFrom(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / DAY_MS);
}

/**
 * O plano e as visitas já feitas do PMOC de exemplo. Visitas mensais contadas
 * para trás a partir da próxima, no mesmo dia do mês (até o 28, que existe em
 * todo mês), com o checklist que `pmocItemsForVisit` daria à rotina.
 */
function buildDemoPmocPlan(params: {
  contract: DemoContract;
  equipmentTypes: string[];
  today: string;
  firstOrderNumber: number;
}): DemoPmocPlan | null {
  const { contract, today } = params;
  const pmoc = contract.pmoc;
  if (!pmoc) return null;
  const interval = contract.visitIntervalMonths ?? 1;
  const nextRaw = new Date(`${today}T12:00:00Z`);
  nextRaw.setUTCDate(nextRaw.getUTCDate() + PMOC_NEXT_VISIT_DAYS);
  const day = Math.min(nextRaw.getUTCDate(), 28);
  const nextVisitDate = addMonthsOnDay(nextRaw.toISOString().slice(0, 10), 0, day);
  const items = buildPmocItems(params.equipmentTypes);
  const dates = Array.from({ length: pmoc.visitsDone }, (_, i) =>
    addMonthsOnDay(nextVisitDate, -(pmoc.visitsDone - i) * interval, day),
  );
  const anchorDate = dates[0] ?? nextVisitDate;
  const visits: EngineOrder[] = dates.map((visitDate, i) => {
    const checklist = pmocOrderChecklist(pmocItemsForVisit({ items, anchorDate, visitDate, intervalMonths: interval }));
    const dayOffset = daysFrom(today, visitDate);
    return {
      id: `contract_${contract.id}_visit_${visitDate.replace(/-/g, "")}`,
      number: params.firstOrderNumber + i,
      clientId: contract.clientId,
      type: "preventive",
      priority: "normal",
      status: "completed",
      title: `Visita do PMOC: ${contract.title}`,
      description: `Visita prevista no contrato ${formatContractCode(contract.number)}.`,
      equipmentIds: contract.equipmentIds,
      schedule: { dayOffset, hour: 8, durationMin: 120 },
      checklist: checklist.map((c) => ({ text: c.text, done: true })),
      checklistIds: checklist.map((c) => c.id),
      items: [],
      report: `Plano do mês executado: ${checklist.length} itens conferidos, sem pendências.`,
      signedBy: pmoc.signedBy,
      createdDaysAgo: Math.max(0, -dayOffset + 7),
      contractId: contract.id,
    };
  });
  return { items, anchorDate, nextVisitDate, visits };
}

/** Datas fixas: re-semear e ordenar por createdAt é determinístico. */
const BASE_MS = Date.UTC(2026, 0, 1, 12, 0, 0);
const DAY_MS = 24 * 60 * 60 * 1000;

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

/**
 * O traço da assinatura de exemplo, em SVG embutido: a demonstração não sobe
 * arquivo nenhum para o Storage.
 */
const DEMO_SIGNATURE_DATA_URL =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="110" viewBox="0 0 320 110"><path d="M12 78 C 40 20, 60 20, 70 70 S 100 100, 120 50 S 150 10, 170 60 S 200 95, 225 45 C 240 20, 250 70, 270 55 S 300 40, 308 62" fill="none" stroke="#111827" stroke-width="3" stroke-linecap="round"/></svg>',
  );

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

  /** Preço da linha pelo mesmo cálculo da tela. */
  const priceLine = (line: DemoLine) => {
    const p = product(line.productId);
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
        templateLine(line, `${a.id}_li_${index + 1}`, true),
      ),
      createdAt: ts(i),
      updatedAt: ts(i),
    });
  });

  (ds.sistemas ?? []).forEach((sys, i) => {
    const ambientes = sys.ambientes.map((amb) => ({
      ambienteId: amb.ambienteId,
      products: amb.lines.map((line, index) =>
        templateLine(line, `${sys.id}-${amb.ambienteId}_li_${index + 1}`, false),
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
    set(`options/${ds.idPrefix}_opt_${opt.type}_${i}`, {
      ...tenantTag,
      type: opt.type,
      label: opt.label,
      createdAt: ts(i),
    });
  });

  // --- Propostas ------------------------------------------------------------
  const ambienteById = new Map(ds.ambientes.map((a) => [a.id, a]));
  const sistemaById = new Map((ds.sistemas ?? []).map((s) => [s.id, s]));

  // Linhas e grupos gravados de cada proposta: a obra copia os itens da dela.
  const proposalContent = new Map<string, { products: unknown[]; sistemas: unknown[] }>();
  ds.proposals.items.forEach((prop) => {
    const lineItems: Array<Record<string, unknown>> = [];
    const pushLine = (line: DemoLine, instanceId: string, index: number) => {
      const p = product(line.productId);
      const priced = priceLine(line);
      lineItems.push({
        lineItemId: `${instanceId}_${index + 1}`,
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
    const totalValue = Math.round(rawTotal * 100) / 100;
    const c = client(prop.clientId);

    proposalContent.set(prop.id, { products: lineItems, sistemas });
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
  // As mensalidades pagas dos contratos de exemplo entram na carteira padrão.
  const mainWallet = wallets.find((w) => w.isDefault) ?? wallets[0];
  for (const c of ds.fieldService.contracts) {
    const paid = computeMonthlyAmount(c.lines) * DEMO_PAID_CHARGES;
    balances.set(mainWallet.id, Math.round(((balances.get(mainWallet.id) ?? 0) + paid) * 100) / 100);
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

  // Nome e checklist das etapas vêm do roteiro do nicho, o mesmo com que a
  // obra de uma empresa real nasce.
  const template = NICHE_REGISTRY[ds.niche].stageTemplate;
  if (project.stageProgress.length !== template.length) {
    throw new Error(`Demo ${ds.niche}: o andamento tem ${project.stageProgress.length} etapas e o roteiro tem ${template.length}.`);
  }
  const stageId = (index: number) => `${ds.idPrefix}_stage_${index + 1}`;
  const stages = template.map((stage, index) => {
    const progress = project.stageProgress[index];
    const id = stageId(index);
    const base = {
      id,
      name: stage.name,
      status: progress.status,
      checklist: stage.checklist.map((text, i) => {
        const done = i < progress.doneItems;
        return {
          id: `${id}_item_${i + 1}`,
          text,
          done,
          doneAt: done ? isoAt(progress.completedOffset ?? -1) : null,
          doneBy: null,
        };
      }),
      photos: [],
      completedAt:
        progress.status === "done" && progress.completedOffset !== null
          ? isoAt(progress.completedOffset)
          : null,
    };
    return index === project.visit.stageIndex ? { ...base, schedule: visit } : base;
  });

  // Os itens da obra saem da proposta pela MESMA função do backend, sem valor
  // nenhum; a situação de cada um vem do dataset.
  const content = proposalContent.get(project.proposalId)!;
  let itemSeq = 0;
  const baseItems = buildProjectItemsFromProposal(content, () => `${ds.idPrefix}_item_${++itemSeq}`);
  if (project.itemStatuses.length > baseItems.length) {
    throw new Error(
      `Demo ${ds.niche}: o andamento tem ${project.itemStatuses.length} itens e a proposta da obra tem ${baseItems.length}.`,
    );
  }
  const items: ProjectItem[] = baseItems.map((item, index) => {
    const status: ProjectItemStatus = project.itemStatuses[index] ?? "pending";
    return status === "pending"
      ? item
      : { ...item, status, statusAt: isoAt(-1 - (index % 3)), statusBy: null, statusByName: "Equipe Demo" };
  });

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
    stages,
    items,
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

  const scheduledStage = template[project.visit.stageIndex];
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
    projectStageId: stageId(project.visit.stageIndex),
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

  // Assistência técnica. O técnico é fictício: a conta free enxerga todas as
  // OS do tenant de demonstração (isDemoRead), então ninguém precisa estar em
  // `technicianUids`.
  const serviceById = new Map(ds.services.map((sv) => [sv.id, sv]));
  const sellingPrice = (kind: "product" | "service", id: string): { name: string; price: number } => {
    if (kind === "service") {
      const found = serviceById.get(id);
      if (!found) throw new Error(`Demo ${ds.niche}: serviço ${id} não existe no dataset.`);
      return { name: found.name, price: found.price };
    }
    const p = product(id);
    return { name: p.name, price: Math.round(p.price * (1 + (p.markup ?? 0) / 100) * 100) / 100 };
  };
  const equipmentById = new Map(ds.fieldService.equipment.map((e) => [e.id, e]));
  const addMonths = (day: string, months: number): string => {
    const d = new Date(`${day}T00:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() + months);
    return d.toISOString().slice(0, 10);
  };
  const lastService = new Map<string, { at: string; orderId: string }>();
  // O PMOC de exemplo: o plano e as visitas já feitas, que entram na fila de OS.
  const pmocPlans = new Map<string, DemoPmocPlan>();
  let nextVisitNumber = Math.max(0, ...ds.fieldService.orders.map((o) => o.number)) + 1;
  for (const c of ds.fieldService.contracts) {
    const plan = buildDemoPmocPlan({
      contract: c,
      equipmentTypes: c.equipmentIds.map((id) => equipmentById.get(id)?.type ?? null).filter((t): t is string => Boolean(t)),
      today: ymd(0),
      firstOrderNumber: nextVisitNumber,
    });
    if (!plan) continue;
    pmocPlans.set(c.id, plan);
    nextVisitNumber += plan.visits.length;
  }
  const allOrders: EngineOrder[] = [
    ...ds.fieldService.orders,
    ...Array.from(pmocPlans.values()).flatMap((plan) => plan.visits),
  ];
  allOrders.forEach((o) => {
    const c = client(o.clientId);
    const items: ServiceOrderItem[] = o.items.map((item, i) => {
      const priced = sellingPrice(item.kind, item.refId);
      return {
        id: `${o.id}_item_${i + 1}`,
        kind: item.kind,
        refId: item.refId,
        name: priced.name,
        quantity: item.quantity,
        unitPrice: priced.price,
        fromStock: item.kind === "product",
      };
    });
    const checklist = o.checklist.map((entry, i) => ({
      id: o.checklistIds?.[i] ?? `${o.id}_check_${i + 1}`,
      text: entry.text,
      done: entry.done,
      note: null,
    }));
    const equipmentLabels = o.equipmentIds.map((id) => {
      const e = equipmentById.get(id);
      if (!e) throw new Error(`Demo ${ds.niche}: equipamento ${id} não existe no dataset.`);
      return `${e.name} (${e.brand} ${e.model})`;
    });
    const scheduledStart = o.schedule
      ? new Date(`${ymd(o.schedule.dayOffset)}T${String(o.schedule.hour).padStart(2, "0")}:00:00-03:00`).toISOString()
      : null;
    const scheduledEnd =
      o.schedule && scheduledStart
        ? new Date(Date.parse(scheduledStart) + o.schedule.durationMin * 60_000).toISOString()
        : null;
    const completed = o.status === "completed";
    const code = formatOrderCode(o.number);
    const checkInAt = completed && scheduledStart ? scheduledStart : null;
    const checkOutAt = completed && scheduledEnd ? scheduledEnd : null;
    const report = o.report ?? null;
    if (completed && checkOutAt) {
      for (const id of o.equipmentIds) lastService.set(id, { at: checkOutAt, orderId: o.id });
    }
    set(`service_orders/${o.id}`, {
      ...tenantTag,
      number: o.number,
      code,
      clientId: c.id,
      clientName: c.name,
      clientPhone: c.phone,
      address: null,
      type: o.type,
      priority: o.priority,
      status: o.status,
      title: o.title,
      description: o.description,
      equipmentIds: o.equipmentIds,
      equipmentLabels,
      projectId: null,
      ...(o.contractId ? { contractId: o.contractId } : {}),
      technicianUids: [],
      technicianName: "Diego Lima",
      scheduledStart,
      scheduledEnd,
      checklist,
      items,
      totals: computeOrderTotals(items),
      photos: [],
      report,
      checkInAt,
      checkOutAt,
      signature:
        completed && o.signedBy
          ? {
              name: o.signedBy,
              document: null,
              imageUrl: DEMO_SIGNATURE_DATA_URL,
              storagePath: "",
              signedAt: checkOutAt,
              ip: null,
              userAgent: null,
              contentHash: signatureContentHash({
                code,
                clientId: c.id,
                equipmentIds: o.equipmentIds,
                items,
                checklist,
                report,
                checkInAt,
                checkOutAt,
              }),
            }
          : null,
      noSignatureReason: null,
      stockApplied: {},
      stockRevision: completed ? 1 : 0,
      completedAt: completed ? checkOutAt : null,
      canceledAt: null,
      reopenLog: [],
      createdAt: isoAt(-o.createdDaysAgo),
      updatedAt: isoAt(-o.createdDaysAgo),
      createdBy: null,
    });
  });
  ds.fieldService.equipment.forEach((e) => {
    const c = client(e.clientId);
    const installedAt = ymd(-e.installedDaysAgo);
    const last = lastService.get(e.id);
    set(`customer_equipment/${e.id}`, {
      ...tenantTag,
      clientId: c.id,
      clientName: c.name,
      name: e.name,
      type: e.type,
      brand: e.brand,
      model: e.model,
      serialNumber: e.serialNumber ?? null,
      capacity: e.capacity ?? null,
      location: e.location,
      installedAt,
      warrantyUntil: addMonths(installedAt, e.warrantyMonths),
      notes: null,
      status: "active",
      projectId: null,
      lastServiceAt: last?.at ?? null,
      lastServiceOrderId: last?.orderId ?? null,
      createdAt: isoAt(-e.installedDaysAgo),
      updatedAt: isoAt(-e.installedDaysAgo),
      createdBy: null,
    });
  });
  // Contratos: ativos há três meses, com as duas últimas mensalidades pagas e
  // a próxima no dia de vencimento do mês que vem.
  ds.fieldService.contracts.forEach((c) => {
    const cl = client(c.clientId);
    const lines = c.lines.map((line, i) => {
      const found = serviceById.get(line.refId);
      if (!found) throw new Error(`Demo ${ds.niche}: serviço ${line.refId} não existe no dataset.`);
      return { id: `line_${i}`, kind: "service" as const, refId: line.refId, name: found.name, quantity: line.quantity, unitPrice: line.unitPrice };
    });
    const monthlyAmount = computeMonthlyAmount(lines);
    const today = ymd(0);
    const thisMonthDue = addMonthsOnDay(today, 0, c.billingDay);
    const lastDue = thisMonthDue <= today ? thisMonthDue : addMonthsOnDay(today, -1, c.billingDay);
    const dues = Array.from({ length: DEMO_PAID_CHARGES }, (_, i) =>
      addMonthsOnDay(lastDue, i - (DEMO_PAID_CHARGES - 1), c.billingDay),
    );
    const startDate = addMonthsOnDay(lastDue, -2, c.billingDay);
    const pmocPlan = pmocPlans.get(c.id);
    const defaultNextVisit =
      c.visitIntervalMonths !== null ? addMonthsOnDay(today, 1, Math.min(Number(today.slice(8, 10)), 28)) : null;
    set(`service_contracts/${c.id}`, {
      ...tenantTag,
      number: c.number,
      code: formatContractCode(c.number),
      clientId: cl.id,
      clientName: cl.name,
      title: c.title,
      type: c.type,
      status: "active",
      lines,
      monthlyAmount,
      billingDay: c.billingDay,
      // O contrato guarda o id; o lançamento, o nome (convenção da demonstração).
      wallet: mainWallet.id,
      issueNfse: false,
      equipmentIds: c.equipmentIds,
      visitPlan: {
        enabled: c.visitIntervalMonths !== null,
        intervalMonths: c.visitIntervalMonths ?? 3,
        technicianId: null,
        checklist: c.visitChecklist,
        nextVisitDate: pmocPlan ? pmocPlan.nextVisitDate : defaultNextVisit,
      },
      ...(pmocPlan && c.pmoc
        ? {
            pmoc: {
              responsibleId: c.pmoc.responsibleId,
              building: { ...c.pmoc.building, address: null },
              items: pmocPlan.items,
              anchorDate: pmocPlan.anchorDate,
            },
          }
        : {}),
      notes: null,
      startDate,
      endDate: null,
      nextBillingDate: addMonthsOnDay(lastDue, 1, c.billingDay),
      lastBilledPeriod: periodOf(lastDue),
      suspendedReason: null,
      proposalId: null,
      createdAt: `${startDate}T12:00:00.000Z`,
      updatedAt: `${lastDue}T12:00:00.000Z`,
      createdBy: null,
    });
    for (const due of dues) {
      const period = periodOf(due);
      set(`transactions/${chargeTransactionId(c.id, period)}`, {
        ...tenantTag,
        type: "income",
        description: `${c.title} (${formatPeriod(period)})`,
        amount: monthlyAmount,
        date: addMonthsOnDay(due, 0, 1),
        dueDate: due,
        status: "paid",
        paidAt: `${due}T15:00:00.000Z`,
        clientId: cl.id,
        clientName: cl.name,
        proposalId: null,
        category: CONTRACT_INCOME_CATEGORY,
        wallet: mainWallet.name,
        isDownPayment: false,
        isInstallment: false,
        isRecurring: false,
        installmentCount: null,
        installmentNumber: null,
        installmentGroupId: null,
        recurringGroupId: null,
        paymentMode: null,
        notes: `Mensalidade do contrato ${formatContractCode(c.number)}.`,
        extraCosts: [],
        serviceContractId: c.id,
        contractPeriod: period,
        grouped: false,
        createdAt: `${due}T09:00:00.000Z`,
        updatedAt: `${due}T15:00:00.000Z`,
        createdById: "system",
      });
    }
  });

  for (const r of ds.fieldService.technicalResponsibles ?? []) {
    set(`technical_responsibles/${r.id}`, {
      ...tenantTag,
      name: r.name,
      profession: r.profession,
      council: r.council,
      registryNumber: r.registryNumber,
      artNumber: r.artNumber,
      artValidUntil: addMonthsOnDay(ymd(0), r.artValidMonths, Math.min(Number(ymd(0).slice(8, 10)), 28)),
      artFile: null,
      active: true,
      createdAt: isoAt(-120),
      updatedAt: isoAt(-120),
      createdBy: null,
    });
  }

  set(`service_order_counters/${ds.tenantId}`, {
    ...tenantTag,
    nextNumber: Math.max(0, ...allOrders.map((o) => o.number)) + 1,
    nextContractNumber: Math.max(0, ...ds.fieldService.contracts.map((c) => c.number)) + 1,
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
    equipment: ds.fieldService.equipment.length,
    serviceOrders:
      ds.fieldService.orders.length +
      ds.fieldService.contracts.reduce((sum, c) => sum + (c.pmoc?.visitsDone ?? 0), 0),
    contracts: ds.fieldService.contracts.length,
    ...(ds.fieldService.technicalResponsibles
      ? { technicalResponsibles: ds.fieldService.technicalResponsibles.length }
      : {}),
  };
}
