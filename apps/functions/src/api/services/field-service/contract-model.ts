import { z } from "zod";

/**
 * Contratos de manutenção: a mensalidade que a empresa cobra todo mês
 * (monitoramento, manutenção, suporte, PMOC) e as visitas preventivas que o
 * contrato promete. Capacidade `fieldService`, pageId `contracts`.
 *
 * Este arquivo é puro: esquemas de entrada, transições, as datas de cobrança e
 * de visita, e o lançamento que a rotina diária grava. Quem lê e grava o
 * Firestore é `contract.service.ts`.
 *
 * Datas são dias no fuso de Brasília ("AAAA-MM-DD"), comparadas como texto.
 */

export const SERVICE_CONTRACTS_COLLECTION = "service_contracts";

/** Categoria da mensalidade no DRE (fora da lista da empresa, cai em Receita bruta). */
export const CONTRACT_INCOME_CATEGORY = "Contratos";

/** A cobrança aparece no financeiro (e o link pode ser mandado) dez dias antes do vencimento. */
export const BILLING_LEAD_DAYS = 10;

/** A OS da visita preventiva nasce uma semana antes, para caber na agenda do técnico. */
export const VISIT_LEAD_DAYS = 7;

/**
 * Teto de mensalidades que uma execução da rotina grava por contrato. Cobre a
 * rotina fora do ar por alguns dias; um contrato com início muito antigo não
 * despeja um ano de cobranças de uma vez.
 */
export const MAX_CHARGES_PER_RUN = 3;

export const CONTRACT_TYPES = ["monitoring", "maintenance", "support", "pmoc", "other"] as const;
export type ContractType = (typeof CONTRACT_TYPES)[number];

export const CONTRACT_STATUSES = ["draft", "active", "suspended", "ended"] as const;
export type ContractStatus = (typeof CONTRACT_STATUSES)[number];

export const VISIT_INTERVALS = [1, 2, 3, 4, 6, 12] as const;

export const MAX_CONTRACT_LINES = 30;
export const MAX_CONTRACT_EQUIPMENT = 100;
export const MAX_VISIT_CHECKLIST = 60;

export interface ContractLine {
  id: string;
  kind: "product" | "service";
  /** Item do catálogo; `null` para linha avulsa. */
  refId: string | null;
  name: string;
  quantity: number;
  unitPrice: number;
}

export interface VisitPlan {
  enabled: boolean;
  intervalMonths: number;
  technicianId: string | null;
  /** Itens com que a OS preventiva nasce (vêm do nicho, editáveis no contrato). */
  checklist: string[];
  /** Próxima visita a virar OS. `null` enquanto o contrato não está ativo. */
  nextVisitDate: string | null;
}

export type SuspendedReason = "manual" | "plan";

export interface ServiceContract {
  id: string;
  tenantId: string;
  code: string;
  number: number;
  clientId: string;
  clientName: string;
  title: string;
  type: ContractType;
  status: ContractStatus;
  lines: ContractLine[];
  monthlyAmount: number;
  billingDay: number;
  wallet: string;
  issueNfse: boolean;
  equipmentIds: string[];
  visitPlan: VisitPlan;
  notes: string | null;
  startDate: string | null;
  endDate: string | null;
  nextBillingDate: string | null;
  lastBilledPeriod: string | null;
  suspendedReason: SuspendedReason | null;
  proposalId: string | null;
}

// ---------------------------------------------------------------------------
// Transições
// ---------------------------------------------------------------------------

const TRANSITIONS: Record<ContractStatus, readonly ContractStatus[]> = {
  draft: ["active", "ended"],
  active: ["suspended", "ended"],
  suspended: ["active", "ended"],
  ended: [],
};

export function canContractTransition(from: ContractStatus, to: ContractStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

// ---------------------------------------------------------------------------
// Valores
// ---------------------------------------------------------------------------

function cents(value: number): number {
  return Math.round(value * 100) / 100;
}

export function computeMonthlyAmount(lines: readonly Pick<ContractLine, "quantity" | "unitPrice">[]): number {
  return cents(lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0));
}

/**
 * As linhas marcadas como mensalidade na proposta viram as linhas do contrato.
 * Linha inativa ou sem quantidade fica de fora, como no total da proposta.
 */
export function monthlyLinesFromProposal(products: unknown): ContractLine[] {
  if (!Array.isArray(products)) return [];
  const lines: ContractLine[] = [];
  products.forEach((raw, index) => {
    if (!raw || typeof raw !== "object") return;
    const p = raw as Record<string, unknown>;
    if (p.isMonthly !== true || p.status === "inactive") return;
    const quantity = Number(p.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) return;
    const total = Number(p.total);
    const unitPrice = Number.isFinite(total) ? cents(total / quantity) : Number(p.unitPrice) || 0;
    lines.push({
      id: `proposal_${index}`,
      kind: p.itemType === "service" ? "service" : "product",
      refId: typeof p.productId === "string" && p.productId ? p.productId : null,
      name: String(p.productName ?? p.name ?? "Mensalidade").trim().slice(0, 160) || "Mensalidade",
      quantity,
      unitPrice,
    });
  });
  return lines;
}

// ---------------------------------------------------------------------------
// Datas
// ---------------------------------------------------------------------------

export const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

export function todayInBrazil(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(now);
}

export function addDays(day: string, days: number): string {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** O mesmo dia `dayOfMonth` dali a `months` meses (o dia vai até 28, então existe em todo mês). */
export function addMonthsOnDay(day: string, months: number, dayOfMonth: number): string {
  const [year, month] = day.split("-").map(Number);
  const index = year * 12 + (month - 1) + months;
  const y = Math.floor(index / 12);
  const m = (index % 12) + 1;
  return `${y}-${String(m).padStart(2, "0")}-${String(dayOfMonth).padStart(2, "0")}`;
}

/** "2026-10-05" → "2026-10". */
export function periodOf(day: string): string {
  return day.slice(0, 7);
}

/** "2026-10" → "10/2026". */
export function formatPeriod(period: string): string {
  const [year, month] = period.split("-");
  return `${month}/${year}`;
}

/** O primeiro dia de cobrança a partir do início (inclusive). */
export function firstBillingDate(startDate: string, billingDay: number): string {
  const sameMonth = addMonthsOnDay(startDate, 0, billingDay);
  return sameMonth >= startDate ? sameMonth : addMonthsOnDay(startDate, 1, billingDay);
}

/**
 * A próxima cobrança ao retomar um contrato suspenso: o primeiro dia de
 * cobrança a partir de hoje cujo mês ainda não foi cobrado. O período em que o
 * contrato ficou parado não é cobrado depois.
 */
export function resumeBillingDate(today: string, billingDay: number, lastBilledPeriod: string | null): string {
  let candidate = firstBillingDate(today, billingDay);
  while (lastBilledPeriod && periodOf(candidate) <= lastBilledPeriod) {
    candidate = addMonthsOnDay(candidate, 1, billingDay);
  }
  return candidate;
}

export interface DueCharge {
  dueDate: string;
  period: string;
}

/**
 * As mensalidades que a rotina deve lançar hoje: cada vencimento que já entrou
 * na janela de antecedência, sem passar do fim do contrato, até o teto por
 * execução. Devolve também a próxima cobrança depois delas e se o contrato
 * chegou ao fim.
 */
export function dueCharges(params: {
  nextBillingDate: string;
  billingDay: number;
  endDate: string | null;
  today: string;
}): { charges: DueCharge[]; nextBillingDate: string; ended: boolean } {
  const charges: DueCharge[] = [];
  let next = params.nextBillingDate;
  const horizon = addDays(params.today, BILLING_LEAD_DAYS);
  while (next <= horizon && charges.length < MAX_CHARGES_PER_RUN) {
    if (params.endDate && next > params.endDate) break;
    charges.push({ dueDate: next, period: periodOf(next) });
    next = addMonthsOnDay(next, 1, params.billingDay);
  }
  const ended = Boolean(params.endDate && next > params.endDate);
  return { charges, nextBillingDate: next, ended };
}

/**
 * A visita preventiva que deve virar OS hoje, se houver. Uma por execução: se
 * a rotina ficou parada, a seguinte sai na próxima execução, e não várias OS
 * atrasadas de uma vez.
 */
export function dueVisit(params: {
  plan: VisitPlan;
  endDate: string | null;
  today: string;
}): { visitDate: string; nextVisitDate: string } | null {
  const { plan } = params;
  if (!plan.enabled || !plan.nextVisitDate) return null;
  if (params.endDate && plan.nextVisitDate > params.endDate) return null;
  if (plan.nextVisitDate > addDays(params.today, VISIT_LEAD_DAYS)) return null;
  const day = Number(plan.nextVisitDate.slice(8, 10));
  return {
    visitDate: plan.nextVisitDate,
    nextVisitDate: addMonthsOnDay(plan.nextVisitDate, plan.intervalMonths, day > 28 ? 28 : day),
  };
}

// ---------------------------------------------------------------------------
// Identificadores determinísticos (a rotina pode rodar duas vezes no mesmo dia)
// ---------------------------------------------------------------------------

export function chargeTransactionId(contractId: string, period: string): string {
  return `contract_${contractId}_${period.replace("-", "")}`;
}

export function visitOrderId(contractId: string, visitDate: string): string {
  return `contract_${contractId}_visit_${visitDate.replace(/-/g, "")}`;
}

export function contractIdFromProposal(proposalId: string): string {
  return `proposal_${proposalId}`;
}

export function formatContractCode(number: number): string {
  return `CT-${String(number).padStart(4, "0")}`;
}

/**
 * O lançamento da mensalidade, no formato que a tela de lançamentos lê. Nasce
 * a receber e fora de qualquer série: `isRecurring` faria a recorrência do
 * financeiro criar outra parcela ao pagar, e quem cria a próxima é a rotina.
 * Sem `proposalId`, de propósito: a sincronização da proposta aprovada apaga
 * lançamento com esse campo que ela mesma não gerou.
 */
export function buildChargeTransaction(params: {
  contract: Pick<ServiceContract, "id" | "tenantId" | "title" | "code" | "clientId" | "clientName" | "monthlyAmount" | "wallet">;
  charge: DueCharge;
  today: string;
}): Record<string, unknown> {
  const { contract, charge } = params;
  return {
    tenantId: contract.tenantId,
    type: "income",
    description: `${contract.title} (${formatPeriod(charge.period)})`,
    amount: contract.monthlyAmount,
    date: params.today,
    dueDate: charge.dueDate,
    status: "pending",
    clientId: contract.clientId,
    clientName: contract.clientName,
    proposalId: null,
    category: CONTRACT_INCOME_CATEGORY,
    wallet: contract.wallet,
    isDownPayment: false,
    isInstallment: false,
    isRecurring: false,
    installmentCount: null,
    installmentNumber: null,
    installmentGroupId: null,
    recurringGroupId: null,
    paymentMode: null,
    notes: `Mensalidade do contrato ${contract.code}.`,
    extraCosts: [],
    serviceContractId: contract.id,
    contractPeriod: charge.period,
    createdById: "system",
  };
}

/** Só a passagem para pago de uma mensalidade de contrato interessa. */
export function becamePaidContractCharge(
  before: Record<string, unknown> | undefined,
  after: Record<string, unknown> | undefined,
): boolean {
  if (!after || typeof after.serviceContractId !== "string" || !after.serviceContractId) return false;
  return after.status === "paid" && before?.status !== "paid";
}

// ---------------------------------------------------------------------------
// Entrada da API
// ---------------------------------------------------------------------------

const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();

const LineSchema = z
  .object({
    id: z.string().trim().min(1).max(64),
    kind: z.enum(["product", "service"]),
    refId: z.string().trim().min(1).max(128).nullable(),
    name: z.string().trim().min(1, "Dê um nome ao item.").max(160),
    quantity: z.number().positive("A quantidade precisa ser maior que zero.").max(100_000),
    unitPrice: z.number().min(0).max(100_000_000),
  })
  .strict();

const VisitPlanSchema = z
  .object({
    enabled: z.boolean(),
    intervalMonths: z
      .number()
      .int()
      .refine((v) => (VISIT_INTERVALS as readonly number[]).includes(v), "Intervalo inválido."),
    technicianId: z.string().trim().min(1).nullable(),
    checklist: z.array(z.string().trim().min(1).max(200)).max(MAX_VISIT_CHECKLIST),
  })
  .strict();

export const CreateContractSchema = z
  .object({
    clientId: z.string().trim().min(1, "Escolha o cliente."),
    title: z.string().trim().min(2, "Dê um nome ao contrato.").max(160),
    type: z.enum(CONTRACT_TYPES),
    lines: z
      .array(LineSchema)
      .min(1, "O contrato precisa de ao menos um item.")
      .max(MAX_CONTRACT_LINES, `No máximo ${MAX_CONTRACT_LINES} itens.`),
    billingDay: z.number().int().min(1, "Dia inválido.").max(28, "Use um dia de 1 a 28."),
    wallet: z.string().trim().min(1, "Escolha a carteira."),
    issueNfse: z.boolean(),
    equipmentIds: z.array(z.string().trim().min(1)).max(MAX_CONTRACT_EQUIPMENT).optional(),
    visitPlan: VisitPlanSchema.optional(),
    notes: optionalText(4000),
    endDate: z.string().regex(ISO_DAY, "Data inválida.").nullable().optional(),
  })
  .strict();

export const UpdateContractSchema = CreateContractSchema.partial().strict();

export type CreateContractInput = z.infer<typeof CreateContractSchema>;

export const ActivateContractSchema = z
  .object({
    startDate: z.string().regex(ISO_DAY, "Data inválida."),
    /** Primeira visita preventiva; sem ela, um intervalo depois do início. */
    firstVisitDate: z.string().regex(ISO_DAY, "Data inválida.").nullable().optional(),
  })
  .strict();

/** Quanto o início pode ficar no passado: um mês de cobrança retroativa, no máximo. */
export const MAX_START_DAYS_AGO = 31;
