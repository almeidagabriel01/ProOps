/**
 * Unit tests for the super-admin allowlist + MFA invariants in
 * evaluateAuthContextInvariants (auth-context.ts). Pure-function coverage for
 * the Phase 2 hardening: allowlist demotion signalling and the MFA kill-switch.
 */

jest.mock("../../init", () => ({ auth: {}, db: {} }));

import { evaluateAuthContextInvariants } from "../auth-context";

const SUPERADMIN = {
  role: "SUPERADMIN",
  tenantId: "",
  uid: "admin-uid",
  email: "gestao@proops.com.br",
};

describe("evaluateAuthContextInvariants — super admin allowlist", () => {
  it("regular user is never a super admin and ignores allowlist/mfa flags", () => {
    const result = evaluateAuthContextInvariants({
      role: "MEMBER",
      tenantId: "tenant-1",
      uid: "u1",
      email: "member@acme.com",
      superAdminAllowlist: ["someone@else.com"],
      requireSuperAdminMfa: true,
    });

    expect(result.isSuperAdmin).toBe(false);
    expect(result.superAdminRoleClaimed).toBe(false);
    expect(result.superAdminAllowlisted).toBe(true);
    expect(result.mfaRequired).toBe(false);
  });

  it("super admin with NO allowlist configured stays allowlisted", () => {
    const result = evaluateAuthContextInvariants({
      ...SUPERADMIN,
      superAdminAllowlist: [],
    });

    expect(result.isSuperAdmin).toBe(true);
    expect(result.superAdminRoleClaimed).toBe(true);
    expect(result.superAdminAllowlisted).toBe(true);
  });

  it("super admin whose email is in the allowlist is allowlisted", () => {
    const result = evaluateAuthContextInvariants({
      ...SUPERADMIN,
      superAdminAllowlist: ["gestao@proops.com.br"],
    });

    expect(result.superAdminAllowlisted).toBe(true);
  });

  it("super admin whose uid is in the allowlist is allowlisted", () => {
    const result = evaluateAuthContextInvariants({
      ...SUPERADMIN,
      superAdminAllowlist: ["admin-uid"],
    });

    expect(result.superAdminAllowlisted).toBe(true);
  });

  it("super admin matches the allowlist email case-insensitively", () => {
    const result = evaluateAuthContextInvariants({
      ...SUPERADMIN,
      email: "Gestao@ProOps.com.BR",
      superAdminAllowlist: ["gestao@proops.com.br"],
    });

    expect(result.superAdminAllowlisted).toBe(true);
  });

  it("super admin NOT in a configured allowlist is flagged not-allowlisted", () => {
    const result = evaluateAuthContextInvariants({
      ...SUPERADMIN,
      superAdminAllowlist: ["other@proops.com.br"],
    });

    expect(result.superAdminRoleClaimed).toBe(true);
    expect(result.superAdminAllowlisted).toBe(false);
  });
});

describe("evaluateAuthContextInvariants — super admin MFA gate", () => {
  it("requires MFA when the kill-switch is on and no second factor present", () => {
    const result = evaluateAuthContextInvariants({
      ...SUPERADMIN,
      requireSuperAdminMfa: true,
      mfaVerified: false,
    });

    expect(result.mfaVerified).toBe(false);
    expect(result.mfaRequired).toBe(true);
  });

  it("does not require MFA when the second factor is present", () => {
    const result = evaluateAuthContextInvariants({
      ...SUPERADMIN,
      requireSuperAdminMfa: true,
      mfaVerified: true,
    });

    expect(result.mfaVerified).toBe(true);
    expect(result.mfaRequired).toBe(false);
  });

  it("does not require MFA when the kill-switch is off", () => {
    const result = evaluateAuthContextInvariants({
      ...SUPERADMIN,
      requireSuperAdminMfa: false,
      mfaVerified: false,
    });

    expect(result.mfaRequired).toBe(false);
  });

  it("does not flag MFA for a super admin that fails the allowlist first", () => {
    const result = evaluateAuthContextInvariants({
      ...SUPERADMIN,
      superAdminAllowlist: ["other@proops.com.br"],
      requireSuperAdminMfa: true,
      mfaVerified: false,
    });

    expect(result.superAdminAllowlisted).toBe(false);
    expect(result.mfaRequired).toBe(false);
  });
});
