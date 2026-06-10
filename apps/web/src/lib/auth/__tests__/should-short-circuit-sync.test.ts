import { describe, expect, it } from "vitest";
import {
  shouldShortCircuitSync,
  type ShortCircuitSyncState,
} from "../should-short-circuit-sync";

const base: ShortCircuitSyncState = {
  cooldownActive: false,
  whatsappGatePending: false,
};

describe("shouldShortCircuitSync", () => {
  it("short-circuits when the cooldown is active and no gate is pending", () => {
    expect(
      shouldShortCircuitSync({ ...base, cooldownActive: true }),
    ).toBe(true);
  });

  it("does NOT short-circuit when a WhatsApp gate is pending (the 2FA bypass)", () => {
    // Regression: the cooldown shortcut marks the session synced and clears the
    // gate without server verification. With a pending WhatsApp OTP, a racing
    // listener would let the redirect enter the app WITHOUT the code. The
    // shortcut must be refused so the server re-verifies the gate.
    expect(
      shouldShortCircuitSync({
        cooldownActive: true,
        whatsappGatePending: true,
      }),
    ).toBe(false);
  });

  it("does NOT short-circuit when the cooldown is not active", () => {
    expect(shouldShortCircuitSync(base)).toBe(false);
    expect(
      shouldShortCircuitSync({ ...base, whatsappGatePending: true }),
    ).toBe(false);
  });
});
