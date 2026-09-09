/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("@/lib/firebase", () => ({ auth: {} }));
vi.mock("firebase/auth", () => ({ onIdTokenChanged: vi.fn(() => () => {}) }));

import {
  shouldReportConsoleArg,
  installClientErrorReporter,
  isThirdPartyError,
} from "../client-error-reporter";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("shouldReportConsoleArg", () => {
  it("true for Error", () => {
    expect(shouldReportConsoleArg(new Error("x"))).toBe(true);
  });
  it("true for object with string stack", () => {
    expect(shouldReportConsoleArg({ stack: "at foo" })).toBe(true);
  });
  it("false for plain string", () => {
    expect(shouldReportConsoleArg("Warning: each child needs a key")).toBe(false);
  });
  it("false for plain object", () => {
    expect(shouldReportConsoleArg({ a: 1 })).toBe(false);
  });
});

describe("console.error patch", () => {
  it("patches console.error on install and restores on uninstall", () => {
    const original = console.error;
    const uninstall = installClientErrorReporter();
    expect(console.error).not.toBe(original);
    // calling it with a string must still reach the original
    const spy = vi.spyOn({ original }, "original");
    console.error("hello"); // should not throw / loop
    uninstall();
    expect(console.error).toBe(original);
    spy.mockRestore();
  });

  it("calling patched console.error with an Error does not recurse or throw", () => {
    const uninstall = installClientErrorReporter();
    expect(() => console.error(new Error("loop?"))).not.toThrow();
    uninstall();
  });
});

describe("isThirdPartyError", () => {
  function errorWithStack(message: string, frames: string[]): Error {
    const err = new Error(message);
    err.stack = [`${err.name}: ${message}`, ...frames.map((f) => `    ${f}`)].join("\n");
    return err;
  }

  it("discards the web-vitals collector error whose stack has no file at all", () => {
    const err = errorWithStack("Cannot read properties of undefined (reading 'startTime')", [
      "at et.reportAllChanges (<anonymous>:2:19429)",
      "at <anonymous>:2:13070",
      "at <anonymous>:2:331",
      "at d (<anonymous>:2:6141)",
      "at <anonymous>:2:6326",
      "at <anonymous>:2:2895",
      "at n.timeout (<anonymous>:2:5652)",
    ]);
    expect(isThirdPartyError(err)).toBe(true);
  });

  it("discards a browser extension stack", () => {
    const err = errorWithStack("boom", [
      "at inject (chrome-extension://abcdefghijklmnop/content.js:1:120)",
      "at <anonymous>:1:1",
    ]);
    expect(isThirdPartyError(err)).toBe(true);
  });

  it("discards the cross-origin 'Script error.' message", () => {
    expect(isThirdPartyError("Script error.")).toBe(true);
    expect(isThirdPartyError("Script error")).toBe(true);
  });

  it("reports an application error from a production bundle", () => {
    const err = errorWithStack("tenantId ausente", [
      "at useTenant (https://proops.com.br/_next/static/chunks/main-abc123.js:5:4210)",
      "at <anonymous>:2:331",
    ]);
    expect(isThirdPartyError(err)).toBe(false);
  });

  it("reports an application error from the dev server", () => {
    const err = errorWithStack("tenantId ausente", [
      "at useTenant (webpack-internal:///(app-pages-browser)/./src/providers/tenant.tsx:42:9)",
    ]);
    expect(isThirdPartyError(err)).toBe(false);
  });

  it("reports an error carrying no stack", () => {
    const err = new Error("sem stack");
    err.stack = undefined;
    expect(isThirdPartyError(err)).toBe(false);
  });

  it("reports a non-Error value", () => {
    expect(isThirdPartyError({ code: 403 })).toBe(false);
    expect(isThirdPartyError("Falha ao carregar a proposta")).toBe(false);
  });
});

describe("window error listener", () => {
  it("does not beacon a third-party error but does beacon an application error", () => {
    vi.useFakeTimers();
    const fetchSpy = vi.fn<typeof fetch>(() => Promise.resolve({ ok: true } as Response));
    vi.stubGlobal("fetch", fetchSpy);
    const sentBodies = () =>
      fetchSpy.mock.calls.map((call) => String(call[1]?.body ?? ""));

    const uninstall = installClientErrorReporter();

    const thirdParty = new Error("Cannot read properties of undefined (reading 'startTime')");
    thirdParty.stack =
      "TypeError: Cannot read properties of undefined (reading 'startTime')\n" +
      "    at et.reportAllChanges (<anonymous>:2:19429)";
    window.dispatchEvent(new ErrorEvent("error", { error: thirdParty }));
    vi.advanceTimersByTime(3000);
    expect(sentBodies().some((body) => body.includes("startTime"))).toBe(false);

    const ours = new Error("tenantId ausente");
    ours.stack =
      "Error: tenantId ausente\n" +
      "    at useTenant (https://proops.com.br/_next/static/chunks/main-abc123.js:5:4210)";
    window.dispatchEvent(new ErrorEvent("error", { error: ours }));
    vi.advanceTimersByTime(3000);
    expect(sentBodies().some((body) => body.includes("tenantId ausente"))).toBe(true);
    expect(sentBodies().some((body) => body.includes("startTime"))).toBe(false);

    uninstall();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });
});
