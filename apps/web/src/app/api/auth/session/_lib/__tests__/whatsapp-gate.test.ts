import { describe, it, expect } from "vitest";
import { decideWhatsappGate } from "../whatsapp-gate";

describe("decideWhatsappGate", () => {
  it("skips the gate for super admins (TOTP only)", () => {
    expect(
      decideWhatsappGate({
        isSuperAdmin: true,
        hasNativeSecondFactor: false,
        challenge: null,
      }),
    ).toBe("skip");
  });

  it("skips the gate when super admin even if a challenge would require it", () => {
    expect(
      decideWhatsappGate({
        isSuperAdmin: true,
        hasNativeSecondFactor: false,
        challenge: { mfaRequired: true },
      }),
    ).toBe("skip");
  });

  it("skips the gate when the token already has a native second factor (TOTP)", () => {
    expect(
      decideWhatsappGate({
        isSuperAdmin: false,
        hasNativeSecondFactor: true,
        challenge: null,
      }),
    ).toBe("skip");
  });

  it("requires the gate when the backend challenge says mfaRequired", () => {
    expect(
      decideWhatsappGate({
        isSuperAdmin: false,
        hasNativeSecondFactor: false,
        challenge: { mfaRequired: true },
      }),
    ).toBe("require");
  });

  it("proceeds when the backend challenge says mfaRequired is false", () => {
    expect(
      decideWhatsappGate({
        isSuperAdmin: false,
        hasNativeSecondFactor: false,
        challenge: { mfaRequired: false },
      }),
    ).toBe("proceed");
  });

  it("proceeds (fail-open) when the challenge is null after a non-fatal failure", () => {
    expect(
      decideWhatsappGate({
        isSuperAdmin: false,
        hasNativeSecondFactor: false,
        challenge: null,
      }),
    ).toBe("proceed");
  });

  it("proceeds when the challenge has no mfaRequired field", () => {
    expect(
      decideWhatsappGate({
        isSuperAdmin: false,
        hasNativeSecondFactor: false,
        challenge: {},
      }),
    ).toBe("proceed");
  });
});
