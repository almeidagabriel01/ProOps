import { createHmac } from "crypto";

// Set test env so getSecret() uses process.env.CONFIRMATION_SECRET
process.env.NODE_ENV = "test";
process.env.CONFIRMATION_SECRET = "test-secret";

// Mock logger to silence output
jest.mock("../../lib/logger", () => ({
  logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import { generateConfirmationToken, validateConfirmationToken } from "./confirmation-token";

describe("generateConfirmationToken / validateConfirmationToken", () => {
  test("fresh token validates against its own sessionId", () => {
    const token = generateConfirmationToken("sess-1", "delete_contact");
    expect(validateConfirmationToken(token, "sess-1")).toBe(true);
  });

  test("rejects token presented with a different sessionId", () => {
    const token = generateConfirmationToken("sess-1", "delete_contact");
    expect(validateConfirmationToken(token, "sess-other")).toBe(false);
  });

  test("rejects an expired token (expiresAt in the past)", () => {
    const secret = "test-secret";
    const sessionId = "sess-exp";
    const action = "create_transaction";
    const expiresAt = Date.now() - 1000; // 1 second in the past
    const payload = `${sessionId}:${action}:${expiresAt}`;
    const sig = createHmac("sha256", secret).update(payload).digest("hex");
    const data = JSON.stringify({ sessionId, action, expiresAt, sig });
    const token = Buffer.from(data).toString("base64url");
    expect(validateConfirmationToken(token, sessionId)).toBe(false);
  });

  test("rejects token with tampered signature", () => {
    const token = generateConfirmationToken("sess-2", "transfer_between_wallets");
    const decoded = JSON.parse(Buffer.from(token, "base64url").toString()) as Record<string, unknown>;
    decoded.sig = "000000000000000000000000000000000000000000000000000000000000000";
    const tampered = Buffer.from(JSON.stringify(decoded)).toString("base64url");
    expect(validateConfirmationToken(tampered, "sess-2")).toBe(false);
  });

  test("rejects malformed base64url input", () => {
    expect(validateConfirmationToken("not-valid-base64!!!", "sess-any")).toBe(false);
  });

  test("rejects token with missing fields", () => {
    const partial = Buffer.from(JSON.stringify({ sessionId: "sess-x" })).toString("base64url");
    expect(validateConfirmationToken(partial, "sess-x")).toBe(false);
  });

  test("two tokens for different actions on the same session are both valid", () => {
    const t1 = generateConfirmationToken("sess-3", "delete_contact");
    const t2 = generateConfirmationToken("sess-3", "create_transaction");
    expect(validateConfirmationToken(t1, "sess-3")).toBe(true);
    expect(validateConfirmationToken(t2, "sess-3")).toBe(true);
  });
});
