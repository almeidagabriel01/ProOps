/**
 * Reporte do excedente de WhatsApp ao Stripe (cobrança real). Garantias:
 * - todo tenant é alcançado (paginado; antes morria no meio por timeout e o
 *   resto nunca era cobrado);
 * - nunca cobra duas vezes (reserva antes do Stripe; reserva antiga sem
 *   confirmação vai para revisão manual em vez de repetir a cobrança).
 */

jest.mock("firebase-admin/firestore", () => ({
  FieldValue: { serverTimestamp: () => "SERVER_TS" },
  Timestamp: {
    fromMillis: (ms: number) => ({ toMillis: () => ms, __ms: ms }),
  },
}));

import {
  SAFE_RETRY_WINDOW_MS,
  runWhatsappOverageReport,
} from "../whatsapp-overage-report";

type Usage = Record<string, unknown>;
const MONTH = "2026-08";
const NOW = Date.parse("2026-09-01T06:00:00Z");

function makeDb(tenants: Array<{ id: string; data: Record<string, unknown> }>, usage: Record<string, Usage>) {
  const pageQueries: number[] = [];
  const usageRef = (tenantId: string) => ({
    tenantId,
    async set(data: Usage) {
      usage[tenantId] = { ...(usage[tenantId] || {}), ...data };
    },
  });
  const db = {
    collection(name: string) {
      if (name === "whatsappUsage") {
        return {
          doc: (tenantId: string) => ({
            collection: () => ({ doc: () => usageRef(tenantId) }),
          }),
        };
      }
      // tenants: paginação por cursor
      const build = (after: string | null, limit: number): unknown => ({
        where: () => build(after, limit),
        orderBy: () => build(after, limit),
        limit: (n: number) => build(after, n),
        startAfter: (doc: { id: string }) => build(doc.id, limit),
        get: async () => {
          const sorted = [...tenants].sort((a, b) => a.id.localeCompare(b.id));
          const start = after ? sorted.findIndex((t) => t.id === after) + 1 : 0;
          const docs = sorted.slice(start, start + limit).map((t) => ({ id: t.id, data: () => t.data }));
          pageQueries.push(docs.length);
          return { docs, size: docs.length, empty: docs.length === 0 };
        },
      });
      return build(null, 1000);
    },
    async runTransaction<T>(fn: (t: unknown) => Promise<T>): Promise<T> {
      return fn({
        get: async (ref: { tenantId: string }) => ({
          exists: usage[ref.tenantId] !== undefined,
          data: () => usage[ref.tenantId],
        }),
        set: (ref: { tenantId: string }, data: Usage) => {
          usage[ref.tenantId] = { ...(usage[ref.tenantId] || {}), ...data };
        },
      });
    },
  };
  return { db: db as unknown as FirebaseFirestore.Firestore, pageQueries };
}

function makeStripe(fail = new Set<string>()) {
  const calls: string[] = [];
  return {
    calls,
    stripe: {
      billing: {
        meterEvents: {
          create: async (p: { identifier: string; payload: Record<string, string> }) => {
            calls.push(p.identifier);
            if (fail.has(p.identifier)) throw new Error("stripe down");
            return { identifier: p.identifier };
          },
        },
      },
    },
  };
}

const tenant = (id: string, customer = `cus_${id}`) => ({ id, data: { stripeCustomerId: customer } });

it("cobra quem tem excedente e marca como reportado", async () => {
  const usage: Record<string, Usage> = { a: { overageMessages: 40 } };
  const { db } = makeDb([tenant("a")], usage);
  const { stripe, calls } = makeStripe();

  const result = await runWhatsappOverageReport({ db, stripe, month: MONTH, nowMs: NOW });

  expect(calls).toEqual([`a:${MONTH}:whatsapp_overage`]);
  expect(result.charged).toBe(1);
  expect(usage.a).toMatchObject({ stripeReported: true, stripeEventId: `a:${MONTH}:whatsapp_overage` });
});

it("não cobra quem já foi reportado, quem não tem uso e quem não passou do limite", async () => {
  const usage: Record<string, Usage> = {
    a: { overageMessages: 40, stripeReported: true },
    b: { overageMessages: 0 },
  };
  const { db } = makeDb([tenant("a"), tenant("b"), tenant("c")], usage);
  const { stripe, calls } = makeStripe();

  const result = await runWhatsappOverageReport({ db, stripe, month: MONTH, nowMs: NOW });

  expect(calls).toEqual([]);
  expect(result.skipped).toBe(3);
});

it("alcança todos os tenants, além da primeira página", async () => {
  const tenants = Array.from({ length: 450 }, (_, i) => tenant(`t${String(i).padStart(3, "0")}`));
  const usage: Record<string, Usage> = Object.fromEntries(tenants.map((t) => [t.id, { overageMessages: 1 }]));
  const { db, pageQueries } = makeDb(tenants, usage);
  const { stripe, calls } = makeStripe();

  const result = await runWhatsappOverageReport({ db, stripe, month: MONTH, nowMs: NOW });

  expect(calls).toHaveLength(450);
  expect(result.charged).toBe(450);
  expect(pageQueries).toEqual([200, 200, 50]);
});

it("reserva recente sem confirmação é repetida (Stripe ainda deduplica o identifier)", async () => {
  const usage: Record<string, Usage> = {
    a: { overageMessages: 40, stripeReportClaimedAt: { toMillis: () => NOW - 60_000 } },
  };
  const { db } = makeDb([tenant("a")], usage);
  const { stripe, calls } = makeStripe();

  const result = await runWhatsappOverageReport({ db, stripe, month: MONTH, nowMs: NOW });

  expect(calls).toEqual([`a:${MONTH}:whatsapp_overage`]);
  expect(result.charged).toBe(1);
});

it("reserva antiga sem confirmação NÃO chama o Stripe: vai para revisão manual", async () => {
  const usage: Record<string, Usage> = {
    a: { overageMessages: 40, stripeReportClaimedAt: { toMillis: () => NOW - SAFE_RETRY_WINDOW_MS - 1 } },
  };
  const { db } = makeDb([tenant("a")], usage);
  const { stripe, calls } = makeStripe();

  const result = await runWhatsappOverageReport({ db, stripe, month: MONTH, nowMs: NOW });

  expect(calls).toEqual([]);
  expect(result.needsManualReview).toEqual(["a"]);
  expect(usage.a.stripeReported).toBeUndefined();
});

it("falha do Stripe deixa a reserva e registra o erro, sem marcar como reportado", async () => {
  const usage: Record<string, Usage> = { a: { overageMessages: 40 }, b: { overageMessages: 5 } };
  const { db } = makeDb([tenant("a"), tenant("b")], usage);
  const { stripe } = makeStripe(new Set([`a:${MONTH}:whatsapp_overage`]));

  const result = await runWhatsappOverageReport({ db, stripe, month: MONTH, nowMs: NOW });

  expect(result.errors).toEqual([{ tenantId: "a", message: "stripe down" }]);
  expect(usage.a.stripeReported).toBeUndefined();
  expect(usage.a.stripeReportClaimedAt).toBeDefined();
  expect(usage.b.stripeReported).toBe(true);
});

it("tenant sem stripeCustomerId é erro, não cobrança", async () => {
  const usage: Record<string, Usage> = { a: { overageMessages: 40 } };
  const { db } = makeDb([tenant("a", "")], usage);
  const { stripe, calls } = makeStripe();

  const result = await runWhatsappOverageReport({ db, stripe, month: MONTH, nowMs: NOW });

  expect(calls).toEqual([]);
  expect(result.errors[0]).toMatchObject({ tenantId: "a" });
  // Sem reserva: quando o cliente for cadastrado, a próxima execução cobra normalmente.
  expect(usage.a.stripeReportClaimedAt).toBeUndefined();
});
