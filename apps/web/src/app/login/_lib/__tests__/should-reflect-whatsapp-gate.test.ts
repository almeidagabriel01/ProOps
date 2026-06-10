import { describe, expect, it } from "vitest";
import { shouldReflectWhatsappGate } from "../should-reflect-whatsapp-gate";

describe("shouldReflectWhatsappGate", () => {
  it("reflects the gate after a reload: provider has the gate, local screen not yet shown", () => {
    // This is the bug scenario — F5 lost requiresWhatsappOtp, but the provider
    // re-detected the gate via the background session sync.
    expect(
      shouldReflectWhatsappGate({
        hasWhatsappMfaPending: true,
        requiresWhatsappOtp: false,
      }),
    ).toBe(true);
  });

  it("does NOT re-reflect when the OTP screen is already shown (foreground login)", () => {
    // Prevents a re-render loop / double countdown handling when the password or
    // Google path already surfaced the screen.
    expect(
      shouldReflectWhatsappGate({
        hasWhatsappMfaPending: true,
        requiresWhatsappOtp: true,
      }),
    ).toBe(false);
  });

  it("does nothing when there is no pending gate", () => {
    expect(
      shouldReflectWhatsappGate({
        hasWhatsappMfaPending: false,
        requiresWhatsappOtp: false,
      }),
    ).toBe(false);
    expect(
      shouldReflectWhatsappGate({
        hasWhatsappMfaPending: false,
        requiresWhatsappOtp: true,
      }),
    ).toBe(false);
  });
});
