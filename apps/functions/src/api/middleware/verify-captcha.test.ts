/**
 * Unit tests for verifyTurnstileToken middleware.
 * Focus: skip-without-secret, missing-token rejection, verify success/failure,
 * and fail-open on verification-service errors.
 */

process.env.NODE_ENV = "test";

jest.mock("../../lib/logger", () => ({
  logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import type { Request, Response, NextFunction } from "express";
import { verifyTurnstileToken } from "./verify-captcha";

type MockResponse = Response & {
  status: jest.Mock;
  json: jest.Mock;
};

function buildReq(overrides: Partial<Request> = {}): Request {
  const headers: Record<string, string> = {};
  return {
    body: {},
    headers: {},
    ip: "203.0.113.10",
    path: "/contact",
    header: (name: string) => headers[name.toLowerCase()],
    ...overrides,
  } as unknown as Request;
}

function buildRes(): MockResponse {
  const res = {} as MockResponse;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  jest.restoreAllMocks();
});

describe("verifyTurnstileToken", () => {
  it("skips verification when TURNSTILE_SECRET_KEY is unset", async () => {
    delete process.env.TURNSTILE_SECRET_KEY;
    delete process.env.FIRESTORE_EMULATOR_HOST;
    const next = jest.fn() as NextFunction;
    const res = buildRes();

    await verifyTurnstileToken(buildReq(), res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it("skips verification under the Firestore emulator even if a secret is set", async () => {
    process.env.TURNSTILE_SECRET_KEY = "secret";
    process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
    const next = jest.fn() as NextFunction;
    const res = buildRes();

    await verifyTurnstileToken(buildReq(), res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it("rejects with 403 when the token is missing", async () => {
    process.env.TURNSTILE_SECRET_KEY = "secret";
    delete process.env.FIRESTORE_EMULATOR_HOST;
    const next = jest.fn() as NextFunction;
    const res = buildRes();

    await verifyTurnstileToken(buildReq({ body: {} }), res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("calls next() when Cloudflare verifies the token", async () => {
    process.env.TURNSTILE_SECRET_KEY = "secret";
    delete process.env.FIRESTORE_EMULATOR_HOST;
    const fetchMock = jest
      .fn()
      .mockResolvedValue({ json: async () => ({ success: true }) });
    (global as unknown as { fetch: jest.Mock }).fetch = fetchMock;

    const next = jest.fn() as NextFunction;
    const res = buildRes();

    await verifyTurnstileToken(
      buildReq({ body: { captchaToken: "tok" } }),
      res,
      next,
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it("rejects with 403 when Cloudflare reports failure", async () => {
    process.env.TURNSTILE_SECRET_KEY = "secret";
    delete process.env.FIRESTORE_EMULATOR_HOST;
    const fetchMock = jest.fn().mockResolvedValue({
      json: async () => ({ success: false, "error-codes": ["invalid-input-response"] }),
    });
    (global as unknown as { fetch: jest.Mock }).fetch = fetchMock;

    const next = jest.fn() as NextFunction;
    const res = buildRes();

    await verifyTurnstileToken(
      buildReq({ body: { captchaToken: "bad" } }),
      res,
      next,
    );

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("fails open (calls next) when the verification request throws", async () => {
    process.env.TURNSTILE_SECRET_KEY = "secret";
    delete process.env.FIRESTORE_EMULATOR_HOST;
    const fetchMock = jest.fn().mockRejectedValue(new Error("network down"));
    (global as unknown as { fetch: jest.Mock }).fetch = fetchMock;

    const next = jest.fn() as NextFunction;
    const res = buildRes();

    await verifyTurnstileToken(
      buildReq({ body: { captchaToken: "tok" } }),
      res,
      next,
    );

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });
});
