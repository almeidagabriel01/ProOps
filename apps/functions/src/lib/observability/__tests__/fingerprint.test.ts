import {
  normalizeErrorMessage,
  firstStackFrame,
  computeFingerprint,
} from "../fingerprint";

describe("normalizeErrorMessage", () => {
  it("strips UUIDs, long numbers, emails and hex ids so similar errors collapse", () => {
    const a = normalizeErrorMessage("user 9f1c2e7a-1b2c-4d5e-8f90-abcdef012345 not found");
    const b = normalizeErrorMessage("user 0a2b3c4d-5e6f-7081-9abc-def012345678 not found");
    expect(a).toBe(b);
    expect(a).toBe("user <id> not found");
  });

  it("replaces standalone numbers and emails", () => {
    expect(normalizeErrorMessage("retry 4123 for a@b.com")).toBe("retry <n> for <email>");
  });

  it("collapses whitespace and trims", () => {
    expect(normalizeErrorMessage("  too   many \n requests ")).toBe("too many requests");
  });
});

describe("firstStackFrame", () => {
  it("returns the first 'at ...' frame", () => {
    const stack = "Error: boom\n    at foo (/srv/a.js:10:5)\n    at bar (/srv/b.js:2:1)";
    expect(firstStackFrame(stack)).toBe("at foo (/srv/a.js:10:5)");
  });

  it("returns empty string for null stack", () => {
    expect(firstStackFrame(null)).toBe("");
  });
});

describe("computeFingerprint", () => {
  it("is deterministic and stable for the same inputs", () => {
    const fp1 = computeFingerprint({
      errorType: "TypeError",
      normalizedMessage: "user <id> not found",
      route: "/v1/proposals",
      stackTopFrame: "at foo (/srv/a.js:10:5)",
    });
    const fp2 = computeFingerprint({
      errorType: "TypeError",
      normalizedMessage: "user <id> not found",
      route: "/v1/proposals",
      stackTopFrame: "at foo (/srv/a.js:10:5)",
    });
    expect(fp1).toBe(fp2);
    expect(fp1).toMatch(/^[a-f0-9]{40}$/);
  });

  it("differs when route differs", () => {
    const base = { errorType: "TypeError", normalizedMessage: "x", stackTopFrame: "at a" };
    expect(computeFingerprint({ ...base, route: "/a" })).not.toBe(
      computeFingerprint({ ...base, route: "/b" }),
    );
  });
});
