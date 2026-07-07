import { describe, expect, it } from "vitest";
import { shouldSkipSyncPost } from "../should-skip-sync-post";

describe("shouldSkipSyncPost", () => {
  it("never skips when the cooldown is inactive", () => {
    expect(
      shouldSkipSyncPost({
        cooldownActive: false,
        forceRequested: false,
        whatsappGatePending: false,
      }),
    ).toBe(false);
    expect(
      shouldSkipSyncPost({
        cooldownActive: false,
        forceRequested: true,
        whatsappGatePending: true,
      }),
    ).toBe(false);
  });

  it("skips during the cooldown when no force is requested (status quo)", () => {
    expect(
      shouldSkipSyncPost({
        cooldownActive: true,
        forceRequested: false,
        whatsappGatePending: false,
      }),
    ).toBe(true);
  });

  it("does NOT skip during the cooldown when force is requested and no gate is pending", () => {
    expect(
      shouldSkipSyncPost({
        cooldownActive: true,
        forceRequested: true,
        whatsappGatePending: false,
      }),
    ).toBe(false);
  });

  it("still skips during the cooldown when force is requested but a WhatsApp gate is pending (duplicate-challenge guard)", () => {
    expect(
      shouldSkipSyncPost({
        cooldownActive: true,
        forceRequested: true,
        whatsappGatePending: true,
      }),
    ).toBe(true);
  });
});
