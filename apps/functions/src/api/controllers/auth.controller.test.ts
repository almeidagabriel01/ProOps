/**
 * Unit tests for auth.controller.ts (custom password reset flow).
 * Verifies enumeration safety, clean URL composition, and email payload.
 */

jest.mock("../../init", () => ({
  auth: {
    generatePasswordResetLink: jest.fn(),
    generateEmailVerificationLink: jest.fn(),
    getUser: jest.fn(),
  },
}));

jest.mock("../../lib/logger", () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

jest.mock("../../lib/request-origin", () => ({
  resolveTrustedRequestOrigin: jest.fn(() => "https://app.proops.com.br"),
}));

jest.mock("../../services/email/send-email", () => ({
  sendEmail: jest.fn(),
}));

import type { Request, Response } from "express";
import { auth } from "../../init";
import { sendEmail } from "../../services/email/send-email";
import {
  requestEmailVerification,
  requestPasswordReset,
} from "./auth.controller";

const mockGenerateLink = auth.generatePasswordResetLink as jest.Mock;
const mockGenerateVerifyLink = auth.generateEmailVerificationLink as jest.Mock;
const mockGetUser = auth.getUser as jest.Mock;
const mockSendEmail = sendEmail as jest.Mock;

function makeReq(body: unknown, user?: { uid: string }): Request {
  return { body, user, headers: {} } as unknown as Request;
}

function makeRes(): { res: Response; json: jest.Mock; status: jest.Mock } {
  const json = jest.fn().mockReturnThis();
  const status = jest.fn().mockReturnValue({ json });
  const res = { status, json } as unknown as Response;
  return { res, json, status };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockSendEmail.mockResolvedValue({ ok: true, messageId: "msg_123" });
});

describe("requestPasswordReset", () => {
  it("returns 200 with success for a valid existing email and sends a clean-URL email", async () => {
    mockGenerateLink.mockResolvedValue(
      "https://erp.firebaseapp.com/__/auth/action?mode=resetPassword&oobCode=ABC123&apiKey=AIzaSyDummy&lang=pt-BR",
    );

    const req = makeReq({ email: "user@example.com" });
    const { res, status, json } = makeRes();

    await requestPasswordReset(req, res);

    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith({ success: true });
    expect(mockGenerateLink).toHaveBeenCalledWith(
      "user@example.com",
      expect.objectContaining({ handleCodeInApp: false }),
    );
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    const emailArgs = mockSendEmail.mock.calls[0][0];
    expect(emailArgs.to).toBe("user@example.com");
    expect(emailArgs.type).toBe("password_reset");
    expect(emailArgs.html).toContain(
      "https://app.proops.com.br/reset?code=ABC123",
    );
    expect(emailArgs.html).not.toContain("apiKey=");
    expect(emailArgs.html).not.toContain("oobCode=");
    expect(emailArgs.text).toContain(
      "https://app.proops.com.br/reset?code=ABC123",
    );
    expect(emailArgs.text).not.toContain("apiKey=");
  });

  it("URL-encodes the oobCode when composing the clean URL", async () => {
    mockGenerateLink.mockResolvedValue(
      "https://erp.firebaseapp.com/__/auth/action?mode=resetPassword&oobCode=a%2Fb%2Bc&apiKey=key",
    );

    const req = makeReq({ email: "user@example.com" });
    const { res } = makeRes();

    await requestPasswordReset(req, res);

    const emailArgs = mockSendEmail.mock.calls[0][0];
    expect(emailArgs.html).toContain(
      "https://app.proops.com.br/reset?code=a%2Fb%2Bc",
    );
  });

  it("returns 200 with success when email is unknown (no enumeration leak)", async () => {
    const notFoundErr = Object.assign(new Error("not found"), {
      code: "auth/user-not-found",
    });
    mockGenerateLink.mockRejectedValue(notFoundErr);

    const req = makeReq({ email: "ghost@example.com" });
    const { res, status, json } = makeRes();

    await requestPasswordReset(req, res);

    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith({ success: true });
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("returns 200 with success when payload is malformed (no enumeration leak)", async () => {
    const req = makeReq({ email: "not-an-email" });
    const { res, status, json } = makeRes();

    await requestPasswordReset(req, res);

    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith({ success: true });
    expect(mockGenerateLink).not.toHaveBeenCalled();
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("returns 200 with success when sendEmail fails (no leak to caller)", async () => {
    mockGenerateLink.mockResolvedValue(
      "https://erp.firebaseapp.com/__/auth/action?mode=resetPassword&oobCode=XYZ&apiKey=key",
    );
    mockSendEmail.mockResolvedValue({ ok: false, error: "smtp down" });

    const req = makeReq({ email: "user@example.com" });
    const { res, status, json } = makeRes();

    await requestPasswordReset(req, res);

    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith({ success: true });
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
  });

  it("returns 200 with success on unexpected admin error (does not throw)", async () => {
    mockGenerateLink.mockRejectedValue(new Error("unexpected admin failure"));

    const req = makeReq({ email: "user@example.com" });
    const { res, status, json } = makeRes();

    await requestPasswordReset(req, res);

    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith({ success: true });
    expect(mockSendEmail).not.toHaveBeenCalled();
  });
});

describe("requestEmailVerification", () => {
  it("returns 401 when request has no authenticated user", async () => {
    const req = makeReq({});
    const { res, status, json } = makeRes();

    await requestEmailVerification(req, res);

    expect(status).toHaveBeenCalledWith(401);
    expect(json).toHaveBeenCalledWith({ message: "Não autenticado." });
    expect(mockGenerateVerifyLink).not.toHaveBeenCalled();
  });

  it("sends a verification email with a clean URL when user is unverified", async () => {
    mockGetUser.mockResolvedValue({
      email: "user@example.com",
      emailVerified: false,
    });
    mockGenerateVerifyLink.mockResolvedValue(
      "https://erp.firebaseapp.com/__/auth/action?mode=verifyEmail&oobCode=VERIFY_CODE&apiKey=AIzaKey&lang=pt-BR",
    );

    const req = makeReq({}, { uid: "uid_123" });
    const { res, status, json } = makeRes();

    await requestEmailVerification(req, res);

    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith({ success: true });
    expect(mockGenerateVerifyLink).toHaveBeenCalledWith(
      "user@example.com",
      expect.objectContaining({ handleCodeInApp: false }),
    );
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    const emailArgs = mockSendEmail.mock.calls[0][0];
    expect(emailArgs.to).toBe("user@example.com");
    expect(emailArgs.type).toBe("email_verification");
    expect(emailArgs.html).toContain(
      "https://app.proops.com.br/verify?code=VERIFY_CODE",
    );
    expect(emailArgs.html).not.toContain("apiKey=");
    expect(emailArgs.text).toContain(
      "https://app.proops.com.br/verify?code=VERIFY_CODE",
    );
  });

  it("returns alreadyVerified without sending email when user is already verified", async () => {
    mockGetUser.mockResolvedValue({
      email: "user@example.com",
      emailVerified: true,
    });

    const req = makeReq({}, { uid: "uid_123" });
    const { res, status, json } = makeRes();

    await requestEmailVerification(req, res);

    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith({
      success: true,
      alreadyVerified: true,
    });
    expect(mockGenerateVerifyLink).not.toHaveBeenCalled();
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("returns 400 when the account has no email", async () => {
    mockGetUser.mockResolvedValue({ emailVerified: false });

    const req = makeReq({}, { uid: "uid_123" });
    const { res, status, json } = makeRes();

    await requestEmailVerification(req, res);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      message: "Conta sem email associado.",
    });
    expect(mockGenerateVerifyLink).not.toHaveBeenCalled();
  });

  it("returns 500 when the email send fails", async () => {
    mockGetUser.mockResolvedValue({
      email: "user@example.com",
      emailVerified: false,
    });
    mockGenerateVerifyLink.mockResolvedValue(
      "https://erp.firebaseapp.com/__/auth/action?mode=verifyEmail&oobCode=ABC&apiKey=key",
    );
    mockSendEmail.mockResolvedValue({ ok: false, error: "smtp down" });

    const req = makeReq({}, { uid: "uid_123" });
    const { res, status, json } = makeRes();

    await requestEmailVerification(req, res);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      message: "Erro ao enviar email de verificação.",
    });
  });
});
