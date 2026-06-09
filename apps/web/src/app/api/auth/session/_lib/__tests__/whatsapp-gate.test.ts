import { describe, it, expect } from "vitest";
import { decideWhatsappGate } from "../whatsapp-gate";

describe("decideWhatsappGate", () => {
  it("skips the gate for super admins (TOTP only)", () => {
    expect(
      decideWhatsappGate({
        isSuperAdmin: true,
        hasNativeSecondFactor: false,
        recoveryLogin: false,
        alreadyAuthenticated: false,
        challenge: null,
      }),
    ).toBe("skip");
  });

  it("skips the gate when super admin even if a challenge would require it", () => {
    expect(
      decideWhatsappGate({
        isSuperAdmin: true,
        hasNativeSecondFactor: false,
        recoveryLogin: false,
        alreadyAuthenticated: false,
        challenge: { mfaRequired: true },
      }),
    ).toBe("skip");
  });

  it("skips the gate when the token already has a native second factor (TOTP)", () => {
    expect(
      decideWhatsappGate({
        isSuperAdmin: false,
        hasNativeSecondFactor: true,
        recoveryLogin: false,
        alreadyAuthenticated: false,
        challenge: null,
      }),
    ).toBe("skip");
  });

  it("skips the gate when the login was completed via a recovery code", () => {
    // A one-time recovery code is a full 2FA bypass — it must not trigger a
    // second WhatsApp challenge, even when a challenge would otherwise require it.
    expect(
      decideWhatsappGate({
        isSuperAdmin: false,
        hasNativeSecondFactor: false,
        recoveryLogin: true,
        alreadyAuthenticated: false,
        challenge: { mfaRequired: true },
      }),
    ).toBe("skip");
  });

  it("skips the gate on a background re-sync of an already authenticated session", () => {
    expect(
      decideWhatsappGate({
        isSuperAdmin: false,
        hasNativeSecondFactor: false,
        recoveryLogin: false,
        alreadyAuthenticated: true,
        challenge: null,
      }),
    ).toBe("skip");
  });

  it("skips the gate when already authenticated even if a challenge would require it", () => {
    expect(
      decideWhatsappGate({
        isSuperAdmin: false,
        hasNativeSecondFactor: false,
        recoveryLogin: false,
        alreadyAuthenticated: true,
        challenge: { mfaRequired: true },
      }),
    ).toBe("skip");
  });

  it("requires the gate when the backend challenge says mfaRequired", () => {
    expect(
      decideWhatsappGate({
        isSuperAdmin: false,
        hasNativeSecondFactor: false,
        recoveryLogin: false,
        alreadyAuthenticated: false,
        challenge: { mfaRequired: true },
      }),
    ).toBe("require");
  });

  it("proceeds when the backend challenge says mfaRequired is false", () => {
    expect(
      decideWhatsappGate({
        isSuperAdmin: false,
        hasNativeSecondFactor: false,
        recoveryLogin: false,
        alreadyAuthenticated: false,
        challenge: { mfaRequired: false },
      }),
    ).toBe("proceed");
  });

  it("proceeds (fail-open) when the challenge is null after a non-fatal failure", () => {
    expect(
      decideWhatsappGate({
        isSuperAdmin: false,
        hasNativeSecondFactor: false,
        recoveryLogin: false,
        alreadyAuthenticated: false,
        challenge: null,
      }),
    ).toBe("proceed");
  });

  it("proceeds when the challenge has no mfaRequired field", () => {
    expect(
      decideWhatsappGate({
        isSuperAdmin: false,
        hasNativeSecondFactor: false,
        recoveryLogin: false,
        alreadyAuthenticated: false,
        challenge: {},
      }),
    ).toBe("proceed");
  });
});
