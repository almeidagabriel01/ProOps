import { describe, it, expect, vi, beforeEach } from "vitest";

const signOut = vi.fn();
vi.mock("firebase/auth", () => ({ signOut: (...a: unknown[]) => signOut(...a) }));
const hardRedirect = vi.fn();
vi.mock("@/lib/auth/hard-redirect", () => ({ hardRedirect: (u: string) => hardRedirect(u) }));

import {
  forceWhatsappMfaReauth,
  isWhatsappMfaRequiredError,
  resetWhatsappMfaReauthForTest,
} from "../whatsapp-mfa-reauth";
import type { Auth } from "firebase/auth";

const auth = {} as Auth;

describe("reautenticação por 2FA do WhatsApp", () => {
  beforeEach(() => {
    resetWhatsappMfaReauthForTest();
    signOut.mockReset().mockResolvedValue(undefined);
    hardRedirect.mockReset();
  });

  it("reconhece só o código do backend", () => {
    expect(isWhatsappMfaRequiredError({ code: "WHATSAPP_MFA_REQUIRED" })).toBe(true);
    expect(isWhatsappMfaRequiredError({ code: "SUPERADMIN_MFA_REQUIRED" })).toBe(false);
    expect(isWhatsappMfaRequiredError(null)).toBe(false);
  });

  it("desloga e manda para o login", async () => {
    await forceWhatsappMfaReauth(auth);
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(hardRedirect).toHaveBeenCalledWith("/login?redirect_reason=session_expired");
  });

  it("várias chamadas falhando juntas redirecionam uma vez só", async () => {
    await Promise.all([
      forceWhatsappMfaReauth(auth),
      forceWhatsappMfaReauth(auth),
      forceWhatsappMfaReauth(auth),
    ]);
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(hardRedirect).toHaveBeenCalledTimes(1);
  });

  it("redireciona mesmo se o signOut falhar", async () => {
    signOut.mockRejectedValue(new Error("offline"));
    await forceWhatsappMfaReauth(auth);
    expect(hardRedirect).toHaveBeenCalledTimes(1);
  });
});
