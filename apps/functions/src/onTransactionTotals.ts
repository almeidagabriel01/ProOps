import { onDocumentWritten } from "firebase-functions/v2/firestore";
import {
  computeTransactionTotals,
  storedTotalsDiffer,
} from "./lib/transaction-totals";
import {
  computeGroupSummary,
  groupDocIdFromKey,
  resolveGroupKey,
} from "./lib/transaction-group-summary";
import { logger } from "./lib/logger";

/**
 * Mantém três desnormalizações em todo write de transactions/{id}:
 *  1. `paidTotal`/`pendingTotal` no próprio doc (base do summary agregado);
 *  2. `grouped` (boolean) no próprio doc — habilita a query de avulsos
 *     (`where("grouped","==",false)`; Firestore não consulta campo ausente);
 *  3. o doc-resumo do grupo em `transaction_groups/{groupDocId}` — fonte da
 *     aba Agrupados do frontend (1 leitura por grupo em vez de N membros).
 *
 * Trigger em vez de mudança inline nos writers (transaction.service ~1800
 * linhas, proposals sync, webhook Asaas, bot WhatsApp): cobre TODOS os
 * writers presentes e futuros sem tocá-los, e é auto-corretivo.
 *
 * Anti-loop:
 *  - o update do próprio doc só ocorre quando totais/grouped divergem; a
 *    escrita re-dispara o trigger uma vez, que não diverge e não escreve;
 *  - o recompute de grupo só roda quando algum campo relevante ao resumo
 *    mudou (summaryRelevantChanged) — o echo do próprio update (só
 *    totais/grouped) não gera novas queries;
 *  - escrita em transaction_groups é outra coleção — não re-dispara.
 *
 * Grupos legados mistos (parte dos membros com proposalGroupId, parte só com
 * installmentGroupId): o grupo inteiro é promovido à chave proposal — o
 * resumo `proposal:{id}` inclui os irmãos legados e o doc `group_{id}` é
 * deletado. Espelha a mitigação do backfill (docs/plans/2026-07-06).
 */

type SnapLike =
  | {
      exists: boolean;
      data: () => Record<string, unknown> | undefined;
      ref: {
        firestore: FirebaseFirestore.Firestore;
        update: (data: Record<string, unknown>) => Promise<unknown>;
      };
    }
  | undefined;

type EventLike = {
  data?: { before?: SnapLike; after?: SnapLike };
  params: { transactionId: string };
};

const MEMBER_QUERY_LIMIT = 500;

/** Campos que alimentam o doc-resumo do grupo. */
const SUMMARY_FIELDS = [
  "tenantId",
  "type",
  "amount",
  "status",
  "extraCosts",
  "dueDate",
  "description",
  "wallet",
  "clientName",
  "proposalId",
  "installmentNumber",
  "proposalGroupId",
  "installmentGroupId",
  "recurringGroupId",
] as const;

function pickSummaryFields(
  data: Record<string, unknown> | undefined,
): string {
  if (!data) return "";
  const picked: Record<string, unknown> = {};
  for (const field of SUMMARY_FIELDS) {
    if (field in data) picked[field] = data[field];
  }
  return JSON.stringify(picked);
}

function summaryRelevantChanged(
  before: Record<string, unknown> | undefined,
  after: Record<string, unknown> | undefined,
): boolean {
  return pickSummaryFields(before) !== pickSummaryFields(after);
}

/** YYYY-MM-DD no fuso do produto (BRT) — mesma referência do frontend/crons. */
function todayIsoSaoPaulo(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
  }).format(new Date());
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

async function queryMembers(
  firestore: FirebaseFirestore.Firestore,
  tenantId: string,
  field: string,
  value: string,
): Promise<Array<Record<string, unknown>>> {
  const snap = await firestore
    .collection("transactions")
    .where("tenantId", "==", tenantId)
    .where(field, "==", value)
    .limit(MEMBER_QUERY_LIMIT)
    .get();
  // id incluído: computeGroupSummary grava anchorTransactionId no resumo.
  return snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Record<string, unknown>),
  }));
}

async function fetchProposalMembers(
  firestore: FirebaseFirestore.Firestore,
  tenantId: string,
  proposalGroupId: string,
): Promise<Array<Record<string, unknown>>> {
  const base = await queryMembers(
    firestore,
    tenantId,
    "proposalGroupId",
    proposalGroupId,
  );
  // Irmãos legados: mesmo installmentGroupId mas sem proposalGroupId.
  const instIds = new Set<string>();
  for (const m of base) {
    const instId = asString(m.installmentGroupId);
    if (instId) instIds.add(instId);
  }
  const seen = new Set(base.map((m) => String(m.id)));
  const members = [...base];
  for (const instId of instIds) {
    const siblings = await queryMembers(
      firestore,
      tenantId,
      "installmentGroupId",
      instId,
    );
    for (const sibling of siblings) {
      const siblingId = String(sibling.id);
      if (!seen.has(siblingId)) {
        seen.add(siblingId);
        members.push(sibling);
      }
    }
  }
  return members;
}

async function writeSummary(
  firestore: FirebaseFirestore.Firestore,
  tenantId: string,
  groupKey: string,
  members: Array<Record<string, unknown>>,
): Promise<void> {
  const docRef = firestore
    .collection("transaction_groups")
    .doc(groupDocIdFromKey(groupKey));
  const summary = computeGroupSummary(
    tenantId,
    groupKey,
    members,
    todayIsoSaoPaulo(),
  );
  if (summary === null) {
    await docRef.delete();
    return;
  }
  await docRef.set(summary);
}

/** Exportado para reuso no backfill (scripts/backfill-transaction-groups.ts). */
export async function recomputeGroup(
  firestore: FirebaseFirestore.Firestore,
  tenantId: string,
  groupKey: string,
): Promise<void> {
  if (groupKey.startsWith("proposal:")) {
    const proposalGroupId = groupKey.slice("proposal:".length);
    const members = await fetchProposalMembers(
      firestore,
      tenantId,
      proposalGroupId,
    );
    await writeSummary(firestore, tenantId, groupKey, members);
    return;
  }

  const groupId = groupKey.slice("group:".length);
  const [byInstallment, byRecurring] = await Promise.all([
    queryMembers(firestore, tenantId, "installmentGroupId", groupId),
    queryMembers(firestore, tenantId, "recurringGroupId", groupId),
  ]);
  const members = [...byInstallment];
  const seen = new Set(members.map((m) => String(m.id)));
  for (const m of byRecurring) {
    if (!seen.has(String(m.id))) members.push(m);
  }

  // Grupo legado misto → promove à chave proposal e remove o doc group_.
  const proposalIds = new Set(
    members
      .map((m) => asString(m.proposalGroupId))
      .filter((id): id is string => id !== null),
  );
  const promotedTo = proposalIds.values().next().value as string | undefined;
  if (proposalIds.size > 1) {
    logger.warn("recomputeGroup: mixed group with multiple proposalGroupIds", {
      groupKey,
      proposalGroupIds: Array.from(proposalIds),
    });
  }
  if (promotedTo) {
    await firestore
      .collection("transaction_groups")
      .doc(groupDocIdFromKey(groupKey))
      .delete();
    await recomputeGroup(firestore, tenantId, `proposal:${promotedTo}`);
    return;
  }

  await writeSummary(firestore, tenantId, groupKey, members);
}

export async function handleTransactionTotalsEvent(
  event: EventLike,
): Promise<void> {
  const beforeSnap = event.data?.before;
  const afterSnap = event.data?.after;
  const beforeData = beforeSnap?.exists ? beforeSnap.data() : undefined;
  const afterData = afterSnap?.exists ? afterSnap.data() : undefined;

  const beforeKey = resolveGroupKey(beforeData);
  const afterKey = resolveGroupKey(afterData);

  // 1. Totais + grouped no próprio doc (condicional — anti-loop).
  if (afterData && afterSnap) {
    const computed = computeTransactionTotals(afterData);
    const grouped = afterKey !== null;
    const needsTotals = storedTotalsDiffer(afterData, computed);
    const needsGrouped = afterData.grouped !== grouped;
    if (needsTotals || needsGrouped) {
      const update: Record<string, unknown> = {};
      if (needsTotals) {
        update.paidTotal = computed.paidTotal;
        update.pendingTotal = computed.pendingTotal;
      }
      if (needsGrouped) update.grouped = grouped;
      try {
        await afterSnap.ref.update(update);
      } catch (err) {
        // Doc pode ter sido deletado entre o evento e o update — não é erro.
        const message = err instanceof Error ? err.message : String(err);
        if (!message.includes("NOT_FOUND") && !message.includes("no entity")) {
          logger.error("onTransactionTotals update failed", {
            transactionId: event.params.transactionId,
            error: message,
          });
          throw err; // re-lança para retry do trigger
        }
      }
    }
  }

  // 2. Resumos de grupo — roda também em delete e quando totais não mudam.
  const keys = new Set<string>();
  if (beforeKey) keys.add(beforeKey);
  if (afterKey) keys.add(afterKey);
  if (keys.size === 0) return;

  // Echo do próprio trigger ou update irrelevante ao resumo → nada a fazer.
  if (
    beforeData &&
    afterData &&
    beforeKey === afterKey &&
    !summaryRelevantChanged(beforeData, afterData)
  ) {
    return;
  }

  const anchorSnap = afterSnap?.exists ? afterSnap : beforeSnap;
  const firestore = anchorSnap?.ref.firestore;
  const tenantId =
    asString(afterData?.tenantId) ?? asString(beforeData?.tenantId);
  if (!firestore || !tenantId) {
    logger.warn("onTransactionTotals: missing firestore/tenantId for group recompute", {
      transactionId: event.params.transactionId,
    });
    return;
  }

  for (const key of keys) {
    try {
      await recomputeGroup(firestore, tenantId, key);
    } catch (err) {
      logger.error("onTransactionTotals group recompute failed", {
        transactionId: event.params.transactionId,
        groupKey: key,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err; // retry do trigger
    }
  }
}

export const onTransactionTotals = onDocumentWritten(
  {
    document: "transactions/{transactionId}",
    memory: "512MiB",
    timeoutSeconds: 60,
  },
  async (event) => handleTransactionTotalsEvent(event as unknown as EventLike),
);
