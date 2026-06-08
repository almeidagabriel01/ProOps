// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";

// ---------------------------------------------------------------------------
// Mocks
//
// The pending screen auto-polls the user's emailVerified flag every 10s for up
// to 2 minutes, reusing auth.currentUser.reload() + forceSyncSession(). We mock
// Firebase + the auth provider so we can flip emailVerified under fake timers.
// ---------------------------------------------------------------------------

const mockReload = vi.fn();
let currentUser: {
  emailVerified: boolean;
  email: string;
  reload: typeof mockReload;
} | null;

vi.mock("@/lib/firebase", () => ({
  auth: {
    get currentUser() {
      return currentUser;
    },
  },
}));

vi.mock("firebase/auth", () => ({
  signOut: vi.fn(),
}));

const mockForceSyncSession = vi.fn().mockResolvedValue(true);

vi.mock("@/providers/auth-provider", () => ({
  useAuth: () => ({ isLoading: false, forceSyncSession: mockForceSyncSession }),
}));

vi.mock("@/services/auth-service", () => ({
  AuthService: { sendVerificationEmail: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));

import { EmailVerificationPending } from "../email-verification-pending";

describe("EmailVerificationPending — auto-poll", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockReload.mockReset().mockResolvedValue(undefined);
    mockForceSyncSession.mockClear();
    currentUser = {
      emailVerified: false,
      email: "user@test.com",
      reload: mockReload,
    };
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("auto-advances when the e-mail is confirmed within the 2-minute window", async () => {
    const onVerified = vi.fn();

    // emailVerified flips to true the 2nd time reload() runs (~20s of polling).
    let reloads = 0;
    mockReload.mockImplementation(async () => {
      reloads += 1;
      if (reloads >= 2 && currentUser) currentUser.emailVerified = true;
    });

    render(<EmailVerificationPending onVerified={onVerified} />);
    // flush the initial mount check
    await act(async () => {});

    expect(onVerified).not.toHaveBeenCalled();

    // tick 1 (10s) — still unverified
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    // tick 2 (20s) — reload flips emailVerified → resolves
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });

    expect(mockForceSyncSession).toHaveBeenCalledTimes(1);
    expect(onVerified).toHaveBeenCalledTimes(1);
  });

  it("stops polling after 2 minutes and never resolves if unconfirmed", async () => {
    const onVerified = vi.fn();

    render(<EmailVerificationPending onVerified={onVerified} />);
    await act(async () => {});

    // Advance through the whole window (12 ticks) plus a margin.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(AUTO_CHECK_WINDOW_PLUS_MARGIN);
    });

    const reloadsAtExpiry = mockReload.mock.calls.length;

    // Advance well past the window — no further polling should occur.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });

    expect(mockReload.mock.calls.length).toBe(reloadsAtExpiry);
    expect(onVerified).not.toHaveBeenCalled();
    expect(
      screen.getByText(/Não detectamos a confirmação automaticamente/i),
    ).toBeInTheDocument();
  });

  it("calls onVerified at most once even if a tick and manual resolution coincide", async () => {
    const onVerified = vi.fn();

    // Already verified — both the mount check and the first tick would resolve.
    currentUser = {
      emailVerified: true,
      email: "user@test.com",
      reload: mockReload,
    };

    render(<EmailVerificationPending onVerified={onVerified} />);
    await act(async () => {});

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });

    expect(onVerified).toHaveBeenCalledTimes(1);
  });
});

// 2-minute window + one extra interval so the expiry branch runs.
const AUTO_CHECK_WINDOW_PLUS_MARGIN = 120_000 + 10_000;
