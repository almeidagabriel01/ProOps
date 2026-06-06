/**
 * Unit tests for the security-audit retention window clamping (point 4).
 */

jest.mock("../../init", () => ({ db: {} }));

import { getSecurityAuditRetentionDays } from "../security-observability";

const ORIGINAL = process.env.SECURITY_AUDIT_RETENTION_DAYS;

afterEach(() => {
  if (ORIGINAL === undefined) {
    delete process.env.SECURITY_AUDIT_RETENTION_DAYS;
  } else {
    process.env.SECURITY_AUDIT_RETENTION_DAYS = ORIGINAL;
  }
});

describe("getSecurityAuditRetentionDays", () => {
  it("defaults to 365 days when unset", () => {
    delete process.env.SECURITY_AUDIT_RETENTION_DAYS;
    expect(getSecurityAuditRetentionDays()).toBe(365);
  });

  it("honours a configured value within bounds", () => {
    process.env.SECURITY_AUDIT_RETENTION_DAYS = "120";
    expect(getSecurityAuditRetentionDays()).toBe(120);
  });

  it("clamps below the minimum (90 days)", () => {
    process.env.SECURITY_AUDIT_RETENTION_DAYS = "10";
    expect(getSecurityAuditRetentionDays()).toBe(90);
  });

  it("clamps above the maximum (730 days)", () => {
    process.env.SECURITY_AUDIT_RETENTION_DAYS = "5000";
    expect(getSecurityAuditRetentionDays()).toBe(730);
  });
});
