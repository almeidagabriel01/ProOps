// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { REFRESH_VISITS_KEY } from "@/lib/auth/refresh-visit-breaker";

// ---------------------------------------------------------------------------
// Mocks
//
// Regression suite for the staging freeze: the interstitial used to trust the
// provider's stale isSessionSynced and redirect WITHOUT re-minting, and the
// doneRef guard left the effect permanently dead when the proxy bounced the
// navigation back to the same URL (frozen "Verificando sua sessão...").
// ---------------------------------------------------------------------------

let currentUser: { uid: string } | null;

vi.mock("@/lib/firebase", () => ({
  auth: {
    get currentUser() {
      return currentUser;
    },
  },
}));

const mockForceSyncSession = vi.fn();
let authState: {
  user: { uid: string } | null;
  isLoading: boolean;
  isSessionSynced: boolean;
  whatsappMfaPending: { maskedPhone?: string } | null;
};

vi.mock("@/providers/auth-provider", () => ({
  useAuth: () => ({ ...authState, forceSyncSession: mockForceSyncSession }),
}));

const mockReplace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace, push: vi.fn() }),
  useSearchParams: () => new URLSearchParams("next=%2Fproposals"),
}));

/**
 * A saída BEM-SUCEDIDA do interstitial é uma navegação dura, não o router do
 * Next: ele reproduz do cache o `307` que mandou o usuário para cá, e o cookie
 * recém-emitido nunca chega a ser testado. Ver `lib/auth/hard-redirect.ts`.
 */
const mockHardRedirect = vi.fn();

vi.mock("@/lib/auth/hard-redirect", () => ({
  hardRedirect: (url: string) => mockHardRedirect(url),
}));

import { useSessionRefresh } from "../useSessionRefresh";

const LOGIN_FALLBACK = "/login?redirect_reason=session_expired";

describe("useSessionRefresh", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.sessionStorage.clear();
    mockReplace.mockClear();
    mockHardRedirect.mockClear();
    mockForceSyncSession.mockReset().mockResolvedValue(true);
    currentUser = { uid: "u1" };
    authState = {
      user: { uid: "u1" },
      isLoading: false,
      // Stale client state: the provider still believes the session is synced
      // (true right after login) even though the proxy just cleared the cookie.
      isSessionSynced: true,
      whatsappMfaPending: null,
    };
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("always performs a real forced re-mint before redirecting, even when the provider claims the session is synced (the staging freeze)", async () => {
    renderHook(() => useSessionRefresh());
    await act(async () => {});

    // Without the fix: replace("/proposals") fired immediately with ZERO
    // forceSyncSession calls (stale isSessionSynced short-cut).
    expect(mockForceSyncSession).toHaveBeenCalledWith({ force: true });
    expect(mockHardRedirect).toHaveBeenCalledTimes(1);
    expect(mockHardRedirect).toHaveBeenCalledWith("/proposals");
    // E NUNCA pelo router: era isso que fazia a volta a /proposals ser servida
    // do cache de rota, sem o cookie novo ser testado.
    expect(mockReplace).not.toHaveBeenCalled();
    const syncOrder = mockForceSyncSession.mock.invocationCallOrder[0];
    const replaceOrder = mockHardRedirect.mock.invocationCallOrder[0];
    expect(syncOrder).toBeLessThan(replaceOrder);
  });

  it("watchdog still terminates to /login after a redirect-next whose navigation bounced back (dead-effect freeze)", async () => {
    renderHook(() => useSessionRefresh());
    await act(async () => {});
    expect(mockHardRedirect).toHaveBeenCalledWith("/proposals");

    // The proxy bounced back to the same URL: component stays mounted, doneRef
    // is set. Without the fix the watchdog was swallowed by the doneRef guard
    // and the spinner froze forever.
    await act(async () => {
      vi.advanceTimersByTime(10_000);
    });
    expect(mockReplace).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenLastCalledWith(LOGIN_FALLBACK);

    // And only once — later re-renders must not spam navigation.
    await act(async () => {
      vi.advanceTimersByTime(10_000);
    });
    expect(mockReplace).toHaveBeenCalledTimes(1);
    expect(mockHardRedirect).toHaveBeenCalledTimes(1);
  });

  it("breaks a cross-navigation redirect loop (3rd redirect within 30s goes to /login and clears the counter)", async () => {
    window.sessionStorage.setItem(
      REFRESH_VISITS_KEY,
      JSON.stringify({ count: 2, firstAt: Date.now() }),
    );

    renderHook(() => useSessionRefresh());
    await act(async () => {});

    expect(mockReplace).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith(LOGIN_FALLBACK);
    expect(window.sessionStorage.getItem(REFRESH_VISITS_KEY)).toBeNull();
  });

  it("redirects to /login without minting while a WhatsApp OTP gate is pending", async () => {
    authState.whatsappMfaPending = { maskedPhone: "+55 ** *****-1234" };

    renderHook(() => useSessionRefresh());
    await act(async () => {});

    expect(mockForceSyncSession).not.toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith(LOGIN_FALLBACK);
  });

  it("exhausts the bounded attempts and falls back to /login when the re-mint keeps failing", async () => {
    mockForceSyncSession.mockResolvedValue(false);

    renderHook(() => useSessionRefresh());
    await act(async () => {});
    await act(async () => {});
    await act(async () => {});

    expect(mockForceSyncSession).toHaveBeenCalledTimes(2);
    expect(mockReplace).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith(LOGIN_FALLBACK);
  });
});
