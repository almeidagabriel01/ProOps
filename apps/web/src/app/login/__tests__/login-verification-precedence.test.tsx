// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

import LoginPage from "../page";

// ---------------------------------------------------------------------------
// Mocks
//
// Regression context: right after registration, refreshUser() makes `user`
// truthy with role "free" before the session/redirect settles, while
// isEmailVerificationPending is also set. The login page must render the
// verification-pending screen and NOT the `user && role==="free" → return null`
// branch (which produced a blank/black screen until a manual reload).
//
// We mock the heavy data hook and the child screens so the test exercises only
// the render-precedence of the early returns in the page component.
// ---------------------------------------------------------------------------

// A transitive page import pulls in @/lib/firebase, which calls getAuth() at
// module load and throws without real config. Stub it — the test never touches
// Firebase.
vi.mock("@/lib/firebase", () => ({
  app: {},
  auth: {},
  db: {},
  functions: {},
  storage: {},
}));

const mockUseLoginForm = vi.fn();

vi.mock("../_hooks/useLoginForm", () => ({
  useLoginForm: () => mockUseLoginForm(),
}));

vi.mock("@/components/auth/email-verification-pending", () => ({
  EmailVerificationPending: () => <div data-testid="pending-screen">pending</div>,
}));

vi.mock("../_components/auth-layout", () => ({
  AuthLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function baseState(overrides: Record<string, unknown> = {}) {
  return {
    email: "",
    setEmail: vi.fn(),
    password: "",
    setPassword: vi.fn(),
    name: "",
    setName: vi.fn(),
    phoneNumber: "",
    setPhoneNumber: vi.fn(),
    companyName: "",
    setCompanyName: vi.fn(),
    companyColor: "#000000",
    setCompanyColor: vi.fn(),
    companyLogo: "",
    setCompanyLogo: vi.fn(),
    companyNiche: "automacao_residencial",
    setCompanyNiche: vi.fn(),
    error: "",
    setError: vi.fn(),
    errors: {},
    registerSuccessMessage: "",
    smsCode: "",
    setSmsCode: vi.fn(),
    requiresPhoneVerification: false,
    isAwaitingPhoneVerification: false,
    isSendingSms: false,
    isVerifyingSmsCode: false,
    isEmailVerificationPending: false,
    setIsEmailVerificationPending: vi.fn(),
    isLoggingIn: false,
    isRegistering: false,
    mode: "register",
    setMode: vi.fn(),
    isLoading: false,
    user: null,
    handleLogin: vi.fn(),
    isResetting: false,
    resetSent: false,
    handleRegister: vi.fn(),
    handleForgotPassword: vi.fn(),
    handleGoogleAuth: vi.fn(),
    handleLogoUpload: vi.fn(),
    handleConfirmPhoneCode: vi.fn(),
    handleResendPhoneCode: vi.fn(),
    isGoogleLoading: false,
    requiresMfaCode: false,
    mfaLoginCode: "",
    setMfaLoginCode: vi.fn(),
    isVerifyingMfaCode: false,
    handleConfirmMfaCode: vi.fn(),
    ...overrides,
  };
}

describe("LoginPage — email-verification precedence", () => {
  beforeEach(() => {
    mockUseLoginForm.mockReset();
  });

  it("shows the verification-pending screen even when a freshly-registered free user is present", () => {
    mockUseLoginForm.mockReturnValue(
      baseState({
        isEmailVerificationPending: true,
        user: { role: "free" },
      }),
    );

    render(<LoginPage />);

    expect(screen.getByTestId("pending-screen")).toBeInTheDocument();
  });

  it("shows the verification-pending screen when no user is loaded yet", () => {
    mockUseLoginForm.mockReturnValue(
      baseState({ isEmailVerificationPending: true, user: null }),
    );

    render(<LoginPage />);

    expect(screen.getByTestId("pending-screen")).toBeInTheDocument();
  });

  it("does NOT show the pending screen for a logged-in free user when verification is not pending", () => {
    mockUseLoginForm.mockReturnValue(
      baseState({
        isEmailVerificationPending: false,
        user: { role: "free" },
        // A free user reaching the logged-in redirect gate has a synced session;
        // the loader block returns null for them while the redirect runs.
        isSessionSynced: true,
      }),
    );

    const { container } = render(<LoginPage />);

    expect(screen.queryByTestId("pending-screen")).not.toBeInTheDocument();
    // free user with no pending verification → blank (null) redirect gate
    expect(container).toBeEmptyDOMElement();
  });
});
