// @vitest-environment jsdom
/**
 * O `SubscriptionGuard` enquanto auth e tenant carregam.
 *
 * Ele desenhava o Luma em tela cheia nesse intervalo, e o único caller (o
 * `ProtectedRoute`) já passava o skeleton da rota como filho no mesmo
 * intervalo: o spinner cobria o skeleton em todo F5. Agora ele deixa o filho
 * passar enquanto carrega, e continua sem desenhar nada quando a assinatura
 * está bloqueada.
 */

import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const { replace } = vi.hoisted(() => ({ replace: vi.fn() }));

let authState: { user: unknown; isLoading: boolean };
let tenantState: { tenant: unknown; isLoading: boolean };

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));
vi.mock("@/providers/auth-provider", () => ({
  useAuth: () => authState,
}));
vi.mock("@/providers/tenant-provider", () => ({
  useTenant: () => tenantState,
}));

import { SubscriptionGuard } from "../subscription-guard";

const ADMIN = { id: "u1", role: "admin", subscriptionStatus: "active" };

function renderGuard() {
  return render(
    <SubscriptionGuard>
      <div data-testid="conteudo">skeleton da rota</div>
    </SubscriptionGuard>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("SubscriptionGuard — carregando", () => {
  it("auth carregando: deixa o skeleton da rota passar, sem spinner", () => {
    authState = { user: null, isLoading: true };
    tenantState = { tenant: null, isLoading: true };
    renderGuard();

    expect(screen.getByTestId("conteudo")).toBeInTheDocument();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("tenant carregando com usuário pago: idem, e não redireciona", () => {
    authState = { user: ADMIN, isLoading: false };
    tenantState = { tenant: null, isLoading: true };
    renderGuard();

    expect(screen.getByTestId("conteudo")).toBeInTheDocument();
    expect(screen.queryByRole("status")).toBeNull();
    expect(replace).not.toHaveBeenCalled();
  });

  it("carregado e bloqueado: não pinta nada e redireciona", () => {
    authState = { user: ADMIN, isLoading: false };
    tenantState = {
      tenant: { subscriptionStatus: "canceled" },
      isLoading: false,
    };
    renderGuard();

    expect(screen.queryByTestId("conteudo")).toBeNull();
    expect(replace).toHaveBeenCalledWith(
      "/subscription-blocked?reason=canceled",
    );
  });

  it("carregado e ativo: renderiza o conteúdo", () => {
    authState = { user: ADMIN, isLoading: false };
    tenantState = { tenant: { subscriptionStatus: "active" }, isLoading: false };
    renderGuard();

    expect(screen.getByTestId("conteudo")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });
});
