/**
 * checkDueDates:
 * - propostas vencidas há mais de 30 dias saem da consulta (antes eram
 *   relembradas todo dia, para sempre, e o acervo só crescia);
 * - os lembretes são gravados pelo BulkWriter, sem um await por notificação.
 */

type Doc = { id: string; data: () => Record<string, unknown> };

const queries: Array<{ collection: string; wheres: unknown[][] }> = [];
const bulkSets: Array<{ path: string; data: Record<string, unknown> }> = [];
const bulkClose = jest.fn(async () => undefined);
let proposalDocs: Doc[] = [];
let transactionDocs: Doc[] = [];

function makeQuery(collection: string) {
  const record = { collection, wheres: [] as unknown[][] };
  queries.push(record);
  const q = {
    where: (...args: unknown[]) => {
      record.wheres.push(args);
      return q;
    },
    orderBy: () => q,
    limit: () => q,
    startAfter: () => q,
    get: async () => {
      const docs =
        collection === "proposals"
          ? proposalDocs
          : collection === "transactions"
            ? transactionDocs
            : [];
      return { docs, size: docs.length, empty: docs.length === 0 };
    },
  };
  return q;
}

jest.mock("./init", () => ({
  db: {
    collection: (name: string) => ({
      ...makeQuery(name),
      doc: (id: string) => ({ path: `${name}/${id}` }),
    }),
    bulkWriter: () => ({
      onWriteError: jest.fn(),
      set: (ref: { path: string }, data: Record<string, unknown>) => {
        bulkSets.push({ path: ref.path, data });
        return Promise.resolve();
      },
      close: bulkClose,
    }),
    batch: () => ({ delete: jest.fn(), commit: jest.fn() }),
  },
}));
jest.mock("./lib/observability/error-logger", () => ({ captureError: jest.fn() }));
jest.mock("firebase-functions/v2/scheduler", () => ({
  onSchedule: (_opts: unknown, handler: unknown) => handler,
}));

import { runDueDateCheck, PROPOSAL_EXPIRED_REMINDER_WINDOW_DAYS } from "./checkDueDates";

const NOW = new Date("2026-09-25T12:00:00Z");

beforeEach(() => {
  queries.length = 0;
  bulkSets.length = 0;
  bulkClose.mockClear();
  proposalDocs = [];
  transactionDocs = [];
});

it("a consulta de propostas tem piso de 30 dias e teto de hoje + 3", async () => {
  await runDueDateCheck(NOW);
  const proposals = queries.find(
    (q) => q.collection === "proposals" && q.wheres.some((w) => w[0] === "validUntil"),
  );
  expect(PROPOSAL_EXPIRED_REMINDER_WINDOW_DAYS).toBe(30);
  expect(proposals?.wheres).toContainEqual(["validUntil", ">=", "2026-08-26"]);
  expect(proposals?.wheres).toContainEqual(["validUntil", "<=", "2026-09-28"]);
});

it("grava os lembretes pelo BulkWriter e fecha o writer", async () => {
  transactionDocs = [
    { id: "tx1", data: () => ({ tenantId: "t1", dueDate: "2026-09-26", description: "Aluguel" }) },
  ];
  proposalDocs = [
    { id: "p1", data: () => ({ tenantId: "t1", validUntil: "2026-09-20", title: "Casa" }) },
  ];

  await runDueDateCheck(NOW);

  expect(bulkSets.map((s) => s.path)).toEqual([
    "notifications/due_t1_transaction_due_reminder_transactionId_tx1",
    "notifications/due_t1_proposal_expiring_proposalId_p1",
  ]);
  expect(bulkSets[1].data).toMatchObject({
    type: "proposal_expiring",
    title: "Proposta com validade expirada",
    isRead: false,
  });
  expect(bulkClose).toHaveBeenCalledTimes(1);
});

it("fecha o writer mesmo quando a consulta falha", async () => {
  proposalDocs = [
    {
      id: "p1",
      data: () => {
        throw new Error("boom");
      },
    },
  ];
  await runDueDateCheck(NOW);
  expect(bulkClose).toHaveBeenCalledTimes(1);
});
