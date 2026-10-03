import { randomBytes } from "node:crypto";
import { db } from "../../../init";
import { resolveFrontendAppUrl } from "../../../lib/frontend-app-url";
import { renderPageToPdfBuffer, resolveAppBaseUrl } from "../core-pdf.service";
import {
  PMOC_CATEGORIES,
  PMOC_CATEGORY_LABELS,
  PMOC_FREQUENCY_LABELS,
} from "../../../shared/pmoc";
import { SERVICE_CONTRACTS_COLLECTION, type PmocData, type ServiceContract } from "./contract-model";
import { EQUIPMENT_COLLECTION, SERVICE_ORDERS_COLLECTION } from "./field-service-model";
import { loadClientSnapshot, loadOfTenant } from "./field-service.service";
import { itemExecutions, normalizeReportPeriod, reportVisits, type ReportPeriod } from "./pmoc-report";
import { TECHNICAL_RESPONSIBLES_COLLECTION } from "./technical-responsible-model";

/**
 * O documento do PMOC: o plano (o que fica à vista no prédio e é mostrado à
 * fiscalização) e o relatório de execução de um período. Um link público por
 * contrato abre os dois; o PDF é a mesma página impressa pelo Chromium.
 */

export const SHARED_PMOC_COLLECTION = "shared_pmoc";

/** Visitas lidas por relatório: dois anos de visitas mensais com folga. */
const MAX_REPORT_ORDERS = 200;

export function buildPmocShareUrl(token: string): string {
  return new URL(`/share/pmoc/${token}`, resolveFrontendAppUrl()).toString();
}

/** Um link por contrato, reaproveitado, no mesmo desenho do link da OS. */
export async function ensurePmocShareToken(params: {
  tenantId: string;
  contractId: string;
  uid: string | null;
}): Promise<string> {
  const ref = db.collection(SERVICE_CONTRACTS_COLLECTION).doc(params.contractId);
  return db.runTransaction(async (t) => {
    const snap = await t.get(ref);
    const current = snap.data()?.pmocShareToken;
    if (typeof current === "string" && current) return current;
    const token = randomBytes(24).toString("base64url");
    t.set(db.collection(SHARED_PMOC_COLLECTION).doc(token), {
      tenantId: params.tenantId,
      contractId: params.contractId,
      createdAt: new Date().toISOString(),
      createdBy: params.uid,
    });
    t.update(ref, { pmocShareToken: token });
    return token;
  });
}

export async function resolvePmocShareToken(token: string) {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return null;
  const snap = await db.collection(SHARED_PMOC_COLLECTION).doc(token).get();
  if (!snap.exists) return null;
  const data = snap.data() ?? {};
  const found = await loadOfTenant(SERVICE_CONTRACTS_COLLECTION, String(data.contractId), String(data.tenantId));
  if (!found || found.data.pmocShareToken !== token || found.data.type !== "pmoc") return null;
  return {
    tenantId: String(data.tenantId),
    contract: { ...(found.data as unknown as ServiceContract), id: found.ref.id },
  };
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * Tudo o que a página do PMOC mostra. Sem ids de membro, sem caminho de
 * Storage, sem valores da mensalidade: o PMOC é técnico, e o link é mostrado a
 * gente de fora (fiscalização, síndico, administração do prédio).
 */
export async function buildPmocView(params: {
  tenantId: string;
  contract: ServiceContract;
  from?: unknown;
  to?: unknown;
  today: string;
}) {
  const { tenantId, contract } = params;
  const pmoc = (contract.pmoc ?? null) as PmocData | null;
  const period: ReportPeriod = normalizeReportPeriod(params.from, params.to, params.today);

  const [tenantSnap, client, responsibleFound, equipmentSnaps, ordersSnap] = await Promise.all([
    db.collection("tenants").doc(tenantId).get(),
    loadClientSnapshot(contract.clientId, tenantId),
    pmoc?.responsibleId
      ? loadOfTenant(TECHNICAL_RESPONSIBLES_COLLECTION, pmoc.responsibleId, tenantId)
      : Promise.resolve(null),
    (contract.equipmentIds ?? []).length > 0
      ? db.getAll(...(contract.equipmentIds ?? []).map((id) => db.collection(EQUIPMENT_COLLECTION).doc(id)))
      : Promise.resolve([]),
    db
      .collection(SERVICE_ORDERS_COLLECTION)
      .where("tenantId", "==", tenantId)
      .where("contractId", "==", contract.id)
      .limit(MAX_REPORT_ORDERS)
      .get(),
  ]);

  const tenant = tenantSnap.data() ?? {};
  const responsible = responsibleFound?.data ?? null;
  const artFile = responsible?.artFile as { url?: unknown } | null | undefined;
  const items = pmoc?.items ?? [];
  const orders = ordersSnap.docs.map((d) => d.data() as Record<string, unknown>);

  return {
    tenant: {
      name: tenant.name ?? null,
      logoUrl: tenant.logoUrl ?? null,
      primaryColor: tenant.primaryColor ?? null,
    },
    contract: {
      code: contract.code,
      title: contract.title,
      status: contract.status,
      startDate: contract.startDate ?? null,
      intervalMonths: contract.visitPlan?.intervalMonths ?? null,
    },
    client: { name: client?.name ?? contract.clientName, address: client?.address ?? null },
    building: {
      name: pmoc?.building?.name ?? null,
      address: pmoc?.building?.address ?? client?.address ?? null,
      occupants: pmoc?.building?.occupants ?? null,
      climatizedArea: pmoc?.building?.climatizedArea ?? null,
      use: pmoc?.building?.use ?? null,
    },
    responsible: responsible
      ? {
          name: text(responsible.name),
          profession: text(responsible.profession),
          council: text(responsible.council),
          registryNumber: text(responsible.registryNumber),
          artNumber: text(responsible.artNumber),
          artValidUntil: text(responsible.artValidUntil),
          artUrl: typeof artFile?.url === "string" ? artFile.url : null,
        }
      : null,
    equipment: equipmentSnaps
      .filter((snap) => snap.exists && snap.data()?.tenantId === tenantId)
      .map((snap) => {
        const e = snap.data() ?? {};
        return {
          name: text(e.name) ?? "Equipamento",
          type: text(e.type),
          brand: text(e.brand),
          model: text(e.model),
          capacity: text(e.capacity),
          location: text(e.location),
        };
      }),
    groups: PMOC_CATEGORIES.filter((category) => items.some((item) => item.category === category)).map(
      (category) => ({
        label: PMOC_CATEGORY_LABELS[category],
        items: items
          .filter((item) => item.category === category)
          .map((item) => ({ text: item.text, frequency: PMOC_FREQUENCY_LABELS[item.frequency] })),
      }),
    ),
    period,
    visits: reportVisits(orders, period),
    executions: itemExecutions(items, orders, period),
  };
}

export type PmocDocumentKind = "plan" | "report";

/**
 * O PDF do plano ou do relatório, impresso da página pública. Sem cache: o
 * relatório muda com o período e com cada visita concluída, e o plano é pedido
 * poucas vezes; o limite de PDFs por pessoa já segura o custo.
 */
export async function generatePmocPdf(params: {
  tenantId: string;
  contractId: string;
  uid: string | null;
  kind: PmocDocumentKind;
  period: ReportPeriod;
}): Promise<Buffer> {
  const token = await ensurePmocShareToken(params);
  const query = new URLSearchParams({ print: "1", kind: params.kind });
  if (params.kind === "report") {
    query.set("from", params.period.from);
    query.set("to", params.period.to);
  }
  const buffer = await renderPageToPdfBuffer({
    url: `${buildPmocShareUrl(token)}?${query.toString()}`,
    readySelector: '[data-pdf-pmoc-ready="1"]',
    appOrigin: resolveAppBaseUrl(),
    vercelBypassSecret: process.env.VERCEL_PROTECTION_BYPASS_SECRET || "",
  });
  if (buffer.subarray(0, 5).toString("ascii") !== "%PDF-") throw new Error("INVALID_PDF_HEADER");
  return buffer;
}
