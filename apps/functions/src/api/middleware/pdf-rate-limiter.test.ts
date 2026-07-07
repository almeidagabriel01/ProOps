/**
 * Contract tests for the PDF rate limiter (5/min per uid or IP) after the
 * migration to the pluggable rate-limit store. The 429 response shape
 * (code PDF_RATE_LIMIT_EXCEEDED + Retry-After) is depended on by E2E tests
 * and the frontend error handler — it must not change.
 */

jest.mock("../../lib/security-observability", () => ({
  buildSecurityLogContext: jest.fn((_req, extra) => ({ requestId: "r1", ...extra })),
  incrementSecurityCounter: jest.fn(),
  logSecurityEvent: jest.fn(),
  writeSecurityAuditEvent: jest.fn(),
}));

import type { Request, Response, NextFunction } from "express";
import { pdfRateLimiter } from "./pdf-rate-limiter";

function makeReq(uid?: string, ip = "10.0.0.1"): Request {
  return {
    user: uid ? { uid } : undefined,
    path: "/v1/proposals/p1/pdf",
    headers: { "x-forwarded-for": ip },
    ip,
    socket: { remoteAddress: ip },
  } as unknown as Request;
}

function makeRes() {
  const state = {
    statusCode: null as number | null,
    jsonBody: undefined as unknown,
    headers: {} as Record<string, string>,
  };
  const res = {
    status: jest.fn((code: number) => { state.statusCode = code; return res; }),
    json: jest.fn((body: unknown) => { state.jsonBody = body; return res; }),
    setHeader: jest.fn((k: string, v: string) => { state.headers[k] = v; }),
    set: jest.fn((k: string, v: string) => { state.headers[k] = v; }),
  } as unknown as Response;
  return { res, state };
}

async function run(req: Request) {
  const { res, state } = makeRes();
  let nextCalled = false;
  const next: NextFunction = jest.fn(() => { nextCalled = true; }) as unknown as NextFunction;
  pdfRateLimiter(req, res, next);
  // limiter interno é async — dá um tick para resolver
  await new Promise((r) => setImmediate(r));
  return { nextCalled, state };
}

describe("pdfRateLimiter", () => {
  it("allows 5 requests per minute per uid and blocks the 6th with the legacy contract", async () => {
    const uid = `pdf-uid-${Date.now()}`;

    for (let i = 0; i < 5; i++) {
      const { nextCalled } = await run(makeReq(uid));
      expect(nextCalled).toBe(true);
    }

    const { nextCalled, state } = await run(makeReq(uid));
    expect(nextCalled).toBe(false);
    expect(state.statusCode).toBe(429);
    const body = state.jsonBody as Record<string, unknown>;
    expect(body.code).toBe("PDF_RATE_LIMIT_EXCEEDED");
    expect(typeof body.retryAfter).toBe("number");
    expect(Number(state.headers["Retry-After"])).toBeGreaterThanOrEqual(1);
  });

  it("keys anonymous requests by IP", async () => {
    const ipA = `10.1.1.${Math.floor(Math.random() * 250)}`;
    const ipB = `10.2.2.${Math.floor(Math.random() * 250)}`;

    for (let i = 0; i < 5; i++) {
      const { nextCalled } = await run(makeReq(undefined, ipA));
      expect(nextCalled).toBe(true);
    }
    const blocked = await run(makeReq(undefined, ipA));
    expect(blocked.nextCalled).toBe(false);

    // IP diferente não é afetado
    const other = await run(makeReq(undefined, ipB));
    expect(other.nextCalled).toBe(true);
  });
});
