import { Timestamp, type Transaction } from "firebase-admin/firestore";
import { db } from "../../../init";
import { logger } from "../../../lib/logger";
import { NotificationService } from "../notification.service";
import { tenantHasCapability } from "../../../lib/tenant-capabilities";
import {
  SERVICE_CONTRACTS_COLLECTION,
  buildChargeTransaction,
  chargeTransactionId,
  computeMonthlyAmount,
  contractIdFromProposal,
  dueCharges,
  dueVisit,
  formatContractCode,
  monthlyLinesFromProposal,
  visitOrderId,
  type ServiceContract,
} from "./contract-model";
import { SERVICE_ORDERS_COLLECTION, SERVICE_ORDER_COUNTERS_COLLECTION, newServiceOrderDoc } from "./field-service-model";
import { allocateOrderNumber, loadClientSnapshot, loadEquipmentLabels, loadTechnician } from "./field-service.service";

/**
 * Leitura e gravação dos contratos. As regras puras (datas, períodos, o
 * lançamento da mensalidade) ficam em `contract-model.ts`.
 *
 * Nenhuma escrita daqui passa pelo `TransactionService.createTransaction`: ele
 * confere a permissão de quem pediu, e a rotina diária não tem usuário. A
 * mensalidade nasce PENDENTE, então não mexe no saldo da carteira, e os totais
 * e grupos do financeiro são mantidos pelo `onTransactionTotals`, como em
 * qualquer lançamento.
 */

/**
 * Número sequencial do contrato (`CT-0001`), no mesmo documento de contador
 * da OS, num campo próprio. Lido e gravado na transação que cria o contrato.
 */
export async function allocateContractNumber(t: Transaction, tenantId: string): Promise<{ number: number; code: string }> {
  const ref = db.collection(SERVICE_ORDER_COUNTERS_COLLECTION).doc(tenantId);
  const snap = await t.get(ref);
  const current = Number(snap.data()?.nextContractNumber);
  const number = Number.isInteger(current) && current > 0 ? current : 1;
  t.set(ref, { tenantId, nextContractNumber: number + 1, updatedAt: new Date().toISOString() }, { merge: true });
  return { number, code: formatContractCode(number) };
}

export function readContract(id: string, data: Record<string, unknown>): ServiceContract {
  return { ...(data as unknown as ServiceContract), id };
}

export interface BillingResult {
  created: string[];
  skipped: string[];
  ended: boolean;
}

/**
 * Lança as mensalidades que já entraram na janela e avança a próxima cobrança,
 * tudo numa transação. O id do lançamento é o mês (`contract_{id}_{AAAAMM}`) e
 * é relido antes de gravar: se a rotina rodar duas vezes, ou se duas execuções
 * se cruzarem, o mês que já existe não é gravado de novo, e a próxima cobrança
 * avança do mesmo jeito.
 */
export async function billContract(contractId: string, today: string, dryRun: boolean): Promise<BillingResult> {
  const ref = db.collection(SERVICE_CONTRACTS_COLLECTION).doc(contractId);
  return db.runTransaction(async (t) => {
    const snap = await t.get(ref);
    if (!snap.exists) return { created: [], skipped: [], ended: false };
    const contract = readContract(snap.id, snap.data() as Record<string, unknown>);
    if (contract.status !== "active" || !contract.nextBillingDate) return { created: [], skipped: [], ended: false };

    const due = dueCharges({
      nextBillingDate: contract.nextBillingDate,
      billingDay: contract.billingDay,
      endDate: contract.endDate,
      today,
    });
    if (due.charges.length === 0 && !due.ended) return { created: [], skipped: [], ended: false };

    const refs = due.charges.map((charge) => db.collection("transactions").doc(chargeTransactionId(contract.id, charge.period)));
    const existing = await Promise.all(refs.map((r) => t.get(r)));

    const created: string[] = [];
    const skipped: string[] = [];
    const now = Timestamp.now();
    due.charges.forEach((charge, index) => {
      if (existing[index].exists) {
        skipped.push(refs[index].id);
        return;
      }
      created.push(refs[index].id);
      if (!dryRun) {
        t.create(refs[index], {
          ...buildChargeTransaction({ contract, charge, today }),
          createdAt: now,
          updatedAt: now,
        });
      }
    });

    if (!dryRun) {
      const lastPeriod = due.charges.at(-1)?.period ?? contract.lastBilledPeriod;
      t.update(ref, {
        nextBillingDate: due.nextBillingDate,
        lastBilledPeriod: lastPeriod ?? null,
        ...(due.ended ? { status: "ended", endedAt: new Date().toISOString(), endedReason: "end_date" } : {}),
        updatedAt: new Date().toISOString(),
      });
    }
    return { created, skipped, ended: due.ended };
  });
}

/** Horário padrão da visita preventiva na Agenda. O técnico remarca pela OS. */
const VISIT_START_TIME = "08:00";
const VISIT_DURATION_MIN = 60;

/**
 * Abre a OS da visita preventiva que entrou na janela, com id determinístico
 * (`contract_{id}_visit_{AAAAMMDD}`), e avança a próxima visita na mesma
 * transação. Devolve o id da OS criada, para quem chamou levar à Agenda e
 * avisar o técnico depois do commit.
 */
export async function openContractVisit(contractId: string, today: string, dryRun: boolean): Promise<string | null> {
  const ref = db.collection(SERVICE_CONTRACTS_COLLECTION).doc(contractId);
  const first = await ref.get();
  if (!first.exists) return null;
  const preview = readContract(first.id, first.data() as Record<string, unknown>);
  if (preview.status !== "active") return null;
  const planned = dueVisit({ plan: preview.visitPlan, endDate: preview.endDate, today });
  if (!planned) return null;

  // Leituras fora da transação: cliente, aparelhos e técnico mudam pouco, e o
  // que decide se a visita já foi aberta (o id da OS) é relido lá dentro.
  const client = await loadClientSnapshot(preview.clientId, preview.tenantId);
  if (!client) {
    logger.warn("service_contract_visit_client_missing", { contractId });
    return null;
  }
  const equipment = (await loadEquipmentLabels(preview.equipmentIds ?? [], preview.tenantId, client.id)) ?? [];
  const technicianDoc = preview.visitPlan.technicianId
    ? await loadTechnician(preview.visitPlan.technicianId, preview.tenantId)
    : null;
  const technician = technicianDoc
    ? { technicianUids: [technicianDoc.uid], technicianName: technicianDoc.name || null }
    : { technicianUids: [] as string[], technicianName: null };

  const orderRef = db.collection(SERVICE_ORDERS_COLLECTION).doc(visitOrderId(contractId, planned.visitDate));
  const start = new Date(`${planned.visitDate}T${VISIT_START_TIME}:00-03:00`);
  const end = new Date(start.getTime() + VISIT_DURATION_MIN * 60_000);

  return db.runTransaction(async (t) => {
    const snap = await t.get(ref);
    const orderSnap = await t.get(orderRef);
    if (!snap.exists) return null;
    const contract = readContract(snap.id, snap.data() as Record<string, unknown>);
    if (contract.status !== "active" || contract.visitPlan?.nextVisitDate !== planned.visitDate) return null;
    if (dryRun) return orderSnap.exists ? null : orderRef.id;

    let createdId: string | null = null;
    if (!orderSnap.exists) {
      const allocated = await allocateOrderNumber(t, contract.tenantId);
      t.set(
        orderRef,
        newServiceOrderDoc({
          tenantId: contract.tenantId,
          number: allocated.number,
          code: allocated.code,
          client,
          address: client.address,
          type: "preventive",
          priority: "normal",
          title: `Visita preventiva: ${contract.title}`.slice(0, 160),
          description: `Visita prevista no contrato ${contract.code}.`,
          equipment,
          projectId: null,
          contractId: contract.id,
          technician,
          scheduledStart: start.toISOString(),
          scheduledEnd: end.toISOString(),
          checklist: (contract.visitPlan.checklist ?? []).map((text, index) => ({
            id: `visit_${index}`,
            text,
            done: false,
            note: null,
          })),
          items: [],
          createdBy: "system",
          now: new Date().toISOString(),
        }),
      );
      createdId = orderRef.id;
    }
    t.update(ref, {
      "visitPlan.nextVisitDate": planned.nextVisitDate,
      updatedAt: new Date().toISOString(),
    });
    return createdId;
  });
}

/**
 * Suspende o contrato de uma empresa que perdeu o módulo (ou o financeiro) e
 * avisa o dono. Nunca apaga: ao voltar o plano, a empresa retoma pela tela, e
 * o período parado não é cobrado depois.
 */
export async function suspendContractForPlan(contract: ServiceContract, missing: string): Promise<void> {
  const ref = db.collection(SERVICE_CONTRACTS_COLLECTION).doc(contract.id);
  const changed = await db.runTransaction(async (t) => {
    const snap = await t.get(ref);
    if (snap.data()?.status !== "active") return false;
    t.update(ref, {
      status: "suspended",
      suspendedReason: "plan",
      suspendedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    return true;
  });
  if (!changed) return;
  try {
    await NotificationService.createNotification({
      tenantId: contract.tenantId,
      type: "service_contract_suspended",
      title: `Contrato ${contract.code} suspenso`,
      message: `O plano da empresa não inclui mais ${missing}, então a mensalidade de ${contract.clientName} parou de ser lançada. Retome o contrato depois de regularizar o plano.`,
      clientId: contract.clientId,
      serviceContractId: contract.id,
    });
  } catch (error) {
    logger.warn("service_contract_suspend_notify_failed", {
      contractId: contract.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * O contrato em rascunho que nasce da proposta aprovada com linhas de
 * mensalidade. O id é o da proposta (`proposal_{id}`) e a gravação é
 * `create`: aprovar de novo, ou duas abas aprovando juntas, não cria dois. A
 * empresa ativa escolhendo a data de início.
 */
export async function ensureContractFromProposal(params: {
  tenantId: string;
  proposalId: string;
  proposal: Record<string, unknown>;
  wallet: string | null;
  uid: string;
}): Promise<string | null> {
  const lines = monthlyLinesFromProposal(params.proposal.products);
  if (lines.length === 0) return null;
  const clientId = typeof params.proposal.clientId === "string" ? params.proposal.clientId : "";
  if (!clientId) return null;

  const ref = db.collection(SERVICE_CONTRACTS_COLLECTION).doc(contractIdFromProposal(params.proposalId));
  const now = new Date().toISOString();
  return db.runTransaction(async (t) => {
    const snap = await t.get(ref);
    if (snap.exists) return null;
    const allocated = await allocateContractNumber(t, params.tenantId);
    const title = String(params.proposal.title ?? "").trim() || "Contrato";
    t.create(ref, {
      tenantId: params.tenantId,
      number: allocated.number,
      code: allocated.code,
      clientId,
      clientName: String(params.proposal.clientName ?? ""),
      title: title.slice(0, 160),
      type: "other",
      status: "draft",
      lines,
      monthlyAmount: computeMonthlyAmount(lines),
      billingDay: 10,
      wallet: params.wallet ?? "",
      issueNfse: false,
      equipmentIds: [],
      visitPlan: { enabled: false, intervalMonths: 3, technicianId: null, checklist: [], nextVisitDate: null },
      notes: null,
      startDate: null,
      endDate: null,
      nextBillingDate: null,
      lastBilledPeriod: null,
      suspendedReason: null,
      proposalId: params.proposalId,
      createdAt: now,
      updatedAt: now,
      createdBy: params.uid,
    });
    return ref.id;
  });
}

/**
 * A carteira do contrato vem da proposta (a das parcelas, senão a da
 * entrada), que pode estar gravada pelo id ou pelo nome. Sem nenhuma, a
 * carteira padrão da empresa; o contrato não ativa sem carteira.
 */
async function resolveContractWallet(tenantId: string, proposal: Record<string, unknown>): Promise<string | null> {
  const candidates = [proposal.installmentsWallet, proposal.downPaymentWallet]
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter(Boolean);
  for (const candidate of candidates) {
    const byId = await db.collection("wallets").doc(candidate).get();
    if (byId.exists && byId.data()?.tenantId === tenantId) return byId.id;
    const byName = await db
      .collection("wallets")
      .where("tenantId", "==", tenantId)
      .where("name", "==", candidate)
      .limit(1)
      .get();
    if (!byName.empty) return byName.docs[0].id;
  }
  const fallback = await db
    .collection("wallets")
    .where("tenantId", "==", tenantId)
    .where("isDefault", "==", true)
    .limit(1)
    .get();
  return fallback.empty ? null : fallback.docs[0].id;
}

/**
 * Na aprovação da proposta: se ela tem linhas de mensalidade e a empresa tem
 * o módulo, nasce o contrato em rascunho. Nunca derruba a aprovação.
 */
export async function resolveContractOnApproval(params: {
  tenantId: string;
  proposalId: string;
  proposal: Record<string, unknown>;
  uid: string;
}): Promise<string | null> {
  try {
    if (monthlyLinesFromProposal(params.proposal.products).length === 0) return null;
    if (!(await tenantHasCapability(params.tenantId, "fieldService"))) return null;
    const wallet = await resolveContractWallet(params.tenantId, params.proposal);
    return await ensureContractFromProposal({ ...params, wallet });
  } catch (error) {
    logger.warn("service_contract_on_approval_failed", {
      tenantId: params.tenantId,
      proposalId: params.proposalId,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
