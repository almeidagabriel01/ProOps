/**
 * Unit tests for aiRateLimiter middleware.
 *
 * The rate limiter uses module-level Maps. Each test uses unique uid/tenantId
 * suffixes so state doesn't bleed between tests.
 */

jest.mock("../lib/logger", () => ({
  logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import type { Request, Response, NextFunction } from "express";
import { aiRateLimiter } from "./rate-limiter";
import type { AuthContext } from "../lib/auth-context";

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeReq(uid: string, tenantId: string): Request {
  return { user: { uid, tenantId, role: "admin" } as AuthContext } as unknown as Request;
}

function makeRes() {
  const state = { statusCode: null as number | null, jsonBody: undefined as unknown, onClose: () => {} };
  const res = {
    status: jest.fn((code: number) => { state.statusCode = code; return res; }),
    json: jest.fn((body: unknown) => { state.jsonBody = body; return res; }),
    on: jest.fn((event: string, cb: () => void) => {
      if (event === "close") state.onClose = cb;
    }),
  } as unknown as Response;
  return { res, state };
}

function makeNext() {
  const state = { called: false };
  const next: NextFunction = jest.fn(() => { state.called = true; }) as unknown as NextFunction;
  return { next, state };
}

// ── RPM cap ────────────────────────────────────────────────────────────────────

describe("aiRateLimiter — RPM cap (20 req/min per user)", () => {
  test("allows up to 20 requests then blocks the 21st with 429", () => {
    const uid = `rpm-uid-${Date.now()}`;
    const tenantId = `rpm-tenant-${Date.now()}`;

    for (let i = 0; i < 20; i++) {
      const req = makeReq(uid, tenantId);
      const { res, state: rs } = makeRes();
      const { next, state: ns } = makeNext();
      aiRateLimiter(req, res, next);
      expect(ns.called).toBe(true);
      rs.onClose(); // decrement SSE count
    }

    // 21st should be rate-limited
    const req21 = makeReq(uid, tenantId);
    const { res: res21, state: rs21 } = makeRes();
    const { next: next21, state: ns21 } = makeNext();
    aiRateLimiter(req21, res21, next21);

    expect(ns21.called).toBe(false);
    expect(rs21.statusCode).toBe(429);
    expect((rs21.jsonBody as Record<string, string>)?.code).toBe("AI_RATE_LIMIT_EXCEEDED");
  });

  test("different users are rate-limited independently", () => {
    const tenantId = `shared-tenant-${Date.now()}`;
    const uid1 = `user-a-${Date.now()}`;
    const uid2 = `user-b-${Date.now()}`;

    for (let i = 0; i < 20; i++) {
      const req = makeReq(uid1, tenantId);
      const { res, state: rs } = makeRes();
      const { next } = makeNext();
      aiRateLimiter(req, res, next);
      rs.onClose();
    }

    // uid2 is untouched — should pass
    const { res: res2, state: rs2 } = makeRes();
    const { next: next2, state: ns2 } = makeNext();
    aiRateLimiter(makeReq(uid2, tenantId), res2, next2);
    expect(ns2.called).toBe(true);
    rs2.onClose();
  });
});

// ── SSE concurrency cap ────────────────────────────────────────────────────────

describe("aiRateLimiter — SSE concurrency cap (5 per tenant)", () => {
  test("allows 5 concurrent SSE connections and blocks the 6th", () => {
    const tenantId = `sse-tenant-${Date.now()}`;
    const closeFns: Array<() => void> = [];

    for (let i = 0; i < 5; i++) {
      const uid = `sse-uid-${i}-${Date.now()}`;
      const { res, state: rs } = makeRes();
      const { next, state: ns } = makeNext();
      aiRateLimiter(makeReq(uid, tenantId), res, next);
      expect(ns.called).toBe(true);
      closeFns.push(() => rs.onClose());
    }

    const uid6 = `sse-uid-6-${Date.now()}`;
    const { res: res6, state: rs6 } = makeRes();
    const { next: next6, state: ns6 } = makeNext();
    aiRateLimiter(makeReq(uid6, tenantId), res6, next6);

    expect(ns6.called).toBe(false);
    expect(rs6.statusCode).toBe(429);
    expect((rs6.jsonBody as Record<string, string>)?.code).toBe("AI_SSE_LIMIT_EXCEEDED");

    closeFns.forEach((fn) => fn());
  });

  test("after a connection closes, a new one is accepted", () => {
    const tenantId = `sse-close-${Date.now()}`;
    const closeFns: Array<() => void> = [];

    for (let i = 0; i < 5; i++) {
      const uid = `sc-uid-${i}-${Date.now()}`;
      const { res, state: rs } = makeRes();
      const { next } = makeNext();
      aiRateLimiter(makeReq(uid, tenantId), res, next);
      closeFns.push(() => rs.onClose());
    }

    closeFns[0](); // close first connection

    const uid6 = `sc-uid-6-${Date.now()}`;
    const { res: res6 } = makeRes();
    const { next: next6, state: ns6 } = makeNext();
    aiRateLimiter(makeReq(uid6, tenantId), res6, next6);
    expect(ns6.called).toBe(true);

    closeFns.slice(1).forEach((fn) => fn());
  });
});

// ── Unauthenticated ────────────────────────────────────────────────────────────

describe("aiRateLimiter — unauthenticated request", () => {
  test("passes through when req.user is missing (route handler returns 401)", () => {
    const req = { user: undefined } as unknown as Request;
    const { res } = makeRes();
    const { next, state: ns } = makeNext();
    aiRateLimiter(req, res, next);
    expect(ns.called).toBe(true);
  });
});
