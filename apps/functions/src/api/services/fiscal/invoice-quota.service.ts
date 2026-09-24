/**
 * Franquia mensal de notas do add-on fiscal.
 *
 * O Enterprise emite sem teto (`maxInvoicesPerMonth: -1`). Starter e Pro so
 * emitem com o add-on, que da 100 notas por mes: cada nota consome uma unidade
 * paga no Focus NFe, e o preco do add-on foi calculado sobre essa franquia.
 *
 * A contagem e feita na hora, por `count()` sobre `invoices`, e nao por um
 * contador mantido a parte: a nota ja e um documento, e um contador separado
 * seria uma segunda fonte da verdade que pode divergir da primeira.
 */

import { db } from "../../../init";
import { resolveTenantCapabilities } from "../../../lib/tenant-capabilities";
import type { FiscalInvoiceStatus } from "./fiscal-types";

/**
 * Status que provam que a nota chegou ao provedor. Rascunho nunca saiu daqui;
 * rejeitada e com erro ficam de fora para uma rejeicao da SEFAZ nao comer a
 * franquia de quem so esta corrigindo um cadastro.
 */
export const QUOTA_CONSUMING_STATUSES: FiscalInvoiceStatus[] = [
  "processing",
  "authorized",
  "cancelled",
];

const BRASILIA_OFFSET_HOURS = 3;

/**
 * Inicio do mes corrente NO FUSO DE BRASILIA, como ISO em UTC (o formato em
 * que `createdAt` e gravado). Virar o mes pelo relogio UTC liberaria a
 * franquia nova as 21h do ultimo dia.
 */
export function brasiliaMonthStartIso(now: Date = new Date()): string {
  const brasilia = new Date(now.getTime() - BRASILIA_OFFSET_HOURS * 3_600_000);
  return new Date(
    Date.UTC(
      brasilia.getUTCFullYear(),
      brasilia.getUTCMonth(),
      1,
      BRASILIA_OFFSET_HOURS,
    ),
  ).toISOString();
}

export async function countInvoicesThisMonth(
  tenantId: string,
  now: Date = new Date(),
): Promise<number> {
  // `orderBy` explicito e DESC: e a direcao do indice
  // (tenantId, status, createdAt DESC) que ja existe. Sem ele o Firestore
  // assumiria ASC e pediria um indice novo, que so aparece em runtime.
  const snap = await db
    .collection("invoices")
    .where("tenantId", "==", tenantId)
    .where("status", "in", QUOTA_CONSUMING_STATUSES)
    .where("createdAt", ">=", brasiliaMonthStartIso(now))
    .orderBy("createdAt", "desc")
    .count()
    .get();
  return snap.data().count;
}

export interface InvoiceQuota {
  /** -1 = ilimitado. */
  limit: number;
  used: number;
}

export async function getInvoiceQuota(tenantId: string): Promise<InvoiceQuota> {
  const { limits } = await resolveTenantCapabilities(tenantId);
  const limit = limits.maxInvoicesPerMonth;
  if (limit === -1) return { limit, used: 0 };
  return { limit, used: await countInvoicesThisMonth(tenantId) };
}

export class InvoiceQuotaError extends Error {
  constructor(
    readonly used: number,
    readonly limit: number,
  ) {
    super("FISCAL_COTA_MENSAL_ATINGIDA");
  }
}

/** Quantas notas ainda cabem no mes. `Infinity` para o ilimitado. */
export function remainingInvoices(quota: InvoiceQuota): number {
  if (quota.limit === -1) return Infinity;
  return Math.max(0, quota.limit - quota.used);
}

/**
 * Lanca se `needed` notas nao couberem na franquia do mes. Uma venda mista
 * pede DUAS de uma vez: as duas cabem ou nenhuma sai, pela mesma regra de
 * tudo-ou-nada da emissao.
 */
export async function assertInvoiceQuota(
  tenantId: string,
  needed: number,
): Promise<void> {
  const quota = await getInvoiceQuota(tenantId);
  if (remainingInvoices(quota) < needed) {
    throw new InvoiceQuotaError(quota.used, quota.limit);
  }
}
