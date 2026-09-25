// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { menuItems } from "@/components/layout/navigation-config";
import type { UserOnboardingState } from "@/types";

// ---------------------------------------------------------------------------
// Mocks: o provider real, com os provedores de app trocados por estado de teste.
// ---------------------------------------------------------------------------

const push = vi.fn();
let pathname = "/dashboard";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => pathname,
}));

let onboardingState: UserOnboardingState | undefined;
const refreshUser = vi.fn(async () => undefined);
vi.mock("@/providers/auth-provider", () => ({
  useAuth: () => ({
    user: { id: "u1", name: "Maria Souza", role: "admin", onboarding: onboardingState },
    refreshUser,
  }),
}));

let isDemo = false;
vi.mock("@/providers/tenant-provider", () => ({
  useTenant: () => ({ isDemo, tenant: { id: "t1", niche: "automacao_residencial" } }),
}));

vi.mock("@/providers/permissions-provider", () => ({
  usePermissions: () => ({ isMaster: true, hasPermission: () => true }),
}));

vi.mock("@/hooks/usePlanLimits", () => ({
  usePlanLimits: () => ({
    hasFinancial: true,
    hasKanban: false,
    hasFiscal: false,
    canEditPdfSections: true,
    hasCalendarSync: false,
    hasDriveSync: false,
    hasOnlinePayments: false,
    hasFiscalReceiving: false,
  }),
}));

vi.mock("@/hooks/use-is-mobile", () => ({ useIsMobile: () => false }));

vi.mock("@/components/layout/use-navigation-items", () => ({
  useNavigationItems: () => ({
    visibleMenuItems: menuItems.map((item) =>
      item.children
        ? { ...item, children: item.children.filter((c) => c.href !== "/ambientes") }
        : item,
    ),
  }),
}));

const updateOnboarding = vi.fn<(state: UserOnboardingState) => Promise<void>>(
  async () => undefined,
);
vi.mock("@/services/user-service", () => ({
  UserService: { updateOnboarding: (state: UserOnboardingState) => updateOnboarding(state) },
}));

vi.mock("@/lib/toast", () => ({
  toast: { success: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

import { AppOnboarding } from "../app-onboarding";
import { OnboardingProvider, useOnboarding } from "../onboarding-provider";

function MenuButton() {
  const { openTutorial } = useOnboarding();
  return (
    <button type="button" onClick={() => void openTutorial()}>
      menu-tutorial
    </button>
  );
}

function renderShell() {
  return render(
    <OnboardingProvider>
      <MenuButton />
      <AppOnboarding />
    </OnboardingProvider>,
  );
}

const ACTIVE_SEEN: UserOnboardingState = {
  version: "core-v2",
  status: "active",
  completedStepIds: [],
  welcomeSeenAt: "2026-09-20T10:00:00.000Z",
};

beforeEach(() => {
  pathname = "/dashboard";
  isDemo = false;
  onboardingState = ACTIVE_SEEN;
  window.localStorage.clear();
  vi.clearAllMocks();
});

afterEach(cleanup);

describe("boas-vindas", () => {
  it("aparece para conta nova e começa o tour", async () => {
    onboardingState = { version: "core-v2", status: "active", completedStepIds: [] };
    renderShell();

    expect(await screen.findByTestId("onboarding-welcome")).toBeInTheDocument();
    expect(screen.getByText("Boas-vindas, Maria!")).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByTestId("onboarding-welcome-start"));
    });
    const saved = updateOnboarding.mock.calls[0][0];
    expect(saved.welcomeSeenAt).toBeTruthy();
    expect(push).toHaveBeenCalledWith("/dashboard");
  });

  it("não aparece de novo depois de vista", () => {
    renderShell();
    expect(screen.queryByTestId("onboarding-welcome")).not.toBeInTheDocument();
  });

  it("conta demo recebe o texto de demonstração", () => {
    isDemo = true;
    onboardingState = { version: "core-v2", status: "active", completedStepIds: [] };
    renderShell();
    expect(screen.getByText(/empresa de demonstração/)).toBeInTheDocument();
  });

  it("não aparece para quem já tinha progresso do tutorial antigo", () => {
    onboardingState = { version: "core-v1", status: "active", completedStepIds: ["dashboard"] };
    renderShell();
    expect(screen.queryByTestId("onboarding-welcome")).not.toBeInTheDocument();
  });
});

describe("card do tour", () => {
  it("mostra o passo da tela atual e avança para a próxima", async () => {
    renderShell();
    expect(screen.getByTestId("onboarding-card")).toHaveTextContent("Dashboard");
    expect(screen.getByText("Você está nesta tela agora.")).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByTestId("onboarding-next"));
    });
    expect(updateOnboarding.mock.calls[0][0].completedStepIds).toEqual(["dashboard"]);
    expect(push).toHaveBeenCalledWith("/proposals");
  });

  it("reconhece a tela numa rota aninhada", () => {
    pathname = "/proposals/new";
    renderShell();
    expect(screen.getByText("Você está nesta tela agora.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Propostas" })).toBeInTheDocument();
  });

  it("fora de um passo, oferece abrir a próxima tela pendente", () => {
    pathname = "/profile";
    renderShell();
    expect(screen.getByText("Próxima tela do tour.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Abrir o Dashboard/ }));
    expect(push).toHaveBeenCalledWith("/dashboard");
  });

  it("minimiza para a pílula e lembra a escolha", () => {
    renderShell();
    fireEvent.click(screen.getByRole("button", { name: "Minimizar o tutorial" }));
    expect(screen.getByTestId("onboarding-pill")).toBeInTheDocument();
    expect(window.localStorage.getItem("proops:onboarding:minimized:u1")).toBe("1");

    fireEvent.click(screen.getByTestId("onboarding-pill"));
    expect(screen.getByTestId("onboarding-card")).toBeInTheDocument();
  });

  it("Esc minimiza", () => {
    renderShell();
    fireEvent.keyDown(screen.getByTestId("onboarding-card"), { key: "Escape" });
    expect(screen.getByTestId("onboarding-pill")).toBeInTheDocument();
  });

  it("sair grava skipped", async () => {
    renderShell();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Sair do tutorial" }));
    });
    expect(updateOnboarding.mock.calls[0][0].status).toBe("skipped");
  });

  it("não aparece com o tutorial fechado", () => {
    onboardingState = { ...ACTIVE_SEEN, status: "skipped" };
    renderShell();
    expect(screen.queryByTestId("onboarding-card")).not.toBeInTheDocument();
  });

  it("não aparece para conta antiga sem o campo", () => {
    onboardingState = undefined;
    renderShell();
    expect(screen.queryByTestId("onboarding-card")).not.toBeInTheDocument();
    expect(screen.queryByTestId("onboarding-welcome")).not.toBeInTheDocument();
  });
});

describe("reabrir pelo menu", () => {
  it.each([
    ["skipped", { ...ACTIVE_SEEN, status: "skipped" as const, completedStepIds: ["dashboard"] }],
    ["completed", { ...ACTIVE_SEEN, status: "completed" as const }],
    ["sem campo (conta antiga)", undefined],
  ])("a partir de %s recomeça do zero sem boas-vindas", async (_label, state) => {
    onboardingState = state;
    pathname = "/contacts";
    renderShell();
    await act(async () => {
      fireEvent.click(screen.getByText("menu-tutorial"));
    });
    const saved = updateOnboarding.mock.calls[0][0];
    expect(saved.status).toBe("active");
    expect(saved.completedStepIds).toEqual([]);
    expect(saved.welcomeSeenAt).toBeTruthy();
    expect(push).toHaveBeenCalledWith("/dashboard");
    await waitFor(() => expect(screen.getByTestId("onboarding-card")).toBeInTheDocument());
  });

  it("com o tour em andamento só reabre o card, sem perder o progresso", async () => {
    onboardingState = { ...ACTIVE_SEEN, completedStepIds: ["dashboard"] };
    window.localStorage.setItem("proops:onboarding:minimized:u1", "1");
    renderShell();
    expect(screen.getByTestId("onboarding-pill")).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByText("menu-tutorial"));
    });
    expect(updateOnboarding).not.toHaveBeenCalled();
    expect(screen.getByTestId("onboarding-card")).toBeInTheDocument();
  });
});
