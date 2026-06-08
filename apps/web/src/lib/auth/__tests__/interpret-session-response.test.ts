import { describe, it, expect } from "vitest";
import { interpretSessionResponse } from "../interpret-session-response";

describe("interpretSessionResponse", () => {
  it("marks synced for a normal login (cookie emitted, no mfaRequired)", () => {
    expect(interpretSessionResponse({})).toBe("synced");
    expect(interpretSessionResponse({ mfaRequired: false })).toBe("synced");
  });

  it("treats the WhatsApp gate (mfaRequired + method=whatsapp) as otp-pending", () => {
    expect(
      interpretSessionResponse({
        mfaRequired: true,
        method: "whatsapp",
        maskedPhone: "+55 11 9****-**99",
      }),
    ).toBe("whatsapp-otp-pending");
  });

  it("keeps syncing for the super-admin gate (mfaRequired WITHOUT method=whatsapp)", () => {
    // Super admins return { mfaRequired: true } but no method:"whatsapp".
    // This must NOT be treated as the WhatsApp gate — it stays synced.
    expect(interpretSessionResponse({ mfaRequired: true })).toBe("synced");
    expect(
      interpretSessionResponse({ mfaRequired: true, method: "totp" }),
    ).toBe("synced");
  });

  it("does not gate when mfaRequired is true but method is whatsapp-less", () => {
    expect(
      interpretSessionResponse({ method: "whatsapp" }),
    ).toBe("synced");
  });

  it("treats null/undefined bodies as synced (fail-open, cookie path)", () => {
    expect(interpretSessionResponse(null)).toBe("synced");
    expect(interpretSessionResponse(undefined)).toBe("synced");
  });
});
