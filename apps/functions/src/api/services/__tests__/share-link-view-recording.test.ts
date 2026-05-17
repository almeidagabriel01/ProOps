/**
 * Regression test for share-link view recording with undefined ip.
 *
 * Bug: When req.ip is undefined (CI/emulator, share-link viewed without
 * x-forwarded-for header), anonymizeIP() returns undefined, and pushing
 * { ip: undefined, ... } into FieldValue.arrayUnion throws:
 *   "Element at index 0 is not a valid array element.
 *    Cannot use 'undefined' as a Firestore value (found in field 'ip')."
 *
 * Fix: omit the ip field when undefined so the arrayUnion payload is valid.
 */

jest.mock("../../../init", () => ({
  db: { collection: jest.fn() },
}));

jest.mock("../../../lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock("firebase-admin/firestore", () => ({
  FieldValue: {
    arrayUnion: jest.fn((...items: unknown[]) => ({ __op: "arrayUnion", items })),
  },
}));

jest.mock("../notification.service", () => ({
  NotificationService: {
    createNotification: jest.fn().mockResolvedValue(undefined),
  },
}));

import { SharedTransactionService } from "../shared-transactions.service";
import { SharedProposalService } from "../shared-proposal.service";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "../../../init";

const arrayUnionMock = FieldValue.arrayUnion as unknown as jest.Mock;
const dbMock = db as unknown as { collection: jest.Mock };

function makeDocStub() {
  const update = jest.fn().mockResolvedValue(undefined);
  const get = jest.fn().mockResolvedValue({
    exists: true,
    data: () => ({ proposalId: "p1", tenantId: "t1" }),
  });
  return { update, get };
}

describe("Share-link view recording: undefined ip is filtered before arrayUnion", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("SharedTransactionService.recordView omits ip when viewerData.ip is undefined", async () => {
    const docStub = makeDocStub();
    dbMock.collection.mockReturnValue({ doc: jest.fn().mockReturnValue(docStub) });

    await SharedTransactionService.recordView(
      "shared-tx-1",
      "tenant-1",
      "tx-1",
      { ip: undefined, userAgent: "Mozilla/5.0" },
      "Test transaction",
    );

    expect(arrayUnionMock).toHaveBeenCalledTimes(1);
    const viewerInfo = arrayUnionMock.mock.calls[0][0];
    expect(viewerInfo).toEqual(
      expect.objectContaining({
        userAgent: expect.any(String),
        timestamp: expect.any(String),
      }),
    );
    expect(Object.prototype.hasOwnProperty.call(viewerInfo, "ip")).toBe(false);
    // No undefined values in any field — Firestore arrayUnion rejects undefined.
    for (const value of Object.values(viewerInfo)) {
      expect(value).not.toBe(undefined);
    }
    expect(docStub.update).toHaveBeenCalledTimes(1);
  });

  test("SharedTransactionService.recordView keeps ip when present", async () => {
    const docStub = makeDocStub();
    dbMock.collection.mockReturnValue({ doc: jest.fn().mockReturnValue(docStub) });

    await SharedTransactionService.recordView(
      "shared-tx-2",
      "tenant-1",
      "tx-2",
      { ip: "203.0.113.42", userAgent: "Mozilla/5.0" },
      "Test transaction 2",
    );

    expect(arrayUnionMock).toHaveBeenCalledTimes(1);
    const viewerInfo = arrayUnionMock.mock.calls[0][0];
    expect(viewerInfo.ip).toBeTruthy();
    expect(viewerInfo.ip).not.toBe(undefined);
  });

  test("SharedProposalService.recordView omits ip when viewerData.ip is undefined", async () => {
    const docStub = makeDocStub();
    const proposalDocStub = {
      get: jest.fn().mockResolvedValue({
        exists: true,
        data: () => ({ title: "Test proposal", tenantId: "tenant-1" }),
      }),
    };
    dbMock.collection.mockImplementation((name: string) => {
      if (name === "proposals") {
        return { doc: jest.fn().mockReturnValue(proposalDocStub) };
      }
      return { doc: jest.fn().mockReturnValue(docStub) };
    });

    await SharedProposalService.recordView(
      "shared-prop-1",
      "tenant-1",
      "prop-1",
      { ip: undefined, userAgent: "Mozilla/5.0" },
      "Test proposal",
    );

    expect(arrayUnionMock).toHaveBeenCalledTimes(1);
    const viewerInfo = arrayUnionMock.mock.calls[0][0];
    expect(viewerInfo).toEqual(
      expect.objectContaining({
        userAgent: expect.any(String),
        timestamp: expect.any(String),
      }),
    );
    expect(Object.prototype.hasOwnProperty.call(viewerInfo, "ip")).toBe(false);
    expect(docStub.update).toHaveBeenCalledTimes(1);
  });

  test("Neither ip nor userAgent appears when both are undefined", async () => {
    const docStub = makeDocStub();
    dbMock.collection.mockReturnValue({ doc: jest.fn().mockReturnValue(docStub) });

    await SharedTransactionService.recordView(
      "shared-tx-3",
      "tenant-1",
      "tx-3",
      { ip: undefined, userAgent: undefined },
      "Test",
    );

    expect(arrayUnionMock).toHaveBeenCalledTimes(1);
    const viewerInfo = arrayUnionMock.mock.calls[0][0];
    expect(Object.prototype.hasOwnProperty.call(viewerInfo, "ip")).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(viewerInfo, "userAgent")).toBe(false);
    expect(viewerInfo.timestamp).toEqual(expect.any(String));
  });
});
