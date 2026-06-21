// apps/web/src/lib/observability/__tests__/client-error-reporter.token.test.ts
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/firebase", () => ({ auth: {} }));
vi.mock("firebase/auth", () => ({ onIdTokenChanged: vi.fn(() => () => {}) }));

import { reportClientError } from "../client-error-reporter";
import { __setCachedIdTokenForTest } from "../identity-token-cache";

let postedBodies: string[] = [];

beforeEach(() => {
  vi.useFakeTimers();
  postedBodies = [];
  __setCachedIdTokenForTest(null);
  // Force the fetch path (no sendBeacon) so we can read the JSON body.
  vi.stubGlobal("navigator", {});
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init: { body?: string }) => {
      if (init?.body) postedBodies.push(init.body);
      return { ok: true } as Response;
    }),
  );
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  __setCachedIdTokenForTest(null);
});

// The reporter buffers and flushes after a 2s debounce; advance fake timers to flush.
function flushReports() {
  vi.advanceTimersByTime(2100);
}

describe("reporter token attachment", () => {
  it("includes idToken from the cache in the posted body", () => {
    __setCachedIdTokenForTest("tok-xyz");
    reportClientError(new Error("boom"), { route: "/products/new" });
    flushReports();
    expect(postedBodies.length).toBe(1);
    const body = JSON.parse(postedBodies[0]);
    expect(body.idToken).toBe("tok-xyz");
    expect(body.message).toBe("boom");
  });

  it("omits idToken when no user token is cached", () => {
    reportClientError(new Error("boom2"), { route: "/x" });
    flushReports();
    expect(postedBodies.length).toBe(1);
    const body = JSON.parse(postedBodies[0]);
    expect(body.idToken).toBeUndefined();
  });
});
