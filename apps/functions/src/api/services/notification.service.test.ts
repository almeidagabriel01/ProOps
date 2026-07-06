/**
 * Unit tests for NotificationService hot-path methods:
 * - getUnreadCount must use the count() aggregation (never fetch documents)
 * - markAllAsRead must page updates in bounded batches of 400
 */

const countGetMock = jest.fn();
const queryGetMock = jest.fn();
const limitMock = jest.fn();
const batchUpdateMock = jest.fn();
const batchCommitMock = jest.fn();

const queryMock: Record<string, jest.Mock> = {
  where: jest.fn(),
  count: jest.fn(),
  limit: limitMock,
  get: queryGetMock,
};
queryMock.where.mockReturnValue(queryMock);
queryMock.count.mockReturnValue({ get: countGetMock });
limitMock.mockReturnValue(queryMock);

jest.mock("../../init", () => ({
  db: {
    collection: jest.fn(() => queryMock),
    batch: jest.fn(() => ({
      update: batchUpdateMock,
      commit: batchCommitMock,
    })),
  },
}));

jest.mock("../helpers/notification-scope", () => ({
  getNotificationScopeTenantId: jest.fn(() => "tenant-1"),
  isNotificationInScope: jest.fn(() => true),
}));

import { NotificationService } from "./notification.service";
import type { NotificationScope } from "../helpers/notification-scope";

const scope = { kind: "tenant", tenantId: "tenant-1" } as unknown as NotificationScope;

beforeEach(() => {
  jest.clearAllMocks();
  queryMock.where.mockReturnValue(queryMock);
  queryMock.count.mockReturnValue({ get: countGetMock });
  limitMock.mockReturnValue(queryMock);
});

describe("NotificationService.getUnreadCount", () => {
  it("uses count() aggregation instead of fetching documents", async () => {
    countGetMock.mockResolvedValue({ data: () => ({ count: 7 }) });

    const count = await NotificationService.getUnreadCount(scope);

    expect(count).toBe(7);
    expect(queryMock.count).toHaveBeenCalledTimes(1);
    expect(queryGetMock).not.toHaveBeenCalled();
  });
});

describe("NotificationService.markAllAsRead", () => {
  function makeDocs(n: number) {
    return Array.from({ length: n }, (_, i) => ({ ref: { id: `doc-${i}` } }));
  }

  it("pages through unread docs in batches of 400", async () => {
    const page1 = { empty: false, size: 400, docs: makeDocs(400) };
    const page2 = { empty: false, size: 1, docs: makeDocs(1) };
    queryGetMock.mockResolvedValueOnce(page1).mockResolvedValueOnce(page2);
    batchCommitMock.mockResolvedValue(undefined);

    await NotificationService.markAllAsRead(scope);

    expect(limitMock).toHaveBeenCalledWith(400);
    expect(queryGetMock).toHaveBeenCalledTimes(2);
    expect(batchCommitMock).toHaveBeenCalledTimes(2);
    expect(batchUpdateMock).toHaveBeenCalledTimes(401);
  });

  it("stops immediately when there is nothing unread", async () => {
    queryGetMock.mockResolvedValue({ empty: true, size: 0, docs: [] });

    await NotificationService.markAllAsRead(scope);

    expect(batchCommitMock).not.toHaveBeenCalled();
  });
});
