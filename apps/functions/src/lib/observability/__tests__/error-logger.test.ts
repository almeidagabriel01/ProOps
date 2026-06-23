import { toIngestInput } from "../error-logger";

describe("toIngestInput", () => {
  it("extracts type, message and stack from a native Error", () => {
    const err = new TypeError("boom 123");
    const input = toIngestInput(err, {
      source: "functions",
      route: "/v1/x",
      method: "GET",
      status: 500,
      uid: "u",
      tenantId: "t",
      handled: false,
    });
    expect(input.errorType).toBe("TypeError");
    expect(input.message).toBe("boom 123");
    expect(input.stack).toContain("boom 123");
    expect(input.route).toBe("/v1/x");
    expect(input.source).toBe("functions");
  });

  it("captures evlog why/fix/link when present", () => {
    const err = Object.assign(new Error("Payment failed"), {
      why: "Card declined",
      fix: "Try another card",
      link: "https://docs/x",
    });
    const input = toIngestInput(err, { source: "functions", handled: true, status: 402 });
    expect(input.why).toBe("Card declined");
    expect(input.fix).toBe("Try another card");
    expect(input.link).toBe("https://docs/x");
  });

  it("handles non-Error throwables", () => {
    const input = toIngestInput("string failure", { source: "functions", handled: true, status: null });
    expect(input.errorType).toBe("Error");
    expect(input.message).toBe("string failure");
    expect(input.stack).toBeNull();
  });

  it("extracts name/message/stack from a plain object (synthetic HttpError)", () => {
    const synthetic = { name: "HttpError", message: "HTTP 500 POST /v1/x" };
    const input = toIngestInput(synthetic, { source: "functions", handled: true, status: 500 });
    expect(input.errorType).toBe("HttpError");
    expect(input.message).toBe("HTTP 500 POST /v1/x");
    expect(input.stack).toBeNull();
  });

  it("never produces '[object Object]' for an object without name/message", () => {
    const input = toIngestInput({ code: 7 }, { source: "functions", handled: false, status: null });
    expect(input.errorType).toBe("Error");
    expect(input.message).not.toBe("[object Object]");
    expect(input.message).toBe('{"code":7}');
  });

  it("populates stack when a plain object carries a stack string", () => {
    const input = toIngestInput(
      { name: "X", message: "m", stack: "X: m\n    at f (a.js:1:1)" },
      { source: "functions", handled: false, status: null },
    );
    expect(input.stack).toContain("at f (a.js:1:1)");
  });

  it("does not throw on a circular object and yields a string message", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    let input!: ReturnType<typeof toIngestInput>;
    expect(() => {
      input = toIngestInput(circular, { source: "functions", handled: false, status: null });
    }).not.toThrow();
    expect(typeof input.message).toBe("string");
  });
});
