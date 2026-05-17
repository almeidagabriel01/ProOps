import { evaluateTenantFix } from "./fix-mp-environment-mismatch";

describe("evaluateTenantFix", () => {
  it("fixes tenant with @testuser.com email and environment=production", () => {
    const result = evaluateTenantFix({
      email: "test_user_12345@testuser.com",
      environment: "production",
      liveMode: true,
    });
    expect(result.shouldFix).toBe(true);
  });

  it("fixes tenant with @testuser.com email and liveMode=true but environment=undefined", () => {
    const result = evaluateTenantFix({
      email: "test_user_99999@testuser.com",
      environment: undefined,
      liveMode: true,
    });
    expect(result.shouldFix).toBe(true);
  });

  it("is a no-op when tenant is already correctly set to sandbox", () => {
    const result = evaluateTenantFix({
      email: "test_user_12345@testuser.com",
      environment: "sandbox",
      liveMode: false,
    });
    expect(result.shouldFix).toBe(false);
    expect(result.reason).toMatch(/already correctly set/);
  });

  it("is a no-op for a real production seller (non-testuser email)", () => {
    const result = evaluateTenantFix({
      email: "real-seller@empresa.com.br",
      environment: "production",
      liveMode: true,
    });
    expect(result.shouldFix).toBe(false);
    expect(result.reason).toMatch(/not a test seller/);
  });

  it("is a no-op for a real seller with production environment regardless of liveMode", () => {
    const result = evaluateTenantFix({
      email: "seller@company.com",
      environment: "production",
      liveMode: false,
    });
    expect(result.shouldFix).toBe(false);
  });

  it("fixes tenant with @testuser.com email even when liveMode is undefined", () => {
    const result = evaluateTenantFix({
      email: "test_user_42@testuser.com",
      environment: "production",
      liveMode: undefined,
    });
    expect(result.shouldFix).toBe(true);
  });
});
