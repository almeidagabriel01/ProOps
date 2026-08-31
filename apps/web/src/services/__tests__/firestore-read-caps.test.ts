/**
 * Guards de custo Firestore client-side (auditoria 2026-07-06):
 * - o listener realtime de notificações DEVE ter limit(50) — roda em toda
 *   página autenticada e sem cap re-cobra a coleção inteira a cada mudança;
 * - transações relacionadas por grupo DEVEM ser buscadas por query
 *   direcionada (installmentGroupId/recurringGroupId), nunca via fetch da
 *   coleção inteira do tenant.
 *
 * Ampliado em 2026-08-27: a auditoria de julho corrigiu as PÁGINAS mas deixou
 * 4 chamadas de `getTransactions(tenantId)` no editor de lançamento — abrir a
 * edição de uma recorrência baixava a coleção inteira do tenant DUAS vezes.
 * O guard de varredura no fim deste arquivo cobre o que um teste de unidade de
 * service não alcança: um call site novo em qualquer página.
 */

import fs from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const captured = {
  queryArgs: [] as unknown[][],
  whereArgs: [] as unknown[][],
  limitArgs: [] as unknown[][],
};

vi.mock("firebase/firestore", () => ({
  collection: vi.fn(() => ({ __kind: "collection" })),
  query: vi.fn((...args: unknown[]) => {
    captured.queryArgs.push(args);
    return { __kind: "query" };
  }),
  where: vi.fn((...args: unknown[]) => {
    captured.whereArgs.push(args);
    return { __kind: "where", args };
  }),
  orderBy: vi.fn(() => ({ __kind: "orderBy" })),
  limit: vi.fn((...args: unknown[]) => {
    captured.limitArgs.push(args);
    return { __kind: "limit", args };
  }),
  onSnapshot: vi.fn(() => vi.fn()),
  getDocs: vi.fn(async () => ({ docs: [] })),
  getDoc: vi.fn(),
  doc: vi.fn(),
  addDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  writeBatch: vi.fn(),
  serverTimestamp: vi.fn(),
  Timestamp: { now: vi.fn() },
}));

vi.mock("@/lib/firebase", () => ({ db: {} }));

const callApiMock = vi.fn();
vi.mock("@/lib/api-client", () => ({
  callApi: (...args: unknown[]) =>
    (callApiMock as (...a: unknown[]) => unknown)(...args),
  apiClient: { get: vi.fn(), post: vi.fn() },
}));

beforeEach(() => {
  captured.queryArgs.length = 0;
  captured.whereArgs.length = 0;
  captured.limitArgs.length = 0;
  vi.clearAllMocks();
});

describe("NotificationService.subscribe", () => {
  it("caps the realtime listener query at 50 docs", async () => {
    const { NotificationService } = await import("../notification-service");

    const unsubscribe = NotificationService.subscribe(
      { kind: "tenant", tenantId: "t1" } as never,
      () => undefined,
    );

    expect(captured.limitArgs).toContainEqual([50]);
    const queryWithLimit = captured.queryArgs.find((args) =>
      args.some(
        (a) => (a as { __kind?: string } | null)?.__kind === "limit",
      ),
    );
    expect(queryWithLimit).toBeDefined();
    unsubscribe();
  });
});

describe("TransactionService group queries", () => {
  it("getRecurringByGroupId queries by recurringGroupId (targeted, not full-tenant)", async () => {
    const { TransactionService } = await import("../transaction-service");

    await TransactionService.getRecurringByGroupId("group-9", "t1");

    expect(captured.whereArgs).toContainEqual([
      "recurringGroupId",
      "==",
      "group-9",
    ]);
    expect(captured.whereArgs).toContainEqual(["tenantId", "==", "t1"]);
  });

  it("getTransactionsOnDay escopa por dia em date E dueDate, sem varrer o tenant", async () => {
    const { TransactionService } = await import("../transaction-service");

    await TransactionService.getTransactionsOnDay("t1", "2026-08-27");

    // Faixa do dia nos dois campos — cobre "YYYY-MM-DD" e "YYYY-MM-DDTHH:mm:ss".
    expect(captured.whereArgs).toContainEqual(["date", ">=", "2026-08-27"]);
    expect(captured.whereArgs).toContainEqual([
      "date",
      "<=",
      "2026-08-27\uf8ff",
    ]);
    expect(captured.whereArgs).toContainEqual(["dueDate", ">=", "2026-08-27"]);
    expect(captured.whereArgs).toContainEqual([
      "dueDate",
      "<=",
      "2026-08-27\uf8ff",
    ]);

    // Toda query passou por tenantId — nenhuma varredura cross-tenant.
    const tenantFilters = captured.whereArgs.filter(
      (a) => a[0] === "tenantId",
    );
    expect(tenantFilters).toHaveLength(2);
  });

  it("getTransactionsOnDay normaliza data com hora e deduplica por id", async () => {
    const { TransactionService } = await import("../transaction-service");
    const { getDocs } = await import("firebase/firestore");

    const doc = (id: string) => ({ id, data: () => ({ description: id }) });
    vi.mocked(getDocs)
      .mockResolvedValueOnce({ docs: [doc("a"), doc("b")] } as never)
      .mockResolvedValueOnce({ docs: [doc("b"), doc("c")] } as never);

    const result = await TransactionService.getTransactionsOnDay(
      "t1",
      "2026-08-27T00:00:00",
    );

    expect(captured.whereArgs).toContainEqual(["date", ">=", "2026-08-27"]);
    expect(result.map((t) => t.id).sort()).toEqual(["a", "b", "c"]);
  });

  it("getTransactionsOnDay sem data não emite query alguma", async () => {
    const { TransactionService } = await import("../transaction-service");
    const { getDocs } = await import("firebase/firestore");

    const result = await TransactionService.getTransactionsOnDay("t1", "");

    expect(result).toEqual([]);
    expect(getDocs).not.toHaveBeenCalled();
  });

  it("getInstallmentsByGroupId queries by installmentGroupId", async () => {
    const { TransactionService } = await import("../transaction-service");

    await TransactionService.getInstallmentsByGroupId("group-3", "t1");

    expect(captured.whereArgs).toContainEqual([
      "installmentGroupId",
      "==",
      "group-3",
    ]);
  });
});

describe("TransactionService.getSummary", () => {
  it("chama o endpoint agregado e NUNCA baixa a coleção via Firestore", async () => {
    callApiMock.mockResolvedValue({
      success: true,
      summary: {
        totalIncome: 10,
        totalExpense: 5,
        pendingIncome: 2,
        pendingExpense: 1,
      },
    });
    const { TransactionService } = await import("../transaction-service");
    const { getDocs } = await import("firebase/firestore");

    const summary = await TransactionService.getSummary("t1");

    expect(summary).toEqual({
      totalIncome: 10,
      totalExpense: 5,
      pendingIncome: 2,
      pendingExpense: 1,
    });
    expect(callApiMock).toHaveBeenCalledWith(
      "v1/transactions/summary?tenantId=t1",
      "GET",
    );
    expect(getDocs).not.toHaveBeenCalled();
  });
});

/**
 * `getTransactions(tenantId)` baixa a coleção INTEIRA do tenant — sem limit,
 * sem orderBy. O custo cresce linearmente com o histórico do cliente, para
 * sempre, e quem mais usa o produto é quem mais paga.
 *
 * Um teste de unidade de service não pega a reincidência: o problema não é a
 * função existir, é alguém CHAMÁ-LA numa tela. Daí a varredura.
 *
 * Para remover um item da allowlist, troque a chamada por uma query
 * direcionada (ver `getTransactionsOnDay`, `getRecurringByGroupId`,
 * `getInstallmentsByGroupId`, `getTransactionsScoped`).
 */
const FULL_FETCH_ALLOWLIST = new Set([
  // Histórico da carteira. NÃO escopar por `wallet` sem antes desnormalizar:
  // um extra-cost tem carteira E status próprios, independentes do lançamento
  // pai, então `where("wallet", "in", [...])` ou `where("status","==","paid")`
  // derrubam silenciosamente entradas do histórico financeiro. O fix correto
  // está no roadmap (campo `walletsInvolved` + backfill).
  "app/wallets/_components/wallet-history-dialog.tsx",
]);

describe("guard: full-fetch da coleção de transações", () => {
  const SRC = path.resolve(__dirname, "../..");

  const walk = (dir: string, out: string[] = []): string[] => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name === "__tests__") continue;
        walk(full, out);
      } else if (/\.tsx?$/.test(entry.name)) {
        out.push(full);
      }
    }
    return out;
  };

  it("só a allowlist chama TransactionService.getTransactions(", () => {
    const offenders = walk(SRC)
      .filter((file) =>
        fs.readFileSync(file, "utf8").includes(
          "TransactionService.getTransactions(",
        ),
      )
      .map((file) => path.relative(SRC, file).split(path.sep).join("/"))
      .filter((rel) => !FULL_FETCH_ALLOWLIST.has(rel));

    expect(offenders).toEqual([]);
  });
});
