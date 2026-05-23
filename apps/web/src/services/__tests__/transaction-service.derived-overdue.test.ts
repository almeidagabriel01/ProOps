import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// transaction-service imports Firebase init eagerly; stub the Firestore SDK
// so a test environment without env vars can still import the module.
vi.mock("firebase/firestore", () => ({
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  getDocs: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn(),
}));
vi.mock("@/lib/firebase", () => ({ db: {} }));
vi.mock("@/lib/api-client", () => ({ callApi: vi.fn() }));
vi.mock("@/lib/service-cache", () => ({ createTTLCache: vi.fn() }));

import { withDerivedOverdue } from "../transaction-service";
import type { Transaction } from "../transaction-service";

const baseTx = {
  id: "tx1",
  tenantId: "tenant1",
  type: "expense" as const,
  description: "Aluguel",
  amount: 100,
  date: "2026-05-01",
} satisfies Partial<Transaction>;

describe("withDerivedOverdue", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-21T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("marks pending as overdue when dueDate is in the past", () => {
    const result = withDerivedOverdue({
      ...baseTx,
      status: "pending",
      dueDate: "2026-05-20",
    } as Transaction);
    expect(result.status).toBe("overdue");
  });

  it("keeps pending when dueDate is today", () => {
    const result = withDerivedOverdue({
      ...baseTx,
      status: "pending",
      dueDate: "2026-05-21",
    } as Transaction);
    expect(result.status).toBe("pending");
  });

  it("keeps pending when dueDate is in the future", () => {
    const result = withDerivedOverdue({
      ...baseTx,
      status: "pending",
      dueDate: "2026-05-22",
    } as Transaction);
    expect(result.status).toBe("pending");
  });

  it("does not touch paid transactions", () => {
    const result = withDerivedOverdue({
      ...baseTx,
      status: "paid",
      dueDate: "2025-01-01",
    } as Transaction);
    expect(result.status).toBe("paid");
  });

  it("does not touch transactions without dueDate", () => {
    const result = withDerivedOverdue({
      ...baseTx,
      status: "pending",
    } as Transaction);
    expect(result.status).toBe("pending");
  });

  it("does not mutate the input object", () => {
    const input = {
      ...baseTx,
      status: "pending" as const,
      dueDate: "2026-05-20",
    } as Transaction;
    const result = withDerivedOverdue(input);
    expect(input.status).toBe("pending");
    expect(result).not.toBe(input);
  });
});
