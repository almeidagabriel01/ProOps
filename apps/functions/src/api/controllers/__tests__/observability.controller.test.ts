process.env.NODE_ENV = "test";

const captureError = jest.fn();
const verifyReportIdentity = jest.fn();
jest.mock("../../../lib/observability/error-logger", () => ({
  captureError: (...a: unknown[]) => captureError(...a),
}));
jest.mock("../../../lib/observability/verify-report-identity", () => ({
  verifyReportIdentity: (...a: unknown[]) => verifyReportIdentity(...a),
}));

import { Request, Response } from "express";
import { ingestClientError } from "../observability.controller";

function mockRes() {
  const res: Partial<Response> & { _status?: number; _json?: unknown } = {};
  res.status = ((c: number) => { res._status = c; return res as Response; }) as Response["status"];
  res.json = ((b: unknown) => { res._json = b; return res as Response; }) as Response["json"];
  return res as Response & { _status?: number; _json?: unknown };
}
function req(body: unknown, user?: unknown): Request {
  return { body, headers: { "user-agent": "jest" }, user } as unknown as Request;
}

beforeEach(() => {
  captureError.mockReset();
  verifyReportIdentity.mockReset();
});

it("uses req.user when present and does NOT verify a token", async () => {
  await ingestClientError(
    req({ message: "boom", idToken: "ignored" }, { uid: "u-mw", tenantId: "t-mw" }),
    mockRes(),
  );
  expect(verifyReportIdentity).not.toHaveBeenCalled();
  const [, ctx] = captureError.mock.calls[0];
  expect(ctx).toMatchObject({ uid: "u-mw", tenantId: "t-mw" });
});

it("falls back to verifying body.idToken when req.user is absent", async () => {
  verifyReportIdentity.mockResolvedValue({ uid: "u-tok", tenantId: "t-tok" });
  await ingestClientError(req({ message: "boom", idToken: "good" }), mockRes());
  expect(verifyReportIdentity).toHaveBeenCalledWith("good");
  const [, ctx] = captureError.mock.calls[0];
  expect(ctx).toMatchObject({ uid: "u-tok", tenantId: "t-tok" });
});

it("captures anonymously when token verification fails", async () => {
  verifyReportIdentity.mockResolvedValue(null);
  await ingestClientError(req({ message: "boom", idToken: "bad" }), mockRes());
  const [, ctx] = captureError.mock.calls[0];
  expect(ctx).toMatchObject({ uid: null, tenantId: null });
});

it("never passes idToken to captureError", async () => {
  verifyReportIdentity.mockResolvedValue({ uid: "u", tenantId: null });
  await ingestClientError(req({ message: "boom", idToken: "secret" }), mockRes());
  const [errArg, ctx] = captureError.mock.calls[0];
  expect(JSON.stringify({ errArg, ctx })).not.toContain("secret");
});

it("still 400s on missing message", async () => {
  const res = mockRes();
  await ingestClientError(req({ idToken: "x" }), res);
  expect(res._status).toBe(400);
  expect(captureError).not.toHaveBeenCalled();
});
