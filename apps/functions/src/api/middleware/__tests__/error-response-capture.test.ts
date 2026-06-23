process.env.NODE_ENV = "test";

const captureError = jest.fn();
jest.mock("../../../lib/observability/error-logger", () => ({ captureError: (...a: unknown[]) => captureError(...a) }));

import { EventEmitter } from "events";
import { Request, Response } from "express";
import { captureResponseErrors, shouldCaptureResponseStatus } from "../error-response-capture";

function run(path: string, method: string, statusCode: number, locals: Record<string, unknown> = {}) {
  const res = new EventEmitter() as unknown as Response & { statusCode: number; locals: Record<string, unknown> };
  res.statusCode = statusCode;
  res.locals = locals as never;
  const req = { path, method, user: { uid: "u1", tenantId: "t1" } } as unknown as Request;
  const next = jest.fn();
  captureResponseErrors(req, res, next);
  expect(next).toHaveBeenCalled();
  (res as unknown as EventEmitter).emit("finish");
}

beforeEach(() => captureError.mockReset());

it("does NOT capture a 404 non-throw response (4xx is expected client noise)", () => {
  run("/v1/proposals/x", "GET", 404);
  expect(captureError).not.toHaveBeenCalled();
});

it.each([400, 401, 403, 404, 429, 499])("does NOT capture %s (4xx client error)", (status) => {
  run("/v1/x", "GET", status);
  expect(captureError).not.toHaveBeenCalled();
});

it("captures a 500 non-throw response", () => {
  run("/v1/x", "POST", 500);
  expect(captureError).toHaveBeenCalledTimes(1);
  const [, ctx] = captureError.mock.calls[0];
  expect(ctx).toMatchObject({ source: "functions", status: 500, method: "POST", route: "/v1/x", handled: true });
});

it.each([500, 502, 503])("captures %s server errors once", (status) => {
  run("/v1/x", "POST", status);
  expect(captureError).toHaveBeenCalledTimes(1);
});

it("shouldCaptureResponseStatus: only 5xx", () => {
  for (const s of [200, 301, 399, 400, 404, 429, 499]) expect(shouldCaptureResponseStatus(s)).toBe(false);
  for (const s of [500, 502, 503, 599]) expect(shouldCaptureResponseStatus(s)).toBe(true);
});

it("skips when already captured by the global error handler", () => {
  run("/v1/x", "POST", 500, { __obsCaptured: true });
  expect(captureError).not.toHaveBeenCalled();
});

it("skips success responses", () => {
  run("/v1/x", "GET", 200);
  expect(captureError).not.toHaveBeenCalled();
});

it("skips excluded prefixes", () => {
  run("/v1/observability/issues", "GET", 500);
  run("/internal/cron/x", "POST", 500);
  run("/health", "GET", 503);
  expect(captureError).not.toHaveBeenCalled();
});
