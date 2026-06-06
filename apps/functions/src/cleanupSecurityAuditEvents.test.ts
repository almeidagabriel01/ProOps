/**
 * Unit tests for the security-audit retention cleanup (point 4).
 */

let mockGetCallCount = 0;
const mockBatchDelete = jest.fn();
const mockBatchCommit = jest.fn().mockResolvedValue(undefined);

jest.mock("firebase-functions/v2/scheduler", () => ({
  onSchedule: () => ({}),
}));

jest.mock("./deploymentConfig", () => ({ SCHEDULE_OPTIONS: {} }));

jest.mock("./lib/logger", () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

jest.mock("./lib/security-observability", () => ({
  resolveSecurityAuditCollection: () => "security_audit_events",
}));

jest.mock("./init", () => ({
  db: {
    collection: () => ({
      where: () => ({
        orderBy: () => ({
          limit: () => ({
            get: async () => {
              mockGetCallCount += 1;
              if (mockGetCallCount === 1) {
                return {
                  empty: false,
                  size: 2,
                  docs: [{ ref: "ref-1" }, { ref: "ref-2" }],
                };
              }
              return { empty: true, size: 0, docs: [] };
            },
          }),
        }),
      }),
    }),
    batch: () => ({
      delete: mockBatchDelete,
      commit: mockBatchCommit,
    }),
  },
}));

import { runCleanupSecurityAuditEvents } from "./cleanupSecurityAuditEvents";

beforeEach(() => {
  jest.clearAllMocks();
  mockGetCallCount = 0;
});

describe("runCleanupSecurityAuditEvents", () => {
  it("deletes a batch of expired events and reports metrics", async () => {
    const result = await runCleanupSecurityAuditEvents();

    expect(result).toEqual({ totalDeleted: 2, batchesCommitted: 1 });
    expect(mockBatchDelete).toHaveBeenCalledTimes(2);
    expect(mockBatchCommit).toHaveBeenCalledTimes(1);
  });

  it("does nothing when there are no expired events", async () => {
    mockGetCallCount = 5; // forces the first get() into the empty branch

    const result = await runCleanupSecurityAuditEvents();

    expect(result).toEqual({ totalDeleted: 0, batchesCommitted: 0 });
    expect(mockBatchCommit).not.toHaveBeenCalled();
  });
});
