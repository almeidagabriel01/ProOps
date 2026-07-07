/**
 * Unit tests for the reusable express rate limiter (extracted from api/index.ts).
 * Behavior contract: allow under limit, 429 + Retry-After over limit,
 * custom onLimit override, fail-open on store errors.
 */

const consumeMock = jest.fn();

jest.mock("./factory", () => ({
  createRateLimitStore: jest.fn(() => ({ kind: "memory", consume: consumeMock })),
}));

jest.mock("../security-observability", () => ({
  buildSecurityLogContext: jest.fn((_req, extra) => ({ requestId: "r1", ...extra })),
  incrementSecurityCounter: jest.fn(),
  logSecurityEvent: jest.fn(),
  writeSecurityAuditEvent: jest.fn(),
}));

import type { Request, Response } from "express";
import { createRateLimiter, buildRateLimitIdentity, getClientIp } from "./express-limiter";

function makeReq(overrides: Partial<Request> = {}): Request {
  return {
    path: "/v1/test",
    headers: {},
    ip: "1.2.3.4",
    user: undefined,
    ...overrides,
  } as unknown as Request;
}

function makeRes() {
  const headers: Record<string, string> = {};
  const res = {
    set: jest.fn((k: string, v: string) => {
      headers[k] = v;
    }),
    setHeader: jest.fn((k: string, v: string) => {
      headers[k] = v;
    }),
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response;
  return { res, headers };
}

function decision(allowed: boolean, retryAfterSeconds = 30) {
  return {
    allowed,
    limit: 2,
    remaining: allowed ? 1 : 0,
    current: allowed ? 1 : 3,
    retryAfterSeconds,
    windowMs: 60_000,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("createRateLimiter", () => {
  it("calls next() when under the limit", async () => {
    consumeMock.mockResolvedValue(decision(true));
    const limiter = createRateLimiter({ maxRequests: 2, keyPrefix: "t" });
    const next = jest.fn();
    const { res } = makeRes();

    await limiter(makeReq(), res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("responds 429 with Retry-After when over the limit (default onLimit)", async () => {
    consumeMock.mockResolvedValue(decision(false, 42));
    const limiter = createRateLimiter({ maxRequests: 2, keyPrefix: "t" });
    const next = jest.fn();
    const { res, headers } = makeRes();

    await limiter(makeReq(), res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(429);
    expect(headers["Retry-After"]).toBe("42");
  });

  it("uses the custom onLimit response when provided", async () => {
    consumeMock.mockResolvedValue(decision(false, 10));
    const onLimit = jest.fn();
    const limiter = createRateLimiter({ maxRequests: 2, keyPrefix: "t", onLimit });
    const next = jest.fn();
    const { res } = makeRes();
    const req = makeReq();

    await limiter(req, res, next);

    expect(onLimit).toHaveBeenCalledWith(
      req,
      res,
      expect.objectContaining({ retryAfterSeconds: 10 }),
    );
    expect(res.status).not.toHaveBeenCalled();
  });

  it("fails open when the store throws", async () => {
    consumeMock.mockRejectedValue(new Error("redis down"));
    const limiter = createRateLimiter({ maxRequests: 2, keyPrefix: "t" });
    const next = jest.fn();
    const { res } = makeRes();

    await limiter(makeReq(), res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("keys by ip:uid:tenant by default", async () => {
    consumeMock.mockResolvedValue(decision(true));
    const limiter = createRateLimiter({ maxRequests: 2, keyPrefix: "px" });
    const req = makeReq({
      user: { uid: "u1", tenantId: "t1" },
    } as unknown as Partial<Request>);

    await limiter(req, makeRes().res, jest.fn());

    expect(consumeMock).toHaveBeenCalledWith("px:1.2.3.4:u1:t1", 2, 60_000);
  });
});

describe("helpers", () => {
  it("getClientIp prefers first x-forwarded-for entry", () => {
    const req = makeReq({
      headers: { "x-forwarded-for": "9.9.9.9, 8.8.8.8" },
    } as unknown as Partial<Request>);
    expect(getClientIp(req)).toBe("9.9.9.9");
  });

  it("buildRateLimitIdentity handles anonymous requests", () => {
    expect(buildRateLimitIdentity(makeReq())).toBe("1.2.3.4:anonymous:no-tenant");
  });
});
