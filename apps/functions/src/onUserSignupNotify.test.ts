/**
 * Unit tests for handleUserCreatedNotify — owner vs team-member
 * classification, idempotency claim, and error swallowing.
 */

const claimCreateMock = jest.fn();

jest.mock("./init", () => ({
  db: {
    collection: jest.fn(() => ({
      doc: jest.fn(() => ({ create: claimCreateMock })),
    })),
  },
}));

jest.mock("./lib/logger", () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

const isEmulatedRuntimeMock = jest.fn();
jest.mock("./lib/rate-limit/emulator", () => ({
  isEmulatedRuntime: () => isEmulatedRuntimeMock(),
}));

const notifyMock = jest.fn();
jest.mock("./services/email/internal-notify", () => ({
  notifyInternalLifecycle: (opts: unknown) => notifyMock(opts),
}));

jest.mock("firebase-functions/v2/firestore", () => ({
  onDocumentCreated: jest.fn(() => jest.fn()),
}));

import { handleUserCreatedNotify } from "./onUserSignupNotify";
import { logger } from "./lib/logger";

function makeEvent(uid: string, data: Record<string, unknown> | undefined) {
  return {
    data: data ? { data: () => data } : undefined,
    params: { uid },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  isEmulatedRuntimeMock.mockReturnValue(false);
  claimCreateMock.mockResolvedValue(undefined);
  notifyMock.mockResolvedValue(undefined);
});

describe("handleUserCreatedNotify", () => {
  it("sends a signup notification for a new account owner", async () => {
    await handleUserCreatedNotify(
      makeEvent("u1", {
        tenantId: "tenant_u1",
        name: "João",
        email: "joao@exemplo.com",
        phoneNumber: "+55 11 90000-0000",
        role: "free",
      }),
    );

    expect(notifyMock).toHaveBeenCalledTimes(1);
    const opts = notifyMock.mock.calls[0][0];
    expect(opts.event).toBe("signup");
    expect(opts.tenantId).toBe("tenant_u1");
    expect(opts.userId).toBe("u1");
    expect(opts.userData).toEqual({
      name: "João",
      email: "joao@exemplo.com",
      phone: "+55 11 90000-0000",
      role: "free",
    });
  });

  it("sends team_member_added when tenantId belongs to another owner", async () => {
    await handleUserCreatedNotify(
      makeEvent("member1", {
        tenantId: "tenant_owner9",
        name: "Maria",
        email: "maria@exemplo.com",
        role: "MEMBER",
      }),
    );

    expect(notifyMock).toHaveBeenCalledTimes(1);
    expect(notifyMock.mock.calls[0][0].event).toBe("team_member_added");
  });

  it("skips when the claim already exists (trigger retry)", async () => {
    claimCreateMock.mockRejectedValue(new Error("ALREADY_EXISTS"));

    await handleUserCreatedNotify(
      makeEvent("u1", { tenantId: "tenant_u1", email: "a@b.com" }),
    );

    expect(notifyMock).not.toHaveBeenCalled();
  });

  it("skips on emulated runtime without writing a claim", async () => {
    isEmulatedRuntimeMock.mockReturnValue(true);

    await handleUserCreatedNotify(
      makeEvent("u1", { tenantId: "tenant_u1", email: "a@b.com" }),
    );

    expect(claimCreateMock).not.toHaveBeenCalled();
    expect(notifyMock).not.toHaveBeenCalled();
  });

  it("returns silently when the snapshot has no data", async () => {
    await handleUserCreatedNotify(makeEvent("u1", undefined));

    expect(notifyMock).not.toHaveBeenCalled();
  });

  it("warns and skips when the user doc has no tenantId", async () => {
    await handleUserCreatedNotify(makeEvent("u1", { email: "a@b.com" }));

    expect(notifyMock).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalled();
  });

  it("never throws when the notify helper rejects", async () => {
    notifyMock.mockRejectedValue(new Error("boom"));

    await expect(
      handleUserCreatedNotify(
        makeEvent("u1", { tenantId: "tenant_u1", email: "a@b.com" }),
      ),
    ).resolves.toBeUndefined();

    expect(logger.error).toHaveBeenCalled();
  });
});
