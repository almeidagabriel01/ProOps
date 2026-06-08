const mockUpdateUser = jest.fn();
const mockGetUser = jest.fn();
const mockDocGet = jest.fn();
const mockDocSet = jest.fn();
const mockDoc = jest.fn(() => ({ get: mockDocGet, set: mockDocSet }));
const mockCollection = jest.fn(() => ({ doc: mockDoc }));

jest.mock("../../init", () => ({
  auth: { updateUser: mockUpdateUser, getUser: mockGetUser },
  db: { collection: mockCollection },
}));

jest.mock("../logger", () => ({
  logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn() },
}));

jest.mock("../../services/email/send-email", () => ({
  sendEmail: jest.fn(),
}));

jest.mock("firebase-admin/firestore", () => ({
  FieldValue: { delete: jest.fn(() => "__DELETE__") },
}));

import { clearUserMfaFactors } from "../mfa-reset";
import { sendEmail } from "../../services/email/send-email";

const mockSendEmail = sendEmail as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockUpdateUser.mockResolvedValue(undefined);
  mockDocSet.mockResolvedValue(undefined);
  mockDocGet.mockResolvedValue({ data: () => ({ name: "Alice" }) });
  mockGetUser.mockResolvedValue({
    email: "alice@example.com",
    displayName: "Alice",
  });
  mockSendEmail.mockResolvedValue({ ok: true, messageId: "m1" });
});

describe("clearUserMfaFactors", () => {
  it("removes enrolled factors via updateUser", async () => {
    await clearUserMfaFactors("uid-1");
    expect(mockUpdateUser).toHaveBeenCalledWith("uid-1", {
      multiFactor: { enrolledFactors: null },
    });
  });

  it("clears the WhatsApp MFA flags on the user document", async () => {
    await clearUserMfaFactors("uid-1");
    expect(mockDocSet).toHaveBeenCalledWith(
      expect.objectContaining({
        whatsappMfaEnabled: false,
        whatsappMfaPhone: "__DELETE__",
      }),
      { merge: true },
    );
  });

  it("sends the security notification email", async () => {
    await clearUserMfaFactors("uid-1");
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    const args = mockSendEmail.mock.calls[0][0];
    expect(args.to).toBe("alice@example.com");
    expect(args.type).toBe("mfa_disabled");
  });

  it("still resolves when sendEmail rejects (best-effort notification)", async () => {
    mockSendEmail.mockRejectedValue(new Error("resend down"));
    await expect(clearUserMfaFactors("uid-1")).resolves.toBeUndefined();
    // factors were still removed despite the email failure
    expect(mockUpdateUser).toHaveBeenCalled();
    expect(mockDocSet).toHaveBeenCalled();
  });

  it("does not send an email when no address is found", async () => {
    mockDocGet.mockResolvedValue({ data: () => undefined });
    mockGetUser.mockResolvedValue({ email: undefined, displayName: undefined });
    await clearUserMfaFactors("uid-1");
    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(mockUpdateUser).toHaveBeenCalled();
  });
});
