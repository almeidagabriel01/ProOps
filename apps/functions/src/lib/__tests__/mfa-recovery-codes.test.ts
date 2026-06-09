import {
  generateRecoveryCodes,
  hashRecoveryCode,
  normalizeRecoveryCode,
  verifyRecoveryCode,
} from "../mfa-recovery-codes";

describe("generateRecoveryCodes", () => {
  it("generates the requested number of codes in the xxxx-xxxx format", () => {
    const codes = generateRecoveryCodes(10);
    expect(codes).toHaveLength(10);
    for (const code of codes) {
      expect(code).toMatch(/^[abcdefghjkmnpqrstuvwxyz23456789]{4}-[abcdefghjkmnpqrstuvwxyz23456789]{4}$/);
    }
  });

  it("never includes visually ambiguous characters (0,1,l,o,i)", () => {
    const codes = generateRecoveryCodes(50).join("");
    expect(codes).not.toMatch(/[01loi]/);
  });

  it("returns unique codes", () => {
    const codes = generateRecoveryCodes(20);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("defaults to 10 codes", () => {
    expect(generateRecoveryCodes()).toHaveLength(10);
  });
});

describe("normalizeRecoveryCode", () => {
  it("lowercases and strips hyphens and spaces", () => {
    expect(normalizeRecoveryCode("AB2C-DE3F")).toBe("ab2cde3f");
    expect(normalizeRecoveryCode("  ab2c de3f ")).toBe("ab2cde3f");
    expect(normalizeRecoveryCode("Ab2c-De3f")).toBe("ab2cde3f");
  });
});

describe("hashRecoveryCode", () => {
  it("is deterministic for the same normalized code", () => {
    expect(hashRecoveryCode("ab2c-de3f")).toBe(hashRecoveryCode("ab2c-de3f"));
  });

  it("is tolerant of formatting (hyphen, spaces, case)", () => {
    const base = hashRecoveryCode("ab2c-de3f");
    expect(hashRecoveryCode("ab2cde3f")).toBe(base);
    expect(hashRecoveryCode("AB2C-DE3F")).toBe(base);
    expect(hashRecoveryCode(" ab2c de3f ")).toBe(base);
  });

  it("produces different hashes for different codes", () => {
    expect(hashRecoveryCode("ab2c-de3f")).not.toBe(hashRecoveryCode("ab2c-de3g"));
  });
});

describe("verifyRecoveryCode", () => {
  it("finds a valid, unused code and returns its index", () => {
    const hashed = [
      { hash: hashRecoveryCode("aaaa-bbbb"), usedAt: null },
      { hash: hashRecoveryCode("cccc-dddd"), usedAt: null },
    ];
    expect(verifyRecoveryCode("cccc-dddd", hashed)).toEqual({ index: 1 });
  });

  it("is tolerant of input formatting", () => {
    const hashed = [{ hash: hashRecoveryCode("aaaa-bbbb"), usedAt: null }];
    expect(verifyRecoveryCode("AAAABBBB", hashed)).toEqual({ index: 0 });
  });

  it("ignores codes that have already been used", () => {
    const hashed = [
      { hash: hashRecoveryCode("aaaa-bbbb"), usedAt: "2026-01-01T00:00:00Z" },
    ];
    expect(verifyRecoveryCode("aaaa-bbbb", hashed)).toBeNull();
  });

  it("treats undefined usedAt as unused", () => {
    const hashed = [{ hash: hashRecoveryCode("aaaa-bbbb"), usedAt: undefined }];
    expect(verifyRecoveryCode("aaaa-bbbb", hashed)).toEqual({ index: 0 });
  });

  it("returns null for an invalid code", () => {
    const hashed = [{ hash: hashRecoveryCode("aaaa-bbbb"), usedAt: null }];
    expect(verifyRecoveryCode("zzzz-zzzz", hashed)).toBeNull();
  });
});
