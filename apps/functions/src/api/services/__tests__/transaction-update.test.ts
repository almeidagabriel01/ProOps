import { TransactionService } from "../transaction.service";
import { db } from "../../../init";

// Mock logger
jest.mock("../../../lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

// Mock checking financial permission
jest.mock("../../../lib/finance-helpers", () => ({
  checkFinancialPermission: jest.fn(() => ({ tenantId: "tenant-1", isSuperAdmin: false })),
  resolveWalletRef: jest.fn(() => ({ ref: { id: "wallet-1" } })),
  addMonths: jest.fn((date, offset) => {
    const d = new Date(date);
    d.setMonth(d.getMonth() + offset);
    return d.toISOString().split("T")[0];
  }),
}));

// Mock firestore db
jest.mock("../../../init", () => {
  const mockDb = {
    collection: jest.fn(),
    runTransaction: jest.fn(),
  };
  return { db: mockDb };
});

describe("TransactionService.updateFinancialEntryWithInstallments descriptions", () => {
  let mockTransaction: any;
  let mockDocs: any[] = [];
  let updatedData: any[] = [];

  beforeEach(() => {
    jest.clearAllMocks();
    updatedData = [];

    // Create 3 mock recurring transactions
    mockDocs = [
      {
        id: "tx-1",
        ref: { id: "tx-1" },
        data: () => ({
          tenantId: "tenant-1",
          type: "expense",
          description: "recorrente",
          amount: 100,
          date: "2026-05-01",
          dueDate: "2026-05-01",
          status: "paid",
          isRecurring: true,
          installmentNumber: 1,
          installmentCount: 12,
          recurringGroupId: "rec-group-1",
        }),
      },
      {
        id: "tx-2",
        ref: { id: "tx-2" },
        data: () => ({
          tenantId: "tenant-1",
          type: "expense",
          description: "recorrente (2/12)",
          amount: 100,
          date: "2026-05-01",
          dueDate: "2026-06-01",
          status: "pending",
          isRecurring: true,
          installmentNumber: 2,
          installmentCount: 12,
          recurringGroupId: "rec-group-1",
        }),
      },
      {
        id: "tx-3",
        ref: { id: "tx-3" },
        data: () => ({
          tenantId: "tenant-1",
          type: "expense",
          description: "recorrente (3/12)",
          amount: 100,
          date: "2026-05-01",
          dueDate: "2026-07-01",
          status: "pending",
          isRecurring: true,
          installmentNumber: 3,
          installmentCount: 12,
          recurringGroupId: "rec-group-1",
        }),
      },
    ];

    // Mock Firestore transaction
    mockTransaction = {
      get: jest.fn((refOrQuery) => {
        // If it's a doc reference
        if (refOrQuery.id) {
          const doc = mockDocs.find((d) => d.id === refOrQuery.id);
          return Promise.resolve({
            exists: !!doc,
            data: () => doc?.data(),
          });
        }
        // If it's a query
        const isLimit = refOrQuery && refOrQuery.isLimitQuery;
        const docs = isLimit ? [] : mockDocs;
        return Promise.resolve({
          docs,
          empty: docs.length === 0,
        });
      }),
      update: jest.fn((ref, data) => {
        updatedData.push({ id: ref.id || ref, data });
      }),
      set: jest.fn(),
      delete: jest.fn(),
    };

    (db.runTransaction as jest.Mock).mockImplementation((cb) => cb(mockTransaction));

    const createMockCollection = () => {
      const queryObj: any = {
        doc: jest.fn((id) => ({ id })),
        where: jest.fn(() => queryObj),
        limit: jest.fn(() => {
          const limitQuery = createMockCollection();
          limitQuery.isLimitQuery = true;
          return limitQuery;
        }),
        isLimitQuery: false,
      };
      return queryObj;
    };
    (db.collection as jest.Mock).mockImplementation(() => createMockCollection());
  });

  test("should strip suffix and rebuild sequential names correctly when editing recurring series", async () => {
    // Simulate payload editing the 2nd installment
    const payload = {
      description: "recorrente (2/12)", // name from form
      amount: "100",
      date: "2026-05-01",
      dueDate: "2026-06-01",
      status: "pending" as const,
      isRecurring: true,
      installmentCount: 12,
      expectedUpdatedAt: "2026-05-22T16:00:00.000Z",
    };

    await TransactionService.updateFinancialEntryWithInstallments(
      "user-1",
      { email: "user@example.com" },
      "tx-2", // Edited anchor is tx-2
      payload
    );

    // Verify all 3 mock docs were updated
    expect(updatedData.length).toBe(3);
    
    // Sort updatedData by id or find them
    const tx1Update = updatedData.find((u) => u.id === "tx-1");
    const tx2Update = updatedData.find((u) => u.id === "tx-2");
    const tx3Update = updatedData.find((u) => u.id === "tx-3");

    expect(tx1Update).toBeDefined();
    expect(tx2Update).toBeDefined();
    expect(tx3Update).toBeDefined();

    // The first one should have suffix
    expect(tx1Update.data.description).toBe("recorrente (1/12)");
    // Subsequent ones should have correct sequential suffix based on payload.installmentCount
    expect(tx2Update.data.description).toBe("recorrente (2/12)");
    expect(tx3Update.data.description).toBe("recorrente (3/12)");
  });

  test("should generate next recurrence with the correct suffix when marking an occurrence as paid", async () => {
    const singleDoc = {
      id: "tx-2",
      ref: { id: "tx-2" },
      data: () => ({
        tenantId: "tenant-1",
        type: "expense",
        description: "recorrente (2/12)",
        amount: 100,
        date: "2026-05-01",
        dueDate: "2026-06-01",
        status: "pending",
        isRecurring: true,
        installmentNumber: 2,
        installmentCount: 12,
        recurringGroupId: "rec-group-1",
        updatedAt: { toMillis: () => 1000 },
      }),
    };

    mockDocs = [singleDoc];

    let createdTx: any = null;
    mockTransaction.set = jest.fn((ref, data) => {
      createdTx = data;
    });

    await TransactionService.updateTransaction(
      "user-1",
      { email: "user@example.com" },
      "tx-2",
      { status: "paid" }
    );

    expect(createdTx).not.toBeNull();
    expect(createdTx.installmentNumber).toBe(3);
    expect(createdTx.description).toBe("recorrente (3/12)");
  });

  test("should generate next 12 recurrences (13 to 24) at once when marking the 12th occurrence as paid", async () => {
    // We mock the existing documents in that group (1 to 12)
    mockDocs = Array.from({ length: 12 }, (_, i) => ({
      id: `tx-${i + 1}`,
      ref: { id: `tx-${i + 1}` },
      data: () => ({
        tenantId: "tenant-1",
        type: "expense",
        description: `recorrente (${i + 1}/12)`,
        amount: 100,
        date: "2026-05-01",
        dueDate: `2026-05-01`, // simplified
        status: i === 11 ? "pending" : "paid",
        isRecurring: true,
        installmentNumber: i + 1,
        installmentCount: 12,
        recurringGroupId: "rec-group-12",
        updatedAt: { toMillis: () => 1000 },
      }),
    }));

    const createdTxs: any[] = [];
    mockTransaction.set = jest.fn((ref, data) => {
      createdTxs.push(data);
    });

    await TransactionService.updateTransaction(
      "user-1",
      { email: "user@example.com" },
      "tx-12",
      { status: "paid" }
    );

    // Verify 12 new transactions were created (13 to 24)
    expect(createdTxs.length).toBe(12);
    expect(createdTxs[0].installmentNumber).toBe(13);
    expect(createdTxs[0].description).toBe("recorrente (13/24)");
    expect(createdTxs[11].installmentNumber).toBe(24);
    expect(createdTxs[11].description).toBe("recorrente (24/24)");

    // Verify that older transactions (1 to 12) were updated to /24
    const countUpdates = updatedData.filter(u => u.data.installmentCount === 24);
    expect(countUpdates.length).toBe(12);
    expect(countUpdates.find(u => u.id === "tx-1").data.description).toBe("recorrente (1/24)");
    expect(countUpdates.find(u => u.id === "tx-1").data.installmentCount).toBe(24);
  });

  test("should delete future recurrences (13 to 24) and restore limit back to 12 when reverting the 12th transaction payment", async () => {
    // We mock existing documents 1 to 24 in that group. 13-24 are pending.
    mockDocs = Array.from({ length: 24 }, (_, i) => ({
      id: `tx-${i + 1}`,
      ref: { id: `tx-${i + 1}` },
      data: () => ({
        tenantId: "tenant-1",
        type: "expense",
        description: `recorrente (${i + 1}/24)`,
        amount: 100,
        date: "2026-05-01",
        dueDate: `2026-05-01`, // simplified
        status: i < 12 ? "paid" : "pending", // 12 is paid initially in mockDocs
        isRecurring: true,
        installmentNumber: i + 1,
        installmentCount: 24,
        recurringGroupId: "rec-group-12",
        updatedAt: { toMillis: () => 1000 },
      }),
    }));

    const deletedRefs: any[] = [];
    mockTransaction.delete = jest.fn((ref) => {
      deletedRefs.push(ref);
    });

    await TransactionService.updateTransaction(
      "user-1",
      { email: "user@example.com" },
      "tx-12",
      { status: "pending" }
    );

    // Verify all future transactions (13 to 24) were deleted
    expect(deletedRefs.length).toBe(12);
    // Verify that remaining transactions (1 to 12) were updated back to /12
    const remainingUpdates = updatedData.filter(u => {
      const num = parseInt(u.id.replace("tx-", ""));
      return num <= 12 && u.data.installmentCount === 12;
    });
    expect(remainingUpdates.length).toBe(12);
    expect(remainingUpdates.find(u => u.id === "tx-1").data.description).toBe("recorrente (1/12)");
    expect(remainingUpdates.find(u => u.id === "tx-1").data.installmentCount).toBe(12);
  });
});
