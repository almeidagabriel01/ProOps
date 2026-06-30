// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// ---------------------------------------------------------------------------
// Mocks
//
// The admin MFA page must reflect the already-enrolled state exposed by
// useTotpEnrollment (isEnrolled/disable). We mock the hook so we can drive the
// page through each enrollment state and assert the UI branches.
// ---------------------------------------------------------------------------

type HookState = {
  stage: "intro" | "secret" | "done";
  secret: unknown;
  otpauthUrl: string;
  code: string;
  setCode: () => void;
  error: string;
  busy: boolean;
  isEnrolled: boolean;
  generate: () => void;
  enroll: () => void;
  disable: () => Promise<boolean>;
};

const mockDisable = vi.fn().mockResolvedValue(true);
let hookState: HookState;

vi.mock("@/hooks/useTotpEnrollment", () => ({
  useTotpEnrollment: () => hookState,
}));

vi.mock("@/providers/auth-provider", () => ({
  useAuth: () => ({ logout: vi.fn() }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/lib/toast", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import SetupMfaPage from "../page";

function baseState(overrides: Partial<HookState> = {}): HookState {
  return {
    stage: "intro",
    secret: null,
    otpauthUrl: "",
    code: "",
    setCode: vi.fn(),
    error: "",
    busy: false,
    isEnrolled: false,
    generate: vi.fn(),
    enroll: vi.fn(),
    disable: mockDisable,
    ...overrides,
  };
}

describe("SetupMfaPage — enrolled-state awareness", () => {
  beforeEach(() => {
    mockDisable.mockClear().mockResolvedValue(true);
  });

  it("shows enrolled status + Desativar (and hides the enroll flow) when already enrolled", () => {
    hookState = baseState({ isEnrolled: true, stage: "intro" });
    render(<SetupMfaPage />);

    expect(screen.getByText("Ativada")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Desativar" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Gerar chave do autenticador"),
    ).not.toBeInTheDocument();
  });

  it("shows the enroll flow (and no Desativar) when not enrolled", () => {
    hookState = baseState({ isEnrolled: false, stage: "intro" });
    render(<SetupMfaPage />);

    expect(
      screen.getByText("Gerar chave do autenticador"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Desativar" }),
    ).not.toBeInTheDocument();
  });

  it("calls disable() after confirming the disable dialog", async () => {
    hookState = baseState({ isEnrolled: true, stage: "intro" });
    render(<SetupMfaPage />);

    fireEvent.click(screen.getByRole("button", { name: "Desativar" }));
    fireEvent.click(screen.getByRole("button", { name: "Sim, desativar" }));

    expect(mockDisable).toHaveBeenCalledTimes(1);
  });

  it("shows the success state after enrollment regardless of isEnrolled", () => {
    hookState = baseState({ isEnrolled: true, stage: "done" });
    render(<SetupMfaPage />);

    expect(screen.getByText("MFA ativado com sucesso")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Sair e entrar novamente" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Desativar" }),
    ).not.toBeInTheDocument();
  });
});
