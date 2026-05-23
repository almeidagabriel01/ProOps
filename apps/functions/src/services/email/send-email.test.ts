/**
 * Unit tests for sendEmail — verifies that anti-spam headers, replyTo
 * defaults, audit writes, and Resend payload composition behave as expected.
 */

jest.mock("../../init", () => {
  const collectionMock = jest.fn(() => ({
    add: jest.fn().mockResolvedValue({ id: "audit_doc_id" }),
  }));
  return {
    db: { collection: collectionMock },
  };
});

jest.mock("../../lib/logger", () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

const resendSendMock = jest.fn();

const unsubscribeMock = jest.fn();

jest.mock("./resend-client", () => ({
  getResend: jest.fn(() => ({ emails: { send: resendSendMock } })),
  getEmailFrom: jest.fn(() => "ProOps <noreply@proops.com.br>"),
  getDefaultReplyTo: jest.fn(() => "gestao@proops.com.br"),
  getUnsubscribeMailto: () => unsubscribeMock(),
}));

import { sendEmail } from "./send-email";
import { db } from "../../init";

const mockCollection = db.collection as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  resendSendMock.mockResolvedValue({ data: { id: "resend_msg_123" } });
  unsubscribeMock.mockReturnValue(null); // default: header omitted
});

describe("sendEmail", () => {
  it("sends an email with the default From and the env-driven default Reply-To", async () => {
    const result = await sendEmail({
      to: "user@example.com",
      subject: "Hi",
      html: "<p>Hi</p>",
      type: "password_reset",
    });

    expect(result.ok).toBe(true);
    expect(result.messageId).toBe("resend_msg_123");

    expect(resendSendMock).toHaveBeenCalledTimes(1);
    const payload = resendSendMock.mock.calls[0][0];
    expect(payload.from).toBe("ProOps <noreply@proops.com.br>");
    expect(payload.replyTo).toBe("gestao@proops.com.br");
  });

  it("attaches anti-spam headers: X-Entity-Ref-ID, Auto-Submitted, X-Auto-Response-Suppress", async () => {
    await sendEmail({
      to: "user@example.com",
      subject: "Hi",
      html: "<p>Hi</p>",
      type: "password_reset",
    });

    const payload = resendSendMock.mock.calls[0][0];
    expect(payload.headers["Auto-Submitted"]).toBe("auto-generated");
    expect(payload.headers["X-Auto-Response-Suppress"]).toBe("All");
    expect(payload.headers["X-Entity-Ref-ID"]).toMatch(
      /^password_reset-\d+-[a-z0-9]+$/,
    );
  });

  it("omits List-Unsubscribe when no opt-in mailbox is configured", async () => {
    unsubscribeMock.mockReturnValue(null);

    await sendEmail({
      to: "user@example.com",
      subject: "Hi",
      html: "<p>Hi</p>",
      type: "password_reset",
    });

    const payload = resendSendMock.mock.calls[0][0];
    expect(payload.headers["List-Unsubscribe"]).toBeUndefined();
  });

  it("attaches List-Unsubscribe when an opt-in mailbox is configured", async () => {
    unsubscribeMock.mockReturnValue("unsubscribe@proops.com.br");

    await sendEmail({
      to: "user@example.com",
      subject: "Hi",
      html: "<p>Hi</p>",
      type: "marketing_newsletter",
    });

    const payload = resendSendMock.mock.calls[0][0];
    expect(payload.headers["List-Unsubscribe"]).toBe(
      "<mailto:unsubscribe@proops.com.br?subject=unsubscribe>",
    );
  });

  it("derives a `type` tag for Resend dashboard grouping when no explicit tags are passed", async () => {
    await sendEmail({
      to: "user@example.com",
      subject: "Hi",
      html: "<p>Hi</p>",
      type: "email_verification",
    });

    const payload = resendSendMock.mock.calls[0][0];
    expect(payload.tags).toEqual([{ name: "type", value: "email_verification" }]);
  });

  it("allows the caller to override replyTo and append custom headers", async () => {
    await sendEmail({
      to: "user@example.com",
      subject: "Hi",
      html: "<p>Hi</p>",
      type: "billing",
      replyTo: "billing@proops.com.br",
      headers: { "X-Custom": "yes" },
    });

    const payload = resendSendMock.mock.calls[0][0];
    expect(payload.replyTo).toBe("billing@proops.com.br");
    expect(payload.headers["X-Custom"]).toBe("yes");
    expect(payload.headers["Auto-Submitted"]).toBe("auto-generated"); // base headers preserved
  });

  it("writes an email_audit doc with status=sent including the messageId on success", async () => {
    await sendEmail({
      to: "user@example.com",
      subject: "Hi",
      html: "<p>Hi</p>",
      type: "password_reset",
    });

    expect(mockCollection).toHaveBeenCalledWith("email_audit");
    const addArg = (mockCollection.mock.results[0].value.add as jest.Mock).mock
      .calls[0][0];
    expect(addArg).toMatchObject({
      type: "password_reset",
      to: "user@example.com",
      status: "sent",
      messageId: "resend_msg_123",
      tenantId: null,
    });
    expect(addArg.entityRefId).toMatch(/^password_reset-\d+-[a-z0-9]+$/);
  });

  it("writes an email_audit doc with status=failed when Resend throws", async () => {
    resendSendMock.mockRejectedValue(new Error("rate limited"));

    const result = await sendEmail({
      to: "user@example.com",
      subject: "Hi",
      html: "<p>Hi</p>",
      type: "password_reset",
    });

    expect(result.ok).toBe(false);
    expect(result.error).toBe("rate limited");

    expect(mockCollection).toHaveBeenCalledWith("email_audit");
    const addArg = (mockCollection.mock.results[0].value.add as jest.Mock).mock
      .calls[0][0];
    expect(addArg).toMatchObject({
      type: "password_reset",
      to: "user@example.com",
      status: "failed",
      messageId: null,
      error: "rate limited",
    });
  });

  it("passes text/plain alternative when provided", async () => {
    await sendEmail({
      to: "user@example.com",
      subject: "Hi",
      html: "<p>Hi</p>",
      text: "Hi",
      type: "password_reset",
    });

    const payload = resendSendMock.mock.calls[0][0];
    expect(payload.text).toBe("Hi");
  });
});
