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
});
