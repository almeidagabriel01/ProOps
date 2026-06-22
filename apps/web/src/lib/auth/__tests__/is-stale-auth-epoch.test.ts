import { describe, expect, it } from "vitest";
import { isStaleAuthEpoch } from "../is-stale-auth-epoch";
import { shouldShortCircuitSync } from "../should-short-circuit-sync";

describe("isStaleAuthEpoch", () => {
  it("is NOT stale when the captured epoch still matches the live epoch", () => {
    // The sync that started under the current sign-in: its writes commit.
    expect(
      isStaleAuthEpoch({ capturedEpoch: 3, currentEpoch: 3 }),
    ).toBe(false);
  });

  it("is stale when a newer sign-in superseded this sync (current > captured)", () => {
    // Regression: user A's background sync started at epoch 1, user B signed in
    // (epoch 2). A's stale result must NOT write isSessionSynced / the gate for
    // the wrong identity — its writes are dropped.
    expect(
      isStaleAuthEpoch({ capturedEpoch: 1, currentEpoch: 2 }),
    ).toBe(true);
  });

  it("is stale (defensive) when current < captured", () => {
    expect(
      isStaleAuthEpoch({ capturedEpoch: 5, currentEpoch: 4 }),
    ).toBe(true);
  });

  it("treats epoch 0 (initial, no explicit sign-in yet) as fresh against itself", () => {
    expect(
      isStaleAuthEpoch({ capturedEpoch: 0, currentEpoch: 0 }),
    ).toBe(false);
  });
});

/**
 * WhatsApp-MFA race invariant (security-critical, project bug-fix policy).
 *
 * Models the second-login race where the FIRST account's background sync resolves
 * after a NEW sign-in has raised a WhatsApp OTP gate. Two independent guards must
 * BOTH refuse to mark the session synced, so the stale sync can never bypass 2FA:
 *   1. epoch staleness — the late sync is from a superseded sign-in → writes dropped.
 *   2. gate guard — even a fresh sync must not short-circuit-mark-synced while an
 *      OTP is owed.
 */
describe("stale sync cannot bypass a pending WhatsApp OTP gate", () => {
  it("drops the stale sync's writes when a newer sign-in superseded it", () => {
    // A's sync started at epoch 1; the user then signed in as B (epoch 2) and a
    // WhatsApp gate is now pending. A's resolved sync is stale → no state write.
    const stale = isStaleAuthEpoch({ capturedEpoch: 1, currentEpoch: 2 });
    expect(stale).toBe(true);
  });

  it("never marks synced while the gate is pending, even for a fresh-epoch sync", () => {
    // Defense in depth: if the epochs happened to match, the cooldown shortcut
    // still must not flip synced while the OTP is owed.
    expect(
      shouldShortCircuitSync({
        cooldownActive: true,
        whatsappGatePending: true,
      }),
    ).toBe(false);
  });
});
