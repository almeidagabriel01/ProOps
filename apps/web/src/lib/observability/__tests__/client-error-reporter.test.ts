/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { shouldReportConsoleArg, installClientErrorReporter } from "../client-error-reporter";

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
