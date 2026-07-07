/**
 * Unit tests for notifyInternalLifecycle — recipient resolution, emulator
 * skip, doc loading, and the never-throws guarantee.
 */

const userGetMock = jest.fn();
const tenantGetMock = jest.fn();

jest.mock("../../init", () => ({
  db: {
    collection: jest.fn((name: string) => ({
      doc: jest.fn(() => ({
        get: name === "users" ? userGetMock : tenantGetMock,
      })),
    })),
  },
}));

jest.mock("../../lib/logger", () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

const isEmulatedRuntimeMock = jest.fn();
jest.mock("../../lib/rate-limit/emulator", () => ({
  isEmulatedRuntime: () => isEmulatedRuntimeMock(),
}));

const sendEmailMock = jest.fn();
jest.mock("./send-email", () => ({
  sendEmail: (opts: unknown) => sendEmailMock(opts),
}));

import { getInternalNotifyEmail, notifyInternalLifecycle } from "./internal-notify";
import { logger } from "../../lib/logger";

beforeEach(() => {
  jest.clearAllMocks();
  delete process.env.INTERNAL_NOTIFY_EMAIL;
  isEmulatedRuntimeMock.mockReturnValue(false);
  sendEmailMock.mockResolvedValue({ ok: true, messageId: "msg_1" });
  userGetMock.mockResolvedValue({
    data: () => ({
      name: "João",
      email: "joao@exemplo.com",
      phoneNumber: "+55 11 98888-0000",
      role: "free",
    }),
  });
  tenantGetMock.mockResolvedValue({
    data: () => ({ name: "Empresa X", niche: "cortinas" }),
  });
});

afterEach(() => {
  delete process.env.INTERNAL_NOTIFY_EMAIL;
});

describe("getInternalNotifyEmail", () => {
  it("defaults to gestao@proops.com.br", () => {
    expect(getInternalNotifyEmail()).toBe("gestao@proops.com.br");
  });

  it("honors INTERNAL_NOTIFY_EMAIL override", () => {
    process.env.INTERNAL_NOTIFY_EMAIL = "teste@proops.com.br";
    expect(getInternalNotifyEmail()).toBe("teste@proops.com.br");
  });
});

describe("notifyInternalLifecycle", () => {
  it("sends to the internal address with lifecycle_<event> type", async () => {
    await notifyInternalLifecycle({
      event: "signup",
      tenantId: "tenant_u1",
      userId: "u1",
    });

    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    const payload = sendEmailMock.mock.calls[0][0];
    expect(payload.to).toBe("gestao@proops.com.br");
    expect(payload.type).toBe("lifecycle_signup");
    expect(payload.tenantId).toBe("tenant_u1");
    expect(payload.subject).toContain("Novo cadastro");
    expect(payload.html).toContain("joao@exemplo.com");
    expect(payload.html).toContain("Empresa X");
  });

  it("skips entirely on emulated runtime", async () => {
    isEmulatedRuntimeMock.mockReturnValue(true);

    await notifyInternalLifecycle({ event: "signup", tenantId: "t1", userId: "u1" });

    expect(sendEmailMock).not.toHaveBeenCalled();
    expect(userGetMock).not.toHaveBeenCalled();
  });

  it("uses provided userData without reading users collection", async () => {
    await notifyInternalLifecycle({
      event: "team_member_added",
      tenantId: "t1",
      userId: "u2",
      userData: { name: "Maria", email: "maria@exemplo.com" },
    });

    expect(userGetMock).not.toHaveBeenCalled();
    const payload = sendEmailMock.mock.calls[0][0];
    expect(payload.html).toContain("maria@exemplo.com");
  });

  it("formats effectiveAt in pt-BR", async () => {
    await notifyInternalLifecycle({
      event: "plan_downgrade",
      tenantId: "t1",
      userId: "u1",
      plan: { from: "pro", to: "starter", effectiveAt: new Date("2026-08-15T12:00:00Z") },
    });

    const payload = sendEmailMock.mock.calls[0][0];
    expect(payload.html).toContain("15/08/2026");
  });

  it("does not throw when the user read rejects (degrades to missing fields)", async () => {
    userGetMock.mockRejectedValue(new Error("firestore down"));

    await expect(
      notifyInternalLifecycle({ event: "signup", tenantId: "t1", userId: "u1" }),
    ).resolves.toBeUndefined();

    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalled();
  });

  it("does not throw when the tenant read rejects", async () => {
    tenantGetMock.mockRejectedValue(new Error("firestore down"));

    await expect(
      notifyInternalLifecycle({ event: "signup", tenantId: "t1", userId: "u1" }),
    ).resolves.toBeUndefined();

    expect(sendEmailMock).toHaveBeenCalledTimes(1);
  });

  it("does not throw when sendEmail returns {ok:false}", async () => {
    sendEmailMock.mockResolvedValue({ ok: false, error: "rate limited" });

    await expect(
      notifyInternalLifecycle({ event: "signup", tenantId: "t1", userId: "u1" }),
    ).resolves.toBeUndefined();

    expect(logger.warn).toHaveBeenCalled();
  });

  it("does not throw when sendEmail rejects unexpectedly", async () => {
    sendEmailMock.mockRejectedValue(new Error("boom"));

    await expect(
      notifyInternalLifecycle({ event: "signup", tenantId: "t1", userId: "u1" }),
    ).resolves.toBeUndefined();

    expect(logger.warn).toHaveBeenCalled();
  });
});
