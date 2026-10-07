import { createHash } from "node:crypto";
import { z } from "zod";
import { isValidCpfOrCnpj } from "../../../lib/br-document";

/**
 * Assistência técnica: os equipamentos instalados em cada cliente e a ordem de
 * serviço (OS) que os atende. Capacidade `fieldService`, pageIds `equipment`,
 * `service_orders` e o escopo `service_orders_all`.
 *
 * Este arquivo é puro: esquemas de entrada, transições de status, totais e o
 * cálculo da baixa de estoque. Quem lê e grava o Firestore é
 * `field-service.service.ts`.
 */

export const EQUIPMENT_COLLECTION = "customer_equipment";
export const SERVICE_ORDERS_COLLECTION = "service_orders";
export const SERVICE_ORDER_COUNTERS_COLLECTION = "service_order_counters";
export const STOCK_MOVEMENTS_COLLECTION = "stock_movements";

export const SERVICE_ORDER_TYPES = ["corrective", "preventive", "installation", "inspection"] as const;
export type ServiceOrderType = (typeof SERVICE_ORDER_TYPES)[number];

export const SERVICE_ORDER_PRIORITIES = ["low", "normal", "high", "urgent"] as const;
export type ServiceOrderPriority = (typeof SERVICE_ORDER_PRIORITIES)[number];

export const SERVICE_ORDER_STATUSES = [
  "open",
  "scheduled",
  "in_progress",
  "completed",
  "canceled",
] as const;
export type ServiceOrderStatus = (typeof SERVICE_ORDER_STATUSES)[number];

export const MAX_ORDER_ITEMS = 60;
export const MAX_ORDER_CHECKLIST = 60;
export const MAX_ORDER_PHOTOS = 30;
export const MAX_ORDER_EQUIPMENT = 30;

export interface ServiceOrderChecklistItem {
  id: string;
  text: string;
  done: boolean;
  note: string | null;
}

export interface ServiceOrderItem {
  id: string;
  kind: "product" | "service";
  /** Produto ou serviço do catálogo. Ausente num item digitado à mão. */
  refId: string | null;
  name: string;
  quantity: number;
  unitPrice: number;
  /** Só produto: a peça sai do estoque quando a OS é concluída. */
  fromStock: boolean;
}

export interface ServiceOrderPhoto {
  id: string;
  url: string;
  storagePath: string;
  caption: string | null;
  uploadedAt: string;
  uploadedBy: string;
}

export interface ServiceOrderSignature {
  name: string;
  document: string | null;
  imageUrl: string;
  storagePath: string;
  signedAt: string;
  ip: string | null;
  userAgent: string | null;
  /** SHA-256 do conteúdo da OS no instante da assinatura (`signatureContentHash`). */
  contentHash: string;
}

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

/**
 * Para onde cada status pode ir pela ação "mudar status". Concluir não está
 * aqui: tem endpoint próprio, porque leva assinatura e baixa de estoque. E uma
 * OS concluída só volta pela reabertura, que é do master.
 */
const TRANSITIONS: Record<ServiceOrderStatus, readonly ServiceOrderStatus[]> = {
  open: ["scheduled", "in_progress", "canceled"],
  scheduled: ["open", "in_progress", "canceled"],
  in_progress: ["scheduled", "open", "canceled"],
  completed: [],
  canceled: ["open"],
};

export function canTransition(from: ServiceOrderStatus, to: ServiceOrderStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function isClosedStatus(status: ServiceOrderStatus): boolean {
  return status === "completed" || status === "canceled";
}

// ---------------------------------------------------------------------------
// Totais e estoque
// ---------------------------------------------------------------------------

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Chave de um item do catálogo: tipo e id do produto ou serviço. */
export function catalogKey(kind: ServiceOrderItem["kind"], refId: string): string {
  return `${kind}:${refId}`;
}

/**
 * O técnico lança peças e serviços, mas não muda o valor: o total da OS é o
 * que o cliente assina e o que vai para o financeiro. Até 2026-10 o
 * `ExecutionUpdateSchema` aceitava `unitPrice` do técnico.
 *
 * - item que já estava na OS mantém o valor gravado;
 * - item novo do catálogo entra com o preço do catálogo (`catalogPrices`);
 * - item novo digitado à mão entra com valor zero, para quem coordena
 *   precificar.
 */
export function lockTechnicianItemPrices(
  next: readonly ServiceOrderItem[],
  current: readonly ServiceOrderItem[],
  catalogPrices: ReadonlyMap<string, number>,
): ServiceOrderItem[] {
  const currentById = new Map(current.map((item) => [item.id, item]));
  return next.map((item) => {
    const existing = currentById.get(item.id);
    if (existing) return { ...item, unitPrice: existing.unitPrice };
    const catalogPrice = item.refId ? catalogPrices.get(catalogKey(item.kind, item.refId)) : undefined;
    return { ...item, unitPrice: catalogPrice ?? 0 };
  });
}

export function computeOrderTotals(items: readonly ServiceOrderItem[]): {
  products: number;
  services: number;
  total: number;
} {
  let products = 0;
  let services = 0;
  for (const item of items) {
    const line = item.quantity * item.unitPrice;
    if (item.kind === "product") products += line;
    else services += line;
  }
  return {
    products: roundMoney(products),
    services: roundMoney(services),
    total: roundMoney(products + services),
  };
}

/**
 * Quanto de cada produto a OS consome do estoque. Serviço, item digitado à mão
 * e peça marcada como "não sai do estoque" ficam de fora.
 */
export function stockConsumption(items: readonly ServiceOrderItem[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const item of items) {
    if (item.kind !== "product" || !item.fromStock || !item.refId) continue;
    out[item.refId] = (out[item.refId] ?? 0) + item.quantity;
  }
  return out;
}

/**
 * A diferença entre o que a OS deveria ter tirado do estoque e o que já tirou.
 *
 * É o que torna a baixa idempotente: concluir, reabrir, trocar uma peça e
 * concluir de novo lança só a diferença; cancelar uma OS reaberta devolve tudo
 * (o desejado passa a ser zero). Positivo = sai do estoque.
 */
export function stockDelta(
  desired: Record<string, number>,
  applied: Record<string, number>,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const id of new Set([...Object.keys(desired), ...Object.keys(applied)])) {
    const delta = Math.round(((desired[id] ?? 0) - (applied[id] ?? 0)) * 1000) / 1000;
    if (delta !== 0) out[id] = delta;
  }
  return out;
}

/** Id do movimento de estoque: uma baixa por produto por conclusão, sem duplicar. */
export function stockMovementId(orderId: string, revision: number, productId: string): string {
  return `so_${orderId}_${revision}_${productId}`;
}

export function formatOrderCode(number: number): string {
  return `OS-${String(number).padStart(4, "0")}`;
}

/**
 * O que a assinatura do cliente atesta. Qualquer mudança nestes campos depois
 * da assinatura muda o hash, e é por isso que a OS assinada fica travada.
 */
export function signatureContentHash(order: {
  code?: unknown;
  clientId?: unknown;
  equipmentIds?: unknown;
  items?: unknown;
  checklist?: unknown;
  report?: unknown;
  checkInAt?: unknown;
  checkOutAt?: unknown;
}): string {
  const canonical = JSON.stringify([
    order.code ?? null,
    order.clientId ?? null,
    order.equipmentIds ?? [],
    order.items ?? [],
    order.checklist ?? [],
    order.report ?? null,
    order.checkInAt ?? null,
    order.checkOutAt ?? null,
  ]);
  return createHash("sha256").update(canonical).digest("hex");
}

/**
 * O documento da OS recém-aberta. Um só formato para a OS aberta pela tela e
 * para a visita preventiva que o contrato abre sozinho.
 */
export function newServiceOrderDoc(p: {
  tenantId: string;
  number: number;
  code: string;
  client: { id: string; name: string; phone: string | null };
  address: string | null;
  type: ServiceOrderType;
  priority: ServiceOrderPriority;
  title: string;
  description: string | null;
  equipment: { id: string; label: string }[];
  projectId: string | null;
  contractId: string | null;
  technician: { technicianUids: string[]; technicianName: string | null };
  scheduledStart: string | null;
  scheduledEnd: string | null;
  checklist: ServiceOrderChecklistItem[];
  items: ServiceOrderItem[];
  createdBy: string;
  now: string;
}): Record<string, unknown> {
  return {
    tenantId: p.tenantId,
    number: p.number,
    code: p.code,
    clientId: p.client.id,
    clientName: p.client.name,
    clientPhone: p.client.phone,
    address: p.address,
    type: p.type,
    priority: p.priority,
    status: p.scheduledStart ? "scheduled" : "open",
    title: p.title,
    description: p.description,
    equipmentIds: p.equipment.map((e) => e.id),
    equipmentLabels: p.equipment.map((e) => e.label),
    projectId: p.projectId,
    contractId: p.contractId,
    ...p.technician,
    scheduledStart: p.scheduledStart,
    scheduledEnd: p.scheduledEnd,
    checklist: p.checklist,
    items: p.items,
    totals: computeOrderTotals(p.items),
    photos: [],
    report: null,
    checkInAt: null,
    checkOutAt: null,
    signature: null,
    noSignatureReason: null,
    stockApplied: {},
    stockRevision: 0,
    completedAt: null,
    canceledAt: null,
    reopenLog: [],
    createdAt: p.now,
    updatedAt: p.now,
    createdBy: p.createdBy,
  };
}

// ---------------------------------------------------------------------------
// Entrada da API
// ---------------------------------------------------------------------------

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const optionalDay = z.string().regex(ISO_DAY, "Data inválida.").nullable().optional();
const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();
const isoDateTime = z
  .string()
  .refine((v) => !Number.isNaN(Date.parse(v)), "Data e hora inválidas.");

export const EquipmentSchema = z
  .object({
    clientId: z.string().trim().min(1, "Escolha o cliente."),
    name: z.string().trim().min(2, "Dê um nome ao equipamento.").max(120),
    type: optionalText(80),
    brand: optionalText(80),
    model: optionalText(80),
    serialNumber: optionalText(80),
    capacity: optionalText(60),
    location: optionalText(120),
    installedAt: optionalDay,
    warrantyUntil: optionalDay,
    notes: optionalText(2000),
    status: z.enum(["active", "inactive"]).optional(),
    projectId: z.string().trim().min(1).nullable().optional(),
  })
  .strict();

export const UpdateEquipmentSchema = EquipmentSchema.partial().strict();

/** Os aparelhos de uma obra entregue, registrados de uma vez. */
export const MAX_EQUIPMENT_BATCH = 50;
export const EquipmentBatchSchema = z
  .object({
    clientId: z.string().trim().min(1, "A obra precisa de um cliente."),
    projectId: z.string().trim().min(1).nullable().optional(),
    items: z
      .array(EquipmentSchema.omit({ clientId: true, projectId: true, status: true }))
      .min(1, "Escolha ao menos um equipamento.")
      .max(MAX_EQUIPMENT_BATCH, `No máximo ${MAX_EQUIPMENT_BATCH} equipamentos por vez.`),
  })
  .strict();

const ItemSchema = z
  .object({
    id: z.string().trim().min(1).max(64),
    kind: z.enum(["product", "service"]),
    refId: z.string().trim().min(1).max(128).nullable(),
    name: z.string().trim().min(1, "Dê um nome ao item.").max(160),
    quantity: z.number().positive("A quantidade precisa ser maior que zero.").max(100_000),
    unitPrice: z.number().min(0).max(100_000_000),
    fromStock: z.boolean(),
  })
  .strict();

const ChecklistSchema = z
  .object({
    id: z.string().trim().min(1).max(64),
    text: z.string().trim().min(1).max(200),
    done: z.boolean(),
    note: optionalText(500).transform((v) => v ?? null),
  })
  .strict();

export const CreateServiceOrderSchema = z
  .object({
    clientId: z.string().trim().min(1, "Escolha o cliente."),
    type: z.enum(SERVICE_ORDER_TYPES),
    priority: z.enum(SERVICE_ORDER_PRIORITIES).optional(),
    title: z.string().trim().min(2, "Descreva o chamado.").max(160),
    description: optionalText(4000),
    equipmentIds: z.array(z.string().trim().min(1)).max(MAX_ORDER_EQUIPMENT).optional(),
    technicianId: z.string().trim().min(1).nullable().optional(),
    scheduledStart: isoDateTime.nullable().optional(),
    scheduledEnd: isoDateTime.nullable().optional(),
    address: optionalText(300),
    projectId: z.string().trim().min(1).nullable().optional(),
    checklist: z.array(ChecklistSchema).max(MAX_ORDER_CHECKLIST).optional(),
    items: z.array(ItemSchema).max(MAX_ORDER_ITEMS).optional(),
  })
  .strict();

/**
 * O que a coordenação edita. O técnico sem o escopo `service_orders_all` só
 * mexe na execução (`ExecutionUpdateSchema`): cliente, técnico e agenda não
 * são dele.
 */
export const UpdateServiceOrderSchema = CreateServiceOrderSchema.partial()
  .extend({
    report: optionalText(8000),
  })
  .strict();

export const ExecutionUpdateSchema = z
  .object({
    checklist: z.array(ChecklistSchema).max(MAX_ORDER_CHECKLIST).optional(),
    items: z.array(ItemSchema).max(MAX_ORDER_ITEMS).optional(),
    report: optionalText(8000),
  })
  .strict();

export const ServiceOrderStatusSchema = z
  .object({ status: z.enum(["open", "scheduled", "in_progress", "canceled"]) })
  .strict();

export const CompleteServiceOrderSchema = z
  .object({
    signature: z
      .object({
        name: z.string().trim().min(3, "Informe o nome de quem assina.").max(120),
        document: z
          .string()
          .trim()
          .refine((v) => v === "" || isValidCpfOrCnpj(v), "CPF ou CNPJ inválido.")
          .optional(),
        /** PNG do traço, desenhado no navegador. */
        imageDataUrl: z.string().min(1).max(400_000),
      })
      .strict()
      .optional(),
    /** Cliente ausente: a OS fecha sem assinatura, com o motivo registrado. */
    noSignatureReason: z.string().trim().min(3).max(300).optional(),
  })
  .strict()
  .refine((v) => Boolean(v.signature) !== Boolean(v.noSignatureReason), {
    message: "Colete a assinatura do cliente ou informe por que ela não foi colhida.",
  });

export const ReopenServiceOrderSchema = z
  .object({ reason: z.string().trim().min(3, "Diga por que a OS foi reaberta.").max(300) })
  .strict();

export const MAX_LAUNCH_INSTALLMENTS = 60;

/**
 * Lançar a OS concluída no financeiro: à vista, parcelado, com ou sem entrada.
 * `status` e `dueDate` são da parcela única, ou da primeira parcela quando é
 * parcelado (as seguintes nascem pendentes, mês a mês).
 */
export const LaunchTransactionSchema = z
  .object({
    wallet: z.string().trim().min(1, "Escolha a carteira."),
    status: z.enum(["paid", "pending"]),
    dueDate: z.string().regex(ISO_DAY, "Data inválida."),
    installments: z
      .number()
      .int()
      .min(1)
      .max(MAX_LAUNCH_INSTALLMENTS, `No máximo ${MAX_LAUNCH_INSTALLMENTS} parcelas.`)
      .optional(),
    downPayment: z
      .object({
        amount: z.number().positive("Informe o valor da entrada."),
        dueDate: z.string().regex(ISO_DAY, "Data inválida."),
        status: z.enum(["paid", "pending"]),
      })
      .strict()
      .optional(),
  })
  .strict();

export type LaunchTransactionInput = z.infer<typeof LaunchTransactionSchema>;

/**
 * O que o serviço de lançamentos recebe, montado como a tela de Novo
 * lançamento monta (`useTransactionForm`): o restante (total menos a entrada)
 * dividido pelas parcelas, arredondado uma vez em centavos, e a entrada como
 * `downPayment` no mesmo grupo. Montar igual à tela é o que faz a série
 * aparecer do mesmo jeito na aba Agrupados e nos cartões de parcela.
 */
export function buildLaunchPlan(params: {
  total: number;
  input: LaunchTransactionInput;
  groupId: string;
}): {
  amount: number;
  installmentCount: number;
  isInstallment: boolean;
  installmentGroupId?: string;
  installmentNumber?: number;
  downPayment?: { amount: number; dueDate: string; status: "paid" | "pending"; installmentCount: number };
} {
  const { total, input } = params;
  const down = input.downPayment?.amount ?? 0;
  if (down >= total) throw new Error("A entrada precisa ser menor que o total da OS.");
  const count = input.installments ?? 1;
  const amount = Math.round(((total - down) / count) * 100) / 100;
  const grouped = count > 1 || down > 0;
  return {
    amount,
    installmentCount: count,
    isInstallment: count > 1,
    installmentGroupId: grouped ? params.groupId : undefined,
    // Só entrada e o restante à vista: a tela numera o restante como 1.
    installmentNumber: count === 1 && down > 0 ? 1 : undefined,
    downPayment: input.downPayment
      ? {
          amount: down,
          dueDate: input.downPayment.dueDate,
          status: input.downPayment.status,
          installmentCount: count + 1,
        }
      : undefined,
  };
}

/** Categoria da receita da OS no DRE (fora da lista da empresa, cai em Receita bruta). */
export const SERVICE_ORDER_INCOME_CATEGORY = "Ordens de serviço";

export const PhotoUploadSchema = z
  .object({
    dataUrl: z.string().min(1).max(1_000_000),
    caption: z.string().trim().max(200).optional(),
  })
  .strict();

const SIGNATURE_PNG = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/;
export const SIGNATURE_MAX_BYTES = 250 * 1024;

/** Decodifica o PNG da assinatura, recusando o que não for imagem pequena. */
export function decodeSignatureDataUrl(dataUrl: string): Buffer | null {
  const match = SIGNATURE_PNG.exec(dataUrl);
  if (!match) return null;
  const buffer = Buffer.from(match[1], "base64");
  if (buffer.length === 0 || buffer.length > SIGNATURE_MAX_BYTES) return null;
  // Assinatura PNG: 89 50 4E 47. Um data URL que se diz PNG e não é fica de fora.
  if (buffer[0] !== 0x89 || buffer[1] !== 0x50 || buffer[2] !== 0x4e || buffer[3] !== 0x47) return null;
  return buffer;
}
