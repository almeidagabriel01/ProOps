import { describe, expect, it } from "vitest";
import { shouldForceTerminalAuthState } from "../should-force-terminal-auth-state";

describe("shouldForceTerminalAuthState", () => {
  it("forces a terminal state when the watchdog fires while still loading", () => {
    expect(
      shouldForceTerminalAuthState({ watchdogFired: true, stillLoading: true }),
    ).toBe(true);
  });

  it("does NOT force a terminal state before the watchdog fires", () => {
    expect(
      shouldForceTerminalAuthState({ watchdogFired: false, stillLoading: true }),
    ).toBe(false);
  });

  it("does nothing once loading already settled (handler cleared it in time)", () => {
    expect(
      shouldForceTerminalAuthState({ watchdogFired: true, stillLoading: false }),
    ).toBe(false);
  });
});
