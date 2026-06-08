import {
  generateRecoveryToken,
  parseRecoveryToken,
} from "../mfa-recovery-token";

jest.mock("../logger", () => ({
  logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn() },
}));

describe("mfa-recovery-token", () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV, NODE_ENV: "test" };
    delete process.env.MFA_RECOVERY_TTL_SECONDS;
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it("generates a token that round-trips to the same uid with a random tokenId", () => {
    const token = generateRecoveryToken("user-123");
    const parsed = parseRecoveryToken(token);
    expect(parsed).not.toBeNull();
    expect(parsed!.uid).toBe("user-123");
    expect(typeof parsed!.tokenId).toBe("string");
    expect(parsed!.tokenId.length).toBeGreaterThan(0);
  });

  it("produces a unique tokenId on each generation", () => {
    const a = parseRecoveryToken(generateRecoveryToken("user-123"));
    const b = parseRecoveryToken(generateRecoveryToken("user-123"));
    expect(a!.tokenId).not.toBe(b!.tokenId);
  });

  it("returns null for an expired token", () => {
    process.env.MFA_RECOVERY_TTL_SECONDS = "1";
    const realNow = Date.now;
    const base = realNow();
    const token = generateRecoveryToken("user-123");
    // jump 2 seconds past TTL
    jest.spyOn(Date, "now").mockReturnValue(base + 2000);
    expect(parseRecoveryToken(token)).toBeNull();
    (Date.now as jest.Mock).mockRestore();
  });

  it("returns null when the signature is tampered with", () => {
    const token = generateRecoveryToken("user-123");
    const decoded = JSON.parse(Buffer.from(token, "base64url").toString());
    decoded.uid = "attacker-999";
    const tampered = Buffer.from(JSON.stringify(decoded)).toString("base64url");
    expect(parseRecoveryToken(tampered)).toBeNull();
  });

  it("returns null when the signature itself is replaced", () => {
    const token = generateRecoveryToken("user-123");
    const decoded = JSON.parse(Buffer.from(token, "base64url").toString());
    decoded.sig = "deadbeef";
    const tampered = Buffer.from(JSON.stringify(decoded)).toString("base64url");
    expect(parseRecoveryToken(tampered)).toBeNull();
  });

  it("returns null for a malformed token", () => {
    expect(parseRecoveryToken("not-a-valid-token")).toBeNull();
    expect(parseRecoveryToken("")).toBeNull();
  });

  it("returns null when uid is missing from the payload", () => {
    const token = generateRecoveryToken("user-123");
    const decoded = JSON.parse(Buffer.from(token, "base64url").toString());
    delete decoded.uid;
    const broken = Buffer.from(JSON.stringify(decoded)).toString("base64url");
    expect(parseRecoveryToken(broken)).toBeNull();
  });
});
