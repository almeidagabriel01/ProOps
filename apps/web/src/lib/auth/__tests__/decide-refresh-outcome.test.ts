import { describe, expect, it } from "vitest";
import {
  decideRefreshOutcome,
  type RefreshDecisionInput,
} from "../decide-refresh-outcome";

const base: RefreshDecisionInput = {
  authReady: true,
  hasUser: true,
  syncedThisVisit: false,
  whatsappPending: false,
  attemptsUsed: 0,
  maxAttempts: 2,
  watchdogFired: false,
};

describe("decideRefreshOutcome", () => {
  it("retries while Firebase auth has not settled yet", () => {
    expect(decideRefreshOutcome({ ...base, authReady: false })).toBe("retry");
  });

  it("redirects to login when there is no Firebase user (refresh token gone)", () => {
    expect(decideRefreshOutcome({ ...base, hasUser: false })).toBe(
      "redirect-login",
    );
  });

  it("redirects to login when a WhatsApp OTP gate is pending (re-show the code screen)", () => {
    expect(decideRefreshOutcome({ ...base, whatsappPending: true })).toBe(
      "redirect-login",
    );
  });

  it("redirects to the intended path once a fresh re-mint happened this visit", () => {
    expect(decideRefreshOutcome({ ...base, syncedThisVisit: true })).toBe(
      "redirect-next",
    );
  });

  it("retries (forces a real re-mint) when nothing was synced during this visit", () => {
    // Regression: the provider's stale isSessionSynced=true used to short-cut
    // straight to redirect-next without ever re-minting the cleared cookie.
    expect(decideRefreshOutcome({ ...base, syncedThisVisit: false })).toBe(
      "retry",
    );
  });

  it("whatsapp gate wins over a fresh sync (no 2FA bypass)", () => {
    expect(
      decideRefreshOutcome({
        ...base,
        whatsappPending: true,
        syncedThisVisit: true,
      }),
    ).toBe("redirect-login");
  });

  it("redirects to login once bounded attempts are exhausted", () => {
    expect(
      decideRefreshOutcome({ ...base, attemptsUsed: 2, maxAttempts: 2 }),
    ).toBe("redirect-login");
  });

  it("keeps retrying while attempts remain and nothing terminal happened", () => {
    expect(
      decideRefreshOutcome({ ...base, attemptsUsed: 1, maxAttempts: 2 }),
    ).toBe("retry");
  });

  it("never spins past the watchdog ceiling", () => {
    expect(decideRefreshOutcome({ ...base, watchdogFired: true })).toBe(
      "redirect-login",
    );
  });
});
